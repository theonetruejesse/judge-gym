import type { ActionCtx } from "../../_generated/server";
import type { ModelType } from "../../schema";
import { AbstractJudgeAgent } from "../../agents/abstract";
import { PROBE_INSTRUCTIONS, probePrompt } from "./probe_prompts";

/**
 * Prober — measures epistemic calibration in a fresh context.
 * Uses the same model as the Scorer to test whether the model's
 * confidence persists without its own reasoning as context.
 */
export class Prober extends AbstractJudgeAgent {
  constructor(modelId: ModelType) {
    super(modelId, PROBE_INSTRUCTIONS, "prober");
  }

  async probe(
    ctx: ActionCtx,
    args: {
      experimentTag: string;
      sampleId: string;
      stageLabel: string;
      stageCriteria: string[];
      evidenceSummary: string;
    },
  ): Promise<{ threadId: string; expertAgreementProb: number }> {
    await this.checkRateLimit(ctx);

    // CRITICAL: fresh thread — no prior context from the scoring conversation
    const threadId = await this.createThread(ctx, args.experimentTag, {
      sampleId: args.sampleId,
      probeType: "expert-agreement",
    });

    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      {
        prompt: probePrompt(
          args.stageLabel,
          args.stageCriteria,
          args.evidenceSummary,
        ),
      } as any,
      {
        contextOptions: { recentMessages: 0 }, // enforce fresh window
      },
    );

    // Parse the probability from the response
    const match = text.match(/([01](?:\.\d+)?)/);

    if (!match) throw new Error(`Failed to parse probability from probe response: ${text}`);
    const prob = parseFloat(match[1]);
    if (isNaN(prob)) throw new Error(`Invalid probability value parsed: ${match[1]}`);

    const clamped = Math.min(1.0, Math.max(0.0, prob));

    return { threadId, expertAgreementProb: clamped };
  }
}
