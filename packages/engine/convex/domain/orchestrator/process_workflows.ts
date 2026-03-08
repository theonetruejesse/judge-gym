import z from "zod";
import { getNextRunAt, shouldRunAt } from "../../utils/scheduling";
import type { BatchWithRequestsResult } from "../llm_calls/llm_batch_repo";
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
import { internal } from "../../_generated/api";
import { zInternalAction } from "../../utils/custom_fns";
import { zid } from "convex-helpers/server/zod4";

const BATCH_POLL_LEASE_MS = 30_000;
const JOB_RUN_LEASE_MS = 30_000;

type WorkflowStep = Pick<ActionCtx, "runAction" | "runMutation" | "runQuery">;

function traceIdForCustomKey(customKey: string) {
  const [entity, id] = customKey.split(":");
  return `${entity}:${id}`;
}

function parseProcessCustomKey(customKey: string): {
  processType: "run" | "window";
  processId: string;
  stage: string;
} | null {
  const [processType, processId, stage] = customKey.split(":");
  if (!processType || !processId || !stage) return null;
  if (processType !== "run" && processType !== "window") return null;
  return { processType, processId, stage };
}

async function reconcileProcessStageAfterTransportFinalized(
  step: WorkflowStep,
  customKey: string,
) {
  const parsed = parseProcessCustomKey(customKey);
  if (!parsed) return;

  if (parsed.processType === "window") {
    await step.runMutation(
      internal.domain.window.window_service.reconcileWindowStage,
      {
        window_id: parsed.processId as Id<"windows">,
        stage: parsed.stage as "l0_raw" | "l1_cleaned" | "l2_neutralized" | "l3_abstracted",
      },
    );
    return;
  }

  await step.runMutation(
    internal.domain.runs.run_service.reconcileRunStage,
    {
      run_id: parsed.processId as Id<"runs">,
      stage: parsed.stage as "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic",
    },
  );
}

function classifyError(error: unknown): string {
  const value = String(error ?? "").toLowerCase();
  if (!value) return "unknown";
  if (value.includes("parse")) return "parse_error";
  if (value.includes("too many bytes read") || value.includes("convex") || value.includes("orchestrator")) {
    return "orchestrator_error";
  }
  if (value.includes("timeout")) return "timeout";
  if (value.includes("rate limit") || value.includes("429")) return "rate_limit";
  if (value.includes("provider") || value.includes("api") || value.includes("openai") || value.includes("5xx")) {
    return "api_error";
  }
  return "unknown";
}

function isTerminalApplyError(error: unknown): boolean {
  const cls = classifyError(error);
  return cls === "parse_error" || cls === "orchestrator_error";
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
  const owner = `${job._id}:${now}:${Math.random().toString(36).slice(2)}`;
  const claim = await step.runMutation(
    internal.domain.llm_calls.llm_job_repo.claimQueuedJobForRun,
    {
      job_id: job._id,
      owner,
      now,
      lease_ms: JOB_RUN_LEASE_MS,
    },
  );
  if (!claim.claimed) {
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(job.custom_key),
      entity_type: "job",
      entity_id: String(job._id),
      event_name: "job_run_claim_denied",
      status: "queued",
      custom_key: job.custom_key,
      stage: job.custom_key.split(":")[2] ?? null,
    });
    return;
  }
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(job.custom_key),
    entity_type: "job",
    entity_id: String(job._id),
    event_name: "job_run_claimed",
    status: "queued",
    custom_key: job.custom_key,
    stage: job.custom_key.split(":")[2] ?? null,
  });
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(job.custom_key),
    entity_type: "job",
    entity_id: String(job._id),
    event_name: "job_queued_handler_started",
    status: "queued",
    custom_key: job.custom_key,
    stage: job.custom_key.split(":")[2] ?? null,
  });

  try {
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

    const finalizeResult = await finalizeJob({
      ctx: step,
      job_id: job._id,
      owner,
      anyErrors,
      now: Date.now(),
    });
    if (finalizeResult.finalized) {
      await emitTraceEvent(step, {
        trace_id: traceIdForCustomKey(job.custom_key),
        entity_type: "job",
        entity_id: String(job._id),
        event_name: "job_finalized",
        status: anyErrors ? "error" : "success",
        custom_key: job.custom_key,
        stage: job.custom_key.split(":")[2] ?? null,
      });
      await reconcileProcessStageAfterTransportFinalized(step, job.custom_key);
    }
  } finally {
    await step.runMutation(
      internal.domain.llm_calls.llm_job_repo.releaseJobRunClaim,
      { job_id: job._id, owner },
    );
  }
}

