import z from "zod";
import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import type { ModelType, ExperimentConfig } from "../../schema";
import { AbstractJudgeAgent } from "../../agents/abstract";
import {
  resolveAll,
  type ResolvedStrategies,
} from "../../strategies/resolve";
import { SCORING_INSTRUCTIONS, buildScoringPrompt } from "./scoring_prompts";

// Zod schema for structured-json scoring method
const verdictSchema = z.object({
  verdict: z.string(),
});

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
      experimentId: string;
      rubric: Doc<"rubrics">;
      evidence: Doc<"evidence">;
      labelMapping?: Record<string, number>;
    },
  ): Promise<{
    threadId: string;
    rawVerdict: string | null;
    decodedScores: number[] | null;
    abstained: boolean;
  }> {
    await this.checkRateLimit(ctx);
    const threadId = await this.createThread(ctx, args.experimentId, {
      rubricId: args.rubric._id.toString(),
      scoringMethod: this.strategies.scoring.useGenerateObject
        ? "json"
        : "suffix",
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
    });

    let rawText: string;
    if (this.strategies.scoring.useGenerateObject) {
      const { object } = await this.agent.generateObject(
        ctx,
        { threadId },
        {
          prompt,
          schema: verdictSchema,
        },
      );
      rawText = object.verdict;
    } else {
      const { text } = await this.agent.generateText(
        ctx,
        { threadId },
        { prompt } as any,
      );
      rawText = text;
    }

    // Strategy drives the parser
    const result = this.strategies.scoring.parseVerdict(
      rawText,
      args.labelMapping,
    );
    return { threadId, ...result };
  }
}
