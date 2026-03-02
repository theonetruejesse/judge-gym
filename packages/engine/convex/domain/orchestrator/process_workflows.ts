import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../../_generated/api";
import { v } from "convex/values";
import { getNextRunAt, shouldRunAt } from "../../utils/scheduling";
import { BatchWithRequestsResult } from "../llm_calls/llm_batch_repo";
import {
  applyBatchRateLimitUsage,
  applyBatchResults,
  checkBatchRateLimit,
  handleBatchError,
  markBatchEmpty,
  markBatchRunning,
  markBatchSuccess,
  scheduleBatchPoll,
  submitBatch,
} from "../llm_calls/llm_batch_service";
import {
  finalizeJob,
  markJobRunning,
  runJobRequests,
  scheduleJobRun,
} from "../llm_calls/llm_job_service";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { emitTraceEvent } from "../telemetry/emit";

export const processWorkflow = new WorkflowManager(components.workflow,
  {
    workpoolOptions: {
      // todo, check whether engine config is needed here
      defaultRetryBehavior: {
        maxAttempts: 3,
        initialBackoffMs: 100,
        base: 2,
      },
      maxParallelism: 25,
      retryActionsByDefault: true,
    }
  }
);

type WorkflowStep = Pick<ActionCtx, "runAction" | "runMutation" | "runQuery">;
const BATCH_POLL_LEASE_MS = 30_000;

function traceIdForCustomKey(customKey: string) {
  const [entity, id] = customKey.split(":");
  return `${entity}:${id}`;
}

export async function handleQueuedJobWorkflow(
  step: WorkflowStep,
  args: { job_id: Id<"llm_jobs"> },
) {
  const now = Date.now();
  const { job, requests } = await step.runQuery(
    internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
    { job_id: args.job_id },
  );
  if (!job || job.status !== "queued") return;
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(job.custom_key),
    entity_type: "job",
    entity_id: String(job._id),
    event_name: "job_queued_handler_started",
    status: "queued",
    custom_key: job.custom_key,
    stage: job.custom_key.split(":")[2] ?? null,
  });

  await markJobRunning({ ctx: step, job_id: job._id });

  const { anyPending, anyErrors } = await runJobRequests({
    ctx: step,
    requests,
    now,
  });

  if (anyPending) {
    await scheduleJobRun({ ctx: step, job_id: job._id, now });
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(job.custom_key),
      entity_type: "job",
      entity_id: String(job._id),
      event_name: "job_rescheduled",
      status: "running",
      custom_key: job.custom_key,
      stage: job.custom_key.split(":")[2] ?? null,
    });
    return;
  }

  await finalizeJob({ ctx: step, job_id: job._id, anyErrors });
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(job.custom_key),
    entity_type: "job",
    entity_id: String(job._id),
    event_name: "job_finalized",
    status: anyErrors ? "error" : "success",
    custom_key: job.custom_key,
    stage: job.custom_key.split(":")[2] ?? null,
  });
}

export const processQueuedJobWorkflow = processWorkflow.define({
  args: { job_id: v.id("llm_jobs") },
  handler: handleQueuedJobWorkflow,
});

export async function handleRunningJobWorkflow(
  step: WorkflowStep,
  args: { job_id: Id<"llm_jobs"> },
) {
  const now = Date.now();
  const { job, requests } = await step.runQuery(
    internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
    { job_id: args.job_id },
  );
  if (!job || job.status !== "running") return;
  if (!shouldRunAt(job.next_run_at, now)) return;
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(job.custom_key),
    entity_type: "job",
    entity_id: String(job._id),
    event_name: "job_running_polled",
    status: "running",
    custom_key: job.custom_key,
    stage: job.custom_key.split(":")[2] ?? null,
  });

  const { anyPending, anyErrors } = await runJobRequests({
    ctx: step,
    requests,
    now,
  });

  if (anyPending) {
    await scheduleJobRun({ ctx: step, job_id: job._id, now });
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(job.custom_key),
      entity_type: "job",
      entity_id: String(job._id),
      event_name: "job_rescheduled",
      status: "running",
      custom_key: job.custom_key,
      stage: job.custom_key.split(":")[2] ?? null,
    });
    return;
  }

  await finalizeJob({ ctx: step, job_id: job._id, anyErrors });
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(job.custom_key),
    entity_type: "job",
    entity_id: String(job._id),
    event_name: "job_finalized",
    status: anyErrors ? "error" : "success",
    custom_key: job.custom_key,
    stage: job.custom_key.split(":")[2] ?? null,
  });
}

