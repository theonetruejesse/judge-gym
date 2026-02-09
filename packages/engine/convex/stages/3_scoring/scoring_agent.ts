import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import type { ModelType, ExperimentConfig } from "../../schema";
import { AbstractJudgeAgent } from "../../agents/abstract";
import {
  resolveAll,
  type ResolvedStrategies,
} from "../../strategies/resolve";
import {
  SCORING_INSTRUCTIONS,
  buildScoringPrompt,
  PROBE_INSTRUCTIONS,
  probePrompt,
} from "./scoring_prompts";
import {
  extractReasoningBeforeVerdict,
  parseExpertAgreementResponse,
} from "./scoring_parsers";

/**
 * Scorer — strategy-driven evidence scoring agent.
 * Resolves all strategies at construction time; no if/else on config in score().
 */
export class Scorer extends AbstractJudgeAgent {
  private readonly strategies: ResolvedStrategies;

  constructor(modelId: ModelType, config: ExperimentConfig) {
    super(modelId, SCORING_INSTRUCTIONS, "scoring");
    this.strategies = resolveAll(config);
  }

  async score(
    ctx: ActionCtx,
    args: {
      experimentTag: string;
      rubric: Doc<"rubrics">;
      evidence: Doc<"evidences">;
      labelMapping?: Record<string, number>;
    },
  ): Promise<{
    threadId: string;
    rawOutput: string;
    reasoning: string;
    rawVerdict: string | null;
    decodedScores: number[] | null;
    abstained: boolean;
  }> {
    await this.checkRateLimit(ctx);
    const threadId = await this.createThread(ctx, args.experimentTag, {
      rubricId: args.rubric._id.toString(),
      scoringMethod: "suffix",
    });

    // Strategy drives which content field to use
    const content =
      args.evidence[this.strategies.evidence.contentField] ??
      args.evidence.rawContent;

    // Strategy drives the prompt structure
    const prompt = buildScoringPrompt({
      rubric: args.rubric,
      content,
      labelMapping: args.labelMapping,
      systemInstruction: this.strategies.scoring.systemInstruction,
      buildPromptSuffix: this.strategies.scoring.buildPromptSuffix,
      letterLabels: this.strategies.scale.letterLabels,
      rubricFirst: this.strategies.ordering.rubricFirst,
      rubricOrderShuffle: this.strategies.randomization.rubricOrderShuffle,
    });

    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      { prompt } as any,
    );
    const rawText = text;
    const reasoning = extractReasoningBeforeVerdict(rawText);

    // Strategy drives the parser
    const result = this.strategies.scoring.parseVerdict(
      rawText,
      args.labelMapping,
    );
    return { threadId, rawOutput: rawText, reasoning, ...result };
  }
}

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
      scoreId: string;
      rubric: Array<{ label: string; criteria: string[] }>;
      evidenceSummary: string;
      modelOutput: string;
      verdictLabels: string[];
      labelsAnonymized: boolean;
      abstained: boolean;
    },
  ): Promise<{
    threadId: string;
    expertAgreementProb: number;
    reasoning: string;
    rawOutput: string;
  }> {
    await this.checkRateLimit(ctx);

    // CRITICAL: fresh thread — no prior context from the scoring conversation
    const threadId = await this.createThread(ctx, args.experimentTag, {
      scoreId: args.scoreId,
      probeType: "expert-agreement",
    });

    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      {
        prompt: probePrompt(
          args.rubric,
          args.evidenceSummary,
          args.modelOutput,
          args.verdictLabels,
          args.labelsAnonymized,
          args.abstained,
        ),
      } as any,
      {
        contextOptions: { recentMessages: 0 }, // enforce fresh window
      },
    );

    const { expertAgreementProb, reasoning } =
      parseExpertAgreementResponse(text);
    return {
      threadId,
      expertAgreementProb,
      reasoning,
      rawOutput: text,
    };
  }
}
