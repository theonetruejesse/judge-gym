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
import {
  parseRubricResponse,
  parseQualityResponse,
} from "./rubric_parsers";

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
      experimentTag: string;
      concept: string;
      scaleSize: number;
    },
  ) {
    await this.checkRateLimit(ctx);
    const threadId = await this.createThread(ctx, args.experimentTag, {
      concept: args.concept,
    });
    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      {
        prompt: rubricGenerationPrompt(args.concept, args.scaleSize),
      } as any,
    );
    const parsed = parseRubricResponse(text, args.scaleSize);
    return { threadId, rawOutput: text, ...parsed };
  }
}

/**
 * Critic — evaluates rubric quality. Uses the experiment's model.
 */
export class Critic extends AbstractJudgeAgent {
  constructor(modelId: ModelType) {
    super(modelId, CRITIC_INSTRUCTIONS, "critic");
  }

  async evaluate(ctx: ActionCtx, rubric: Doc<"rubrics">) {
    await this.checkRateLimit(ctx);
    const threadId = await this.createThread(ctx, rubric.experimentId, {
      rubricId: rubric._id.toString(),
    });
    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      { prompt: rubricCriticPrompt(rubric) } as any,
    );
    const parsed = parseQualityResponse(text);
    return { threadId, rawOutput: text, ...parsed };
  }
}
