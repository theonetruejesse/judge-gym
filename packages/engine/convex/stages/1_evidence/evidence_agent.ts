import type { ActionCtx } from "../../_generated/server";
import { AbstractJudgeAgent } from "../../agents/abstract";
import {
  NEUTRALIZE_INSTRUCTIONS,
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

  async neutralize(ctx: ActionCtx, rawContent: string): Promise<string> {
    await this.checkRateLimit(ctx);
    // No experimentTag for thread — utility operation, not experiment-specific
    const threadId = await this.createThread(ctx, "system:neutralization");
    const { text } = await this.agent.generateText(
      ctx,
      { threadId },
      { prompt: neutralizePrompt(rawContent) } as any,
    );
    return text;
  }
}
