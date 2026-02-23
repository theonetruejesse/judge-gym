import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { getProviderForModel, isBatchableModel, type ModelType } from "../../platform/providers/provider_types";
import type { RunPolicy } from "../../platform/run_policy";
import { ENGINE_SETTINGS } from "../../settings";

/**
 * Pending input item to be transformed into a single LLM request.
 */
export type PendingTarget = {
  targetId: string;
  input: string;
};

/**
 * Base orchestration flow for turning domain targets into LLM requests and
 * routing them into batches or jobs based on the run policy.
 *
 * Responsibilities:
 * - Collect pending targets for a process/stage
 * - Build prompts and enqueue LLM requests
 * - Route requests into a batch or a job via internal LLM repos
 */
export abstract class BaseOrchestrator<TProcessId, TStage> {
  /** Run policy used to decide batching vs. job execution. */
  protected readonly policy: RunPolicy = ENGINE_SETTINGS.run_policy;

  protected constructor(protected readonly ctx: MutationCtx) { }

  /** Return pending targets for the given process and stage. */
  protected abstract listPendingTargets(
    processId: TProcessId,
    stage: TStage,
  ): Promise<PendingTarget[]>;

  /** Resolve the model to use for the given process and stage. */
  protected abstract getModelForStage(
    processId: TProcessId,
    stage: TStage,
  ): Promise<ModelType>;

  /** Build system/user prompts for a given stage input. */
  protected abstract buildPrompts(
    stage: TStage,
    input: string,
  ): { system: string; user: string };

  /** Optional hook after a request is created for a target. */
  protected async onRequestCreated(
    _targetId: string,
    _stage: TStage,
    _requestId: Id<"llm_requests">,
  ): Promise<void> {
    return;
  }

  /** Encode a request-scoped custom key for later routing/decoding. */
  public abstract makeRequestKey(targetId: string, stage: TStage): string;
  /** Decode a request-scoped custom key into a target id and stage. */
  public abstract parseRequestKey(key: string): {
    targetId: string;
    stage: TStage;
  };

  /** Encode a process-scoped custom key for later routing/decoding. */
  public abstract makeProcessKey(processId: TProcessId, stage: TStage): string;
  /** Decode a process-scoped custom key into a process id and stage. */
  public abstract parseProcessKey(key: string): {
    processId: TProcessId;
    stage: TStage;
  };

  /** Determine whether to batch or job */
  protected decideRoute(model: ModelType, count: number): "batch" | "job" {
    if (!isBatchableModel(model)) return "job";
    if (count < this.policy.min_batch_size) return "job";
    if (count <= this.policy.job_fallback_count) return "job";
    return "batch";
  }

  /** Create a batch and assign all requests to it. */
  protected async createBatch(
    processId: TProcessId,
    stage: TStage,
    model: ModelType,
    requestIds: Id<"llm_requests">[],
  ): Promise<void> {
    const provider = getProviderForModel(model);
    const batchId = (await this.ctx.runMutation(
      internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
      {
        provider,
        model,
        custom_key: this.makeProcessKey(processId, stage),
      },
    )) as Id<"llm_batches">;
    await this.ctx.runMutation(
      internal.domain.llm_calls.llm_batch_repo.assignRequestsToBatch,
      {
        request_ids: requestIds,
        batch_id: batchId,
      },
    );
  }

  /** Create a job and assign all requests to it. */
  protected async createJob(
    processId: TProcessId,
    stage: TStage,
    model: ModelType,
    requestIds: Id<"llm_requests">[],
  ): Promise<void> {
    const provider = getProviderForModel(model);
    const jobId = (await this.ctx.runMutation(
      internal.domain.llm_calls.llm_job_repo.createLlmJob,
      {
        provider,
        model,
        custom_key: this.makeProcessKey(processId, stage),
      },
    )) as Id<"llm_jobs">;
    await this.ctx.runMutation(
      internal.domain.llm_calls.llm_job_repo.assignRequestsToJob,
      {
        request_ids: requestIds,
        job_id: jobId,
      },
    );
  }

  /**
   * Enqueue all pending targets for a stage:
   * - Build prompts and create llm_requests
   * - Route to batch or job based on policy
   */
  async enqueueStage(processId: TProcessId, stage: TStage): Promise<void> {
    const targets = await this.listPendingTargets(processId, stage);
    if (targets.length === 0) return;

    const model = await this.getModelForStage(processId, stage);
    const requestIds: Id<"llm_requests">[] = [];
    for (const target of targets) {
      const prompts = this.buildPrompts(stage, target.input);
      const custom_key = this.makeRequestKey(target.targetId, stage);
      const requestId = (await this.ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model,
          system_prompt: prompts.system,
          user_prompt: prompts.user,
          custom_key,
          attempts: 0,
        },
      )) as Id<"llm_requests">;
      await this.onRequestCreated(target.targetId, stage, requestId);
      requestIds.push(requestId);
    }

    const decision = this.decideRoute(model, requestIds.length);

    if (decision === "batch") {
      await this.createBatch(processId, stage, model, requestIds);
      return;
    }
    await this.createJob(processId, stage, model, requestIds);
  }

}
