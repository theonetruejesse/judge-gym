import z from "zod";
import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import type { ModelType } from "../../schema";
import { AbstractJudgeAgent } from "../../agents/abstract";
import {
  RUBRIC_GENERATION_INSTRUCTIONS,
  rubricGenerationPrompt,
  CRITIC_INSTRUCTIONS,
  rubricCriticPrompt,
} from "./rubric_prompts";

const RubricGenerationOutputSchema = z.object({
  stages: z.array(
    z.object({
      label: z.string(),
      criteria: z.array(z.string()),
    }),
  ),
  reasoning: z.string(),
});

const QualityStatsSchema = z.object({
  observabilityScore: z.number().min(0).max(1),
  discriminabilityScore: z.number().min(0).max(1),
});

/**
 * Rubricer — generates evaluative rubrics. Uses the experiment's model.
 */
export class Rubricer extends AbstractJudgeAgent {
  constructor(modelId: ModelType) {
    super(modelId, RUBRIC_GENERATION_INSTRUCTIONS, "rubricer");
  }

  async generateRubric(
    ctx: ActionCtx,
    args: {
      experimentId: string;
      concept: string;
      country: string;
      scaleSize: number;
    },
  ) {
    await this.checkRateLimit(ctx);
    const threadId = await this.createThread(ctx, args.experimentId, {
      concept: args.concept,
    });
    const { object } = await this.agent.generateObject(
      ctx,
      { threadId },
      {
        prompt: rubricGenerationPrompt(
          args.concept,
          args.country,
          args.scaleSize,
        ),
        schema: RubricGenerationOutputSchema,
      },
    );
    return object;
  }
}

/**
 * Critic — evaluates rubric quality. Uses a fixed utility model.
 */
export class Critic extends AbstractJudgeAgent {
  constructor() {
    super("gpt-4.1-mini", CRITIC_INSTRUCTIONS, "critic");
  }

  async evaluate(ctx: ActionCtx, rubric: Doc<"rubrics">) {
    await this.checkRateLimit(ctx);
    const threadId = await this.createThread(ctx, rubric.experimentId, {
      rubricId: rubric._id.toString(),
    });
    const { object } = await this.agent.generateObject(
      ctx,
      { threadId },
      {
        prompt: rubricCriticPrompt(rubric),
        schema: QualityStatsSchema,
      },
    );
    return object;
  }
}
