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
} from "../../utils/rubric_parser";

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
    return parseRubricResponse(text, args.scaleSize);
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
    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      { prompt: rubricCriticPrompt(rubric) } as any,
    );
    return parseQualityResponse(text);
  }
}