export const processQueuedJobWorkflow = zInternalAction({
  args: z.object({ job_id: zid("llm_jobs") }),
  handler: async (ctx, args) => {
    await handleQueuedJobWorkflow(ctx, { job_id: args.job_id });
  },
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
  const owner = `${job._id}:${now}:${Math.random().toString(36).slice(2)}`;
  const claim = await step.runMutation(
    internal.domain.llm_calls.llm_job_repo.claimRunningJobForRun,
    {
      job_id: job._id,
      owner,
      now,
      lease_ms: JOB_RUN_LEASE_MS,
    },
  );
  if (!claim.claimed) {
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(job.custom_key),
      entity_type: "job",
      entity_id: String(job._id),
      event_name: "job_run_claim_denied",
      status: "running",
      custom_key: job.custom_key,
      stage: job.custom_key.split(":")[2] ?? null,
    });
    return;
  }
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(job.custom_key),
    entity_type: "job",
    entity_id: String(job._id),
    event_name: "job_run_claimed",
    status: "running",
    custom_key: job.custom_key,
    stage: job.custom_key.split(":")[2] ?? null,
  });
  await emitTraceEvent(step, {
    trace_id: traceIdForCustomKey(job.custom_key),
    entity_type: "job",
    entity_id: String(job._id),
    event_name: "job_running_polled",
    status: "running",
    custom_key: job.custom_key,
    stage: job.custom_key.split(":")[2] ?? null,
  });

  try {
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

    const finalizeResult = await finalizeJob({
      ctx: step,
      job_id: job._id,
      owner,
      anyErrors,
      now: Date.now(),
    });
    if (finalizeResult.finalized) {
      await emitTraceEvent(step, {
        trace_id: traceIdForCustomKey(job.custom_key),
        entity_type: "job",
        entity_id: String(job._id),
        event_name: "job_finalized",
        status: anyErrors ? "error" : "success",
        custom_key: job.custom_key,
        stage: job.custom_key.split(":")[2] ?? null,
      });
      await reconcileProcessStageAfterTransportFinalized(step, job.custom_key);
    }
  } finally {
    await step.runMutation(
      internal.domain.llm_calls.llm_job_repo.releaseJobRunClaim,
      { job_id: job._id, owner },
    );
  }
}

export const processRunningJobWorkflow = zInternalAction({
  args: z.object({ job_id: zid("llm_jobs") }),
  handler: async (ctx, args) => {
    await handleRunningJobWorkflow(ctx, { job_id: args.job_id });
  },
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

    const result = await submitBatch({ ctx: step, requests });
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

export const processQueuedBatchWorkflow = zInternalAction({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, args) => {
    await handleQueuedBatchWorkflow(ctx, { batch_id: args.batch_id });
  },
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
  if (!batch.batch_ref) {
    await emitTraceEvent(step, {
      trace_id: traceIdForCustomKey(batch.custom_key),
      entity_type: "batch",
      entity_id: String(batch._id),
      event_name: "batch_missing_ref",
      status: batch.status,
      custom_key: batch.custom_key,
      stage: batch.custom_key.split(":")[2] ?? null,
    });
    return;
  }
  const hasActiveLease = batch.poll_claim_owner != null
    && batch.poll_claim_expires_at != null
    && batch.poll_claim_expires_at > now;
  if (hasActiveLease) return;

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

    try {
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
      await reconcileProcessStageAfterTransportFinalized(step, batch.custom_key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const classified = classifyError(message);
      const terminal = isTerminalApplyError(error);

      await handleBatchError({
        ctx: step,
        batch,
        requests,
        error: `${terminal ? "terminal" : "retryable"}:${classified}:${message}`,
      });

      await emitTraceEvent(step, {
        trace_id: traceIdForCustomKey(batch.custom_key),
        entity_type: "batch",
        entity_id: String(batch._id),
        event_name: "batch_apply_error",
        status: "error",
        custom_key: batch.custom_key,
        stage: batch.custom_key.split(":")[2] ?? null,
        payload_json: JSON.stringify({
          error: message,
          class: classified,
          terminal,
        }),
      });
    }
  } finally {
    await step.runMutation(
      internal.domain.llm_calls.llm_batch_repo.releaseBatchPollClaim,
      { batch_id: batch._id, owner },
    );
  }
}

export const processRunningBatchWorkflow = zInternalAction({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, args) => {
    await handleRunningBatchWorkflow(ctx, { batch_id: args.batch_id });
  },
});
