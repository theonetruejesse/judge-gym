import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../../_generated/api";
import { zid } from "convex-helpers/server/zod4";
import z from "zod";
import { zInternalAction } from "../../utils/custom_fns";
import { getNextRunAt, shouldRunAt } from "../../utils/scheduling";
import { BatchWithRequestsResult } from "../llm_calls/llm_batch_repo";
import { markBatchEmpty, scheduleBatchPoll, handleBatchError, applyBatchResults, applyBatchRateLimitUsage, markBatchSuccess, submitBatch, markBatchRunning, checkBatchRateLimit } from "../llm_calls/llm_batch_service";
import { markJobRunning, runJobRequests, finalizeJob, scheduleJobRun } from "../llm_calls/llm_job_service";

export const workflow = new WorkflowManager(components.workflow);

export const processQueuedJob = zInternalAction({
  args: z.object({ job_id: zid("llm_jobs") }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { job, requests } = await ctx.runQuery(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id: args.job_id },
    );
    if (!job || job.status !== "queued") return;

    await markJobRunning({ ctx, job_id: job._id });

    const { anyPending, anyErrors } = await runJobRequests({
      ctx,
      requests,
      now,
    });

    if (anyPending) {
      await scheduleJobRun({ ctx, job_id: job._id, now });
      return;
    }

    await finalizeJob({ ctx, job_id: job._id, anyErrors });
  },
});

export const processRunningJob = zInternalAction({
  args: z.object({ job_id: zid("llm_jobs") }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { job, requests } = await ctx.runQuery(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id: args.job_id },
    );
    if (!job || job.status !== "running") return;
    if (!shouldRunAt(job.next_run_at, now)) return;

    const { anyPending, anyErrors } = await runJobRequests({
      ctx,
      requests,
      now,
    });

    if (anyPending) {
      await scheduleJobRun({ ctx, job_id: job._id, now });
      return;
    }

    await finalizeJob({ ctx, job_id: job._id, anyErrors });
  },
});


export const processQueuedBatch = zInternalAction({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, args) => {
    const { batch, requests } = (await ctx.runQuery(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id: args.batch_id },
    )) as BatchWithRequestsResult;

    if (batch.status !== "queued") return;

    if (requests.length === 0) {
      await markBatchEmpty({ ctx, batch_id: batch._id });
      return;
    }

    const retryAfter = await checkBatchRateLimit({ ctx, model: batch.model, requests });
    if (retryAfter) {
      await scheduleBatchPoll({ ctx, batch_id: batch._id, next_poll_at: retryAfter });
      return;
    }

    const result = await submitBatch({ ctx, requests }); // todo, check error
    await markBatchRunning({ ctx, batch, batch_ref: result.batch_ref });
  },
});


export const processRunningBatch = zInternalAction({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, args) => {
    const { batch, requests } = (await ctx.runQuery(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id: args.batch_id },
    )) as BatchWithRequestsResult;

    if (batch.status !== "running") return;
    if (!shouldRunAt(batch.next_poll_at, Date.now())) return;
    if (!batch.batch_ref) return;

    const result = await ctx.runAction(
      internal.platform.providers.provider_services.pollOpenAiBatchAction,
      { batch_ref: batch.batch_ref },
    );

    if (result.status === "running") {
      await scheduleBatchPoll({ ctx, batch_id: batch._id, next_poll_at: getNextRunAt(Date.now()) });
      return;
    }
    if (result.status === "error") {
      await handleBatchError({
        ctx,
        batch,
        requests,
        error: result.error,
      });
      return;
    }

    const counters = await applyBatchResults({
      ctx,
      requests,
      results: result.results,
      now: Date.now(),
    });
    await applyBatchRateLimitUsage({
      ctx,
      model: batch.model,
      totalInput: counters.totalInput,
      totalOutput: counters.totalOutput,
    });

    await markBatchSuccess({ ctx, batch_id: batch._id });
  },
});