export const processRunningJobWorkflow = processWorkflow.define({
  args: { job_id: v.id("llm_jobs") },
  handler: handleRunningJobWorkflow,
});


export async function handleQueuedBatchWorkflow(
  step: WorkflowStep,
  args: { batch_id: Id<"llm_batches"> },
) {
  const now = Date.now();
  const { batch, requests } = (await step.runQuery(
    internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
    { batch_id: args.batch_id },
  )) as BatchWithRequestsResult;

  if (batch.status !== "queued") return;
  const owner = `${batch._id}:${now}:${Math.random().toString(36).slice(2)}`;
  const claim = await step.runMutation(
    internal.domain.llm_calls.llm_batch_repo.claimQueuedBatchForSubmit,
    {
      batch_id: batch._id,
      owner,
      now,
      lease_ms: BATCH_POLL_LEASE_MS,
    },
  );
  if (!claim.claimed) {
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(batch.custom_key),
      entity_type: "batch",
      entity_id: String(batch._id),
      event_name: "batch_submit_claim_denied",
      status: "queued",
      custom_key: batch.custom_key,
      stage: batch.custom_key.split(":")[2] ?? null,
    });
    return;
  }
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(batch.custom_key),
    entity_type: "batch",
    entity_id: String(batch._id),
    event_name: "batch_submit_claimed",
    status: "queued",
    custom_key: batch.custom_key,
    stage: batch.custom_key.split(":")[2] ?? null,
  });

  try {
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(batch.custom_key),
      entity_type: "batch",
      entity_id: String(batch._id),
      event_name: "batch_queued_handler_started",
      status: "queued",
      custom_key: batch.custom_key,
      stage: batch.custom_key.split(":")[2] ?? null,
    });

    if (requests.length === 0) {
      await markBatchEmpty({ ctx: step, batch_id: batch._id });
      await emitTraceEvent(step, {
        trace_id: traceIdForCustomKey(batch.custom_key),
        entity_type: "batch",
        entity_id: String(batch._id),
        event_name: "batch_marked_empty",
        status: "success",
        custom_key: batch.custom_key,
        stage: batch.custom_key.split(":")[2] ?? null,
      });
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
      await emitTraceEvent(step, {
        trace_id: traceIdForCustomKey(batch.custom_key),
        entity_type: "batch",
        entity_id: String(batch._id),
        event_name: "batch_rate_limited",
        status: "queued",
        custom_key: batch.custom_key,
        stage: batch.custom_key.split(":")[2] ?? null,
        payload_json: JSON.stringify({ retry_after: retryAfter }),
      });
      return;
    }

    const result = await submitBatch({ ctx: step, requests }); // todo, check error
    await markBatchRunning({ ctx: step, batch, batch_ref: result.batch_ref });
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(batch.custom_key),
      entity_type: "batch",
      entity_id: String(batch._id),
      event_name: "batch_submitted",
      status: "running",
      custom_key: batch.custom_key,
      stage: batch.custom_key.split(":")[2] ?? null,
      payload_json: JSON.stringify({ batch_ref: result.batch_ref }),
    });
  } finally {
    await step.runMutation(
      internal.domain.llm_calls.llm_batch_repo.releaseBatchPollClaim,
      { batch_id: batch._id, owner },
    );
  }
}

