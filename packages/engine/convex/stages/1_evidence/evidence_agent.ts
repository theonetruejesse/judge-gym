import type { ActionCtx } from "../../_generated/server";
import { AbstractJudgeAgent } from "../../agents/abstract";
import {
  EVIDENCE_CLEANING_INSTRUCTIONS,
  NEUTRALIZE_INSTRUCTIONS,
  STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
  abstractPrompt,
  cleanPrompt,
  neutralizePrompt,
} from "./evidence_prompts";

/**
 * Neutralizer agent. Uses a fixed utility model (not the experiment model)
 * to ensure consistent neutralization across all experiments.
 */
export class Neutralizer extends AbstractJudgeAgent {
  constructor() {
    // Fixed model — neutralization must be consistent across experiments
    super("gpt-4.1", NEUTRALIZE_INSTRUCTIONS, "neutralizer");
  }

  async neutralize(ctx: ActionCtx, cleanedContent: string): Promise<string> {
    await this.checkRateLimit(ctx);
    // No experimentTag for thread — utility operation, not experiment-specific
    const threadId = await this.createThread(ctx, "system:neutralization");
    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      { prompt: neutralizePrompt(cleanedContent) } as any,
    );
    return text;
  }
}

export class EvidenceCleaner extends AbstractJudgeAgent {
  constructor() {
    super("gpt-4.1", EVIDENCE_CLEANING_INSTRUCTIONS, "evidence-cleaner");
  }

  async clean(ctx: ActionCtx, rawContent: string): Promise<string> {
    await this.checkRateLimit(ctx);
    const threadId = await this.createThread(ctx, "system:evidence-cleaning");
    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      { prompt: cleanPrompt(rawContent) } as any,
    );
    return text;
  }
}

export class StructuralAbstractor extends AbstractJudgeAgent {
  constructor() {
    super(
      "gpt-4.1",
      STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
      "structural-abstractor",
    );
  }

  async abstract(ctx: ActionCtx, neutralizedContent: string): Promise<string> {
    await this.checkRateLimit(ctx);
    const threadId = await this.createThread(ctx, "system:structural-abstraction");
    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      { prompt: abstractPrompt(neutralizedContent) } as any,
    );
    return text;
  }
}
