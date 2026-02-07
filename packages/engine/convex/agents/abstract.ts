import { Agent, createThread } from "@convex-dev/agent";
import { components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { MODEL_MAP } from "../utils";
import {
  rateLimiter,
  RATE_LIMIT_CONFIGS,
  RATE_LIMITED_MODELS,
  REQUEST_LIMIT_KEYS,
  type RateLimitedModel,
} from "../rate_limiter";
import { experimentConfig } from "../agent_config";
import type { ModelType } from "../schema";

export type ThreadMeta = {
  stage: string;
  experimentId: string;
  modelId: string;
  [key: string]: string;
};

export abstract class AbstractJudgeAgent {
  protected readonly stageName: string;
  protected readonly agent: Agent;
  protected readonly modelId: ModelType;

  constructor(modelId: ModelType, instructions: string, stageName: string) {
    this.modelId = modelId;
    this.stageName = stageName;
    this.agent = new Agent(components.agent, {
      name: `${stageName}:${modelId}`,
      instructions,
      languageModel: MODEL_MAP[modelId],
      ...experimentConfig,
    } as any);
  }

  /** Create a tagged thread for this operation. */
  protected async createThread(
    ctx: ActionCtx,
    experimentId: string,
    meta?: Record<string, string>,
  ): Promise<string> {
    return await createThread(ctx, components.agent, {
      userId: experimentId,
      title: `${this.stageName}:${experimentId}:${this.modelId}`,
      summary: JSON.stringify({
        stage: this.stageName,
        experimentId,
        modelId: this.modelId,
        ...meta,
      } satisfies ThreadMeta),
    });
  }

  /** Pre-flight rate limit check. Call before any generation. */
  protected async checkRateLimit(ctx: ActionCtx): Promise<void> {
    if (!RATE_LIMITED_MODELS.has(this.modelId as RateLimitedModel)) return;
    const model = this.modelId as RateLimitedModel;
    const key = REQUEST_LIMIT_KEYS[model];
    await rateLimiter.limit(ctx, key, { throws: true });
  }
}