export const processQueuedBatchWorkflow = processWorkflow.define({
  args: { batch_id: v.id("llm_batches") },
  handler: handleQueuedBatchWorkflow,
});

export async function handleRunningBatchWorkflow(
  step: WorkflowStep,
  args: { batch_id: Id<"llm_batches"> },
) {
  const now = Date.now();
  const { batch, requests } = (await step.runQuery(
    internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
    { batch_id: args.batch_id },
  )) as BatchWithRequestsResult;

  if (batch.status !== "running" && batch.status !== "finalizing") return;
  if (!shouldRunAt(batch.next_poll_at, now)) return;
  if (!batch.batch_ref) return;
  const owner = `${batch._id}:${now}:${Math.random().toString(36).slice(2)}`;
  const claim = await step.runMutation(
    internal.domain.llm_calls.llm_batch_repo.claimRunningBatchForPoll,
    {
      batch_id: batch._id,
      owner,
      now,
      lease_ms: BATCH_POLL_LEASE_MS,
    },
  );
  if (!claim.claimed) {
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(batch.custom_key),
      entity_type: "batch",
      entity_id: String(batch._id),
      event_name: "batch_poll_claim_denied",
      status: batch.status,
      custom_key: batch.custom_key,
      stage: batch.custom_key.split(":")[2] ?? null,
    });
    return;
  }
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(batch.custom_key),
    entity_type: "batch",
    entity_id: String(batch._id),
    event_name: "batch_poll_claimed",
    status: batch.status,
    custom_key: batch.custom_key,
    stage: batch.custom_key.split(":")[2] ?? null,
  });

  try {
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(batch.custom_key),
      entity_type: "batch",
      entity_id: String(batch._id),
      event_name: "batch_polled",
      status: batch.status,
      custom_key: batch.custom_key,
      stage: batch.custom_key.split(":")[2] ?? null,
    });

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
      await emitTraceEvent(step, {
        trace_id: traceIdForCustomKey(batch.custom_key),
        entity_type: "batch",
        entity_id: String(batch._id),
        event_name: "batch_still_running",
        status: "running",
        custom_key: batch.custom_key,
        stage: batch.custom_key.split(":")[2] ?? null,
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
      await emitTraceEvent(step, {
        trace_id: traceIdForCustomKey(batch.custom_key),
        entity_type: "batch",
        entity_id: String(batch._id),
        event_name: "batch_poll_error",
        status: "error",
        custom_key: batch.custom_key,
        stage: batch.custom_key.split(":")[2] ?? null,
        payload_json: JSON.stringify({ error: result.error }),
      });
      return;
    }

    const markedFinalizing = await step.runMutation(
      internal.domain.llm_calls.llm_batch_repo.markBatchFinalizing,
      {
        batch_id: batch._id,
        owner,
        now: Date.now(),
        lease_ms: BATCH_POLL_LEASE_MS,
      },
    );
    if (!markedFinalizing.ok) return;
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(batch.custom_key),
      entity_type: "batch",
      entity_id: String(batch._id),
      event_name: "batch_finalizing_started",
      status: "finalizing",
      custom_key: batch.custom_key,
      stage: batch.custom_key.split(":")[2] ?? null,
    });

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
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(batch.custom_key),
      entity_type: "batch",
      entity_id: String(batch._id),
      event_name: "batch_success",
      status: "success",
      custom_key: batch.custom_key,
      stage: batch.custom_key.split(":")[2] ?? null,
      payload_json: JSON.stringify({
        total_input: counters.totalInput,
        total_output: counters.totalOutput,
        missing_results: counters.missingResultCount,
      }),
    });
  } finally {
    await step.runMutation(
      internal.domain.llm_calls.llm_batch_repo.releaseBatchPollClaim,
      { batch_id: batch._id, owner },
    );
  }
}

export const processRunningBatchWorkflow = processWorkflow.define({
  args: { batch_id: v.id("llm_batches") },
  handler: handleRunningBatchWorkflow,
});
