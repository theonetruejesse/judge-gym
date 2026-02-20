import z from "zod";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { zInternalMutation } from "../../utils/custom_fns";
import { ENGINE_SETTINGS } from "../../settings";
import { shouldRunAt } from "../../utils/scheduling";
import { workflow } from "./process_workflows";
import { ActiveBatchesResult } from "../llm_calls/llm_batch_repo";
import { ActiveJobsResult } from "../llm_calls/llm_job_repo";
import { zid } from "convex-helpers/server/zod4";
import { resolveRequeueHandler } from "./target_registry";

export const requeueRequest = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.runQuery(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: args.request_id },
    );

    const handler = resolveRequeueHandler(request.custom_key);
    if (!handler) throw new Error(`Unsupported target type for retry: ${request.custom_key}`);

    await handler(ctx, request);
  },
});

export const startScheduler = zInternalMutation({
  args: z.object({}),
  handler: async (ctx) => {
    // todo, check if scheduler is already running
    await ctx.scheduler.runAfter(
      0,
      internal.domain.orchestrator.scheduler.runScheduler,
      {},
    );
  },
});

export const runScheduler = zInternalMutation({
  args: z.object({}),
  handler: async (ctx) => {
    const now = Date.now();
    const internalAny = internal as any;

    const { queued_batches, running_batches } = (await ctx.runQuery(
      internal.domain.llm_calls.llm_batch_repo.listActiveBatches,
      {},
    )) as ActiveBatchesResult;

    const { queued_jobs, running_jobs } = (await ctx.runQuery(
      internal.domain.llm_calls.llm_job_repo.listActiveJobs,
      {},
    )) as ActiveJobsResult;

    const orphanedRequests = (await ctx.runQuery(
      internal.domain.llm_calls.llm_request_repo.listOrphanedRequests,
      {},
    )) as Doc<"llm_requests">[];

    if (
      queued_batches.length === 0 &&
      running_batches.length === 0 &&
      queued_jobs.length === 0 &&
      running_jobs.length === 0 &&
      orphanedRequests.length === 0
    ) return;

    for (const batch of queued_batches) {
      if (!shouldRunAt(batch.next_poll_at, now)) continue;
      await workflow.start(
        ctx,
        internalAny.domain.orchestrator.process_workflows.processQueuedBatchWorkflow,
        { batch_id: batch._id },
        { startAsync: true },
      );
    }

    for (const batch of running_batches) {
      if (!shouldRunAt(batch.next_poll_at, now)) continue;
      await workflow.start(
        ctx,
        internalAny.domain.orchestrator.process_workflows.processRunningBatchWorkflow,
        { batch_id: batch._id },
        { startAsync: true },
      );
    }

    for (const job of queued_jobs) {
      if (!shouldRunAt(job.next_run_at, now)) continue;
      await workflow.start(
        ctx,
        internalAny.domain.orchestrator.process_workflows.processQueuedJobWorkflow,
        { job_id: job._id },
        { startAsync: true },
      );
    }

    for (const job of running_jobs) {
      if (!shouldRunAt(job.next_run_at, now)) continue;
      await workflow.start(
        ctx,
        internalAny.domain.orchestrator.process_workflows.processRunningJobWorkflow,
        { job_id: job._id },
        { startAsync: true },
      );
    }

    await ctx.scheduler.runAfter(
      ENGINE_SETTINGS.run_policy.poll_interval_ms,
      internal.domain.orchestrator.scheduler.runScheduler,
      {},
    );

    const result = {
      queued_batches: queued_batches.length,
      running_batches: running_batches.length,
      queued_jobs: queued_jobs.length,
      running_jobs: running_jobs.length,
      orphaned_requests: orphanedRequests.length,
    };
    console.info(result);
    return result;
  },
});
