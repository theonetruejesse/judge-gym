import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../../_generated/api";
import { v } from "convex/values";
import { getNextRunAt, shouldRunAt } from "../../utils/scheduling";
import { BatchWithRequestsResult } from "../llm_calls/llm_batch_repo";
import { markBatchEmpty, scheduleBatchPoll, handleBatchError, applyBatchResults, applyBatchRateLimitUsage, markBatchSuccess, submitBatch, markBatchRunning, checkBatchRateLimit } from "../llm_calls/llm_batch_service";
import { markJobRunning, runJobRequests, finalizeJob, scheduleJobRun } from "../llm_calls/llm_job_service";

export const processWorkflow = new WorkflowManager(components.workflow,
  {
    workpoolOptions: {
      // todo, check whether engine config is needed here
      defaultRetryBehavior: {
        maxAttempts: 3,
        initialBackoffMs: 100,
        base: 2,
      },
      retryActionsByDefault: true,
    }
  }
);

export const processQueuedJobWorkflow = processWorkflow.define({
  args: { job_id: v.id("llm_jobs") },
  handler: async (step, { job_id }) => {
    const now = Date.now();
    const { job, requests } = await step.runQuery(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id },
    );
    if (!job || job.status !== "queued") return;

    await markJobRunning({ ctx: step, job_id: job._id });

    const { anyPending, anyErrors } = await runJobRequests({
      ctx: step,
      requests,
      now,
    });

    if (anyPending) {
      await scheduleJobRun({ ctx: step, job_id: job._id, now });
      return;
    }

    await finalizeJob({ ctx: step, job_id: job._id, anyErrors });
  },
});

export const processRunningJobWorkflow = processWorkflow.define({
  args: { job_id: v.id("llm_jobs") },
  handler: async (step, { job_id }) => {
    const now = Date.now();
    const { job, requests } = await step.runQuery(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id },
    );
    if (!job || job.status !== "running") return;
    if (!shouldRunAt(job.next_run_at, now)) return;

    const { anyPending, anyErrors } = await runJobRequests({
      ctx: step,
      requests,
      now,
    });

    if (anyPending) {
      await scheduleJobRun({ ctx: step, job_id: job._id, now });
      return;
    }

    await finalizeJob({ ctx: step, job_id: job._id, anyErrors });
  },
});


export const processQueuedBatchWorkflow = processWorkflow.define({
  args: { batch_id: v.id("llm_batches") },
  handler: async (step, { batch_id }) => {
    const { batch, requests } = (await step.runQuery(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    )) as BatchWithRequestsResult;

    if (batch.status !== "queued") return;

    if (requests.length === 0) {
      await markBatchEmpty({ ctx: step, batch_id: batch._id });
      return;
    }

    const retryAfter = await checkBatchRateLimit({
      ctx: step,
      model: batch.model,
      requests,
    });
    if (retryAfter) {
      await scheduleBatchPoll({
        ctx: step,
        batch_id: batch._id,
        next_poll_at: retryAfter,
      });
      return;
    }

    const result = await submitBatch({ ctx: step, requests }); // todo, check error
    await markBatchRunning({ ctx: step, batch, batch_ref: result.batch_ref });
  },
});

export const processRunningBatchWorkflow = processWorkflow.define({
  args: { batch_id: v.id("llm_batches") },
  handler: async (step, { batch_id }) => {
    const { batch, requests } = (await step.runQuery(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    )) as BatchWithRequestsResult;

    if (batch.status !== "running") return;
    if (!shouldRunAt(batch.next_poll_at, Date.now())) return;
    if (!batch.batch_ref) return;

    const result = await step.runAction(
      internal.platform.providers.provider_services.pollOpenAiBatchAction,
      { batch_ref: batch.batch_ref },
    );

    if (result.status === "running") {
      await scheduleBatchPoll({
        ctx: step,
        batch_id: batch._id,
        next_poll_at: getNextRunAt(Date.now()),
      });
      return;
    }
    if (result.status === "error") {
      await handleBatchError({
        ctx: step,
        batch,
        requests,
        error: result.error,
      });
      return;
    }

    const counters = await applyBatchResults({
      ctx: step,
      requests,
      results: result.results,
      now: Date.now(),
    });
    await applyBatchRateLimitUsage({
      ctx: step,
      model: batch.model,
      totalInput: counters.totalInput,
      totalOutput: counters.totalOutput,
    });

    await markBatchSuccess({ ctx: step, batch_id: batch._id });
  },
});
