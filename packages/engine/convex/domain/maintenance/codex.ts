import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";
import { zAction, zMutation, zQuery } from "../../utils/custom_fns";
import { RunStageSchema } from "../../models/experiments";
import { SemanticLevelSchema } from "../../models/_shared";
import { buildAxiomEventEnvelope, buildExternalTraceRef } from "../telemetry/events";
import { getExperimentTotalCount } from "../runs/experiment_progress";
import { getSampleScoreCounts } from "../runs/sample_progress";
import { getRunCompletedCount, getRunStageProgress } from "../runs/run_progress";

const ProcessTypeSchema = z.enum(["run", "window"]);
const DebugActionTypeSchema = z.enum([
  "start_scheduler_if_idle",
  "requeue_orphan_request",
  "requeue_retryable_request",
  "release_expired_batch_claim",
  "nudge_batch_poll_now",
]);

const WindowStageSchema = z.enum(["l1_cleaned", "l2_neutralized", "l3_abstracted"]);

const StageProgressSchema = z.object({
  stage: z.string(),
  target_total: z.number(),
  completed: z.number(),
  pending: z.number(),
  failed: z.number(),
});

const RequestStateMetaSchema = z.object({
  approximate: z.boolean(),
  scanned_targets: z.number(),
  latest_updated_at_ms: z.number().nullable(),
});

const HealthSummarySchema = z.object({
  process_type: ProcessTypeSchema,
  process_id: z.string(),
  trace_id: z.string(),
  telemetry_backend: z.literal("axiom"),
  external_trace_ref: z.string().nullable(),
  status: z.string(),
  current_stage: z.string(),
  stage_progress: z.array(StageProgressSchema),
  active_transport: z.object({
    queued_batches: z.number(),
    running_batches: z.number(),
    queued_jobs: z.number(),
    running_jobs: z.number(),
    orphaned_requests: z.number(),
  }),
  stalled_signals: z.object({
    no_progress_for_ms: z.number().nullable(),
    oldest_pending_request_age_ms: z.number().nullable(),
    scheduler_scheduled: z.boolean(),
  }),
  request_state_meta: RequestStateMetaSchema,
  error_summary: z.array(
    z.object({
      class: z.string(),
      count: z.number(),
    }),
  ),
  historical_error_summary: z.array(
    z.object({
      class: z.string(),
      count: z.number(),
    }),
  ),
  recent_events: z.array(
    z.object({
      seq: z.number(),
      ts_ms: z.number(),
      event_name: z.string(),
      stage: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      entity_type: z.string(),
      entity_id: z.string(),
      custom_key: z.string().nullable().optional(),
      payload_json: z.string().nullable().optional(),
    }),
  ),
  entity_states: z.array(
    z.object({
      entity_type: z.string(),
      entity_id: z.string(),
      last_event_name: z.string(),
      last_status: z.string().nullable().optional(),
      last_stage: z.string().nullable().optional(),
      last_ts_ms: z.number(),
    }),
  ),
});

const StuckReasonSchema = z.enum([
  "batch_missing_ref",
  "finalizing_no_progress",
  "pending_request_no_owner",
  "raw_collection_no_progress",
  "stage_waiting_on_exhausted_requests",
  "scheduler_not_running",
]);

const StuckWorkSchema = z.object({
  process_type: ProcessTypeSchema,
  process_id: z.string(),
  reason: StuckReasonSchema,
  entity_type: z.string(),
  entity_id: z.string(),
  custom_key: z.string().nullable().optional(),
  age_ms: z.number().nullable().optional(),
  details: z.string(),
});

const DebugActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_scheduler_if_idle") }),
  z.object({ action: z.literal("requeue_orphan_request"), request_id: zid("llm_requests") }),
  z.object({ action: z.literal("requeue_retryable_request"), request_id: zid("llm_requests") }),
  z.object({ action: z.literal("release_expired_batch_claim"), batch_id: zid("llm_batches") }),
  z.object({ action: z.literal("nudge_batch_poll_now"), batch_id: zid("llm_batches") }),
]);

const DebugActionResultSchema = z.object({
  action: DebugActionTypeSchema,
  entity_id: z.string().nullable().optional(),
  status: z.enum(["applied", "skipped", "failed"]),
  reason: z.string(),
});

const AnalyzeStageSummarySchema = z.object({
  stage: z.string(),
  first_ts_ms: z.number().nullable(),
  last_ts_ms: z.number().nullable(),
  duration_ms: z.number().nullable(),
  route: z.enum(["job", "batch", "mixed", "none"]),
  request_applied: z.number(),
  request_apply_duplicate_success: z.number(),
  request_error: z.number(),
  job_queued_handler_started: z.number(),
  job_running_polled: z.number(),
  job_finalized: z.number(),
  batch_queued_handler_started: z.number(),
  batch_polled: z.number(),
  batch_success: z.number(),
  batch_poll_claim_denied: z.number(),
  batch_submit_claim_denied: z.number(),
});

const ProcessTelemetryAnalysisSchema = z.object({
  process_type: ProcessTypeSchema,
  process_id: z.string(),
  trace_id: z.string(),
  telemetry_backend: z.literal("axiom"),
  external_trace_ref: z.string().nullable(),
  sampled_events: z.number(),
  reached_end_of_trace: z.boolean(),
  seq_min: z.number().nullable(),
  seq_max: z.number().nullable(),
  missing_seq_count: z.number(),
  duplicate_seq_count: z.number(),
  first_ts_ms: z.number().nullable(),
  last_ts_ms: z.number().nullable(),
  duration_ms: z.number().nullable(),
  event_counts: z.array(z.object({
    event_name: z.string(),
    count: z.number(),
  })),
  stage_summaries: z.array(AnalyzeStageSummarySchema),
  request_stats: z.object({
    unique_request_entities: z.number(),
    request_applied_total: z.number(),
    duplicate_apply_success_total: z.number(),
    requests_with_duplicate_apply_success: z.number(),
    max_duplicate_apply_success_per_request: z.number(),
  }),
  job_stats: z.object({
    unique_job_entities: z.number(),
    job_finalized_total: z.number(),
    jobs_finalized_multiple_times: z.number(),
    max_job_finalized_per_job: z.number(),
  }),
  terminal_stats: z.object({
    terminal_event_name: z.string().nullable(),
    terminal_seq: z.number().nullable(),
    events_after_terminal: z.number(),
  }),
});

type ProcessMembership = {
  process_type: "run" | "window";
  process_id: string;
  trace_id: string;
  status: string;
  current_stage: string;
  sampleIds: Set<string>;
  scoreTargetIds: Set<string>;
  evidenceIds: Set<string>;
};

type RequestTargetState = {
  target_type: "sample" | "sample_score_target" | "evidence";
  target_id: string;
  stage: string;
  custom_key: string;
  resolution: "pending" | "retryable" | "exhausted" | "succeeded";
  active_request_id: Id<"llm_requests"> | null;
  latest_request_id: Id<"llm_requests"> | null;
  success_request_id: Id<"llm_requests"> | null;
  latest_error_request_id: Id<"llm_requests"> | null;
  attempt_count: number;
  retry_count: number;
  historical_error_count: number;
  oldest_pending_ts: number | null;
  latest_error_class: string | null;
  latest_error_message: string | null;
};

type TraceEvent = {
  trace_id: string;
  seq: number;
  entity_type: "window" | "run" | "batch" | "job" | "request" | "scheduler";
  entity_id: string;
  event_name: string;
  stage?: string | null;
  status?: string | null;
  custom_key?: string | null;
  attempt?: number | null;
  ts_ms: number;
  payload_json?: string | null;
};

type StageProgressSummary = {
  progress: Array<z.infer<typeof StageProgressSchema>>;
  terminalErrorClasses: string[];
  historicalErrorClasses: string[];
  oldestPendingTs: number | null;
};

const RUN_STAGES: Array<z.infer<typeof RunStageSchema>> = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
];

const WINDOW_STAGES: Array<z.infer<typeof WindowStageSchema>> = [
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
];

const SCHEDULER_SCAN_MAX_ROWS = 2_000;
const SCHEDULER_LOCK_SCAN_MAX_ROWS = 8;
const SCHEDULER_HEARTBEAT_GRACE_MS = 30_000;
const STUCK_BATCH_SCAN_MAX_ROWS = 2_000;
const STUCK_PROCESS_SCAN_MAX_ROWS = 300;
const PROCESS_MEMBERSHIP_SCAN_MAX_ROWS = 2_500;
const PROCESS_TARGET_STATE_SCAN_MAX_ROWS = 3_000;
const STAGE_ARTIFACT_SCAN_MAX_ROWS = 3_000;
const STUCK_HEALTH_CHECK_MAX_PROCESSES = 40;
const AUTO_HEAL_STAGE_SCAN_MAX = 1_200;
const AUTO_HEAL_DEFAULT_MAX_ACTIONS = 120;

function parseCustomKey(key: string) {
  const [targetType, targetId, stage] = key.split(":");
  return {
    targetType,
    targetId,
    stage,
  };
}

function isSchedulerRun(name: string): boolean {
  return (
    name === "domain/orchestrator/scheduler:runScheduler"
    || name === "domain/orchestrator/scheduler.js:runScheduler"
  );
}

async function hasScheduledScheduler(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const now = Date.now();
  const locks = await ctx.db
    .query("scheduler_locks")
    .withIndex("by_lock_key", (q) => q.eq("lock_key", "scheduler_lock"))
    .take(SCHEDULER_LOCK_SCAN_MAX_ROWS);
  const hasLiveLock = locks.some((lock) =>
    (lock.status === "running" && lock.expires_at_ms > now)
    || lock.heartbeat_ts_ms >= now - SCHEDULER_HEARTBEAT_GRACE_MS,
  );
  if (hasLiveLock) return true;

  try {
    const scheduled = await ctx.db.system
      .query("_scheduled_functions")
      .order("desc")
      .take(Math.min(SCHEDULER_SCAN_MAX_ROWS, 200));
    return scheduled.some((row) => isSchedulerRun(row.name) && row.completedTime == null);
  } catch {
    return false;
  }
}

async function buildMembership(
  ctx: QueryCtx | MutationCtx,
  process_type: "run" | "window",
  process_id: string,
): Promise<ProcessMembership | null> {
  if (process_type === "run") {
    const run = await ctx.db.get(process_id as Id<"runs">);
    if (!run) return null;
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", run._id))
      .take(PROCESS_MEMBERSHIP_SCAN_MAX_ROWS);
    const scoreTargets = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", run._id))
      .take(PROCESS_MEMBERSHIP_SCAN_MAX_ROWS);

    return {
      process_type,
      process_id,
      trace_id: `run:${run._id}`,
      status: run.status,
      current_stage: run.current_stage,
      sampleIds: new Set(samples.map((row) => String(row._id))),
      scoreTargetIds: new Set(scoreTargets.map((row) => String(row._id))),
      evidenceIds: new Set(),
    };
  }

  const window = await ctx.db.get(process_id as Id<"windows">);
  if (!window) return null;
  const evidences = await ctx.db
    .query("evidences")
    .withIndex("by_window_id", (q) => q.eq("window_id", window._id))
    .take(PROCESS_MEMBERSHIP_SCAN_MAX_ROWS);
  return {
    process_type,
    process_id,
    trace_id: `window:${window._id}`,
    status: window.status,
    current_stage: window.current_stage,
    sampleIds: new Set(),
    scoreTargetIds: new Set(),
    evidenceIds: new Set(evidences.map((row) => String(row._id))),
  };
}

async function listProcessRequestTargetStates(
  ctx: QueryCtx | MutationCtx,
  membership: ProcessMembership,
): Promise<{ rows: RequestTargetState[]; approximate: boolean; latest_updated_at_ms: number | null }> {
  const snapshotRows = await ctx.db
    .query("process_request_targets")
    .withIndex("by_process", (q) =>
      q.eq("process_type", membership.process_type).eq("process_id", membership.process_id),
    )
    .take(PROCESS_TARGET_STATE_SCAN_MAX_ROWS);
  const aggregate = new Map<string, RequestTargetState>();
  for (const row of snapshotRows) {
    aggregate.set(row.custom_key, {
      target_type: row.target_type,
      target_id: row.target_id,
      stage: row.stage,
      custom_key: row.custom_key,
      resolution: row.resolution,
      active_request_id: row.active_request_id,
      latest_request_id: row.latest_request_id,
      success_request_id: row.success_request_id,
      latest_error_request_id: row.latest_error_request_id,
      attempt_count: row.attempt_count,
      retry_count: row.retry_count,
      historical_error_count: row.historical_error_count,
      oldest_pending_ts: row.oldest_pending_ts,
      latest_error_class: row.latest_error_class,
      latest_error_message: row.latest_error_message,
    });
  }

  return {
    rows: [...aggregate.values()],
    approximate: snapshotRows.length === PROCESS_TARGET_STATE_SCAN_MAX_ROWS,
    latest_updated_at_ms: snapshotRows.length > 0
      ? Math.max(...snapshotRows.map((row) => row.updated_at_ms))
      : null,
  };
}

function isTargetFailed(targetState: RequestTargetState | undefined): boolean {
  if (!targetState) return false;
  return targetState.resolution === "exhausted";
}

function appendErrorClass(
  state: RequestTargetState | undefined,
  sink: string[],
) {
  if (!state || !state.latest_error_class) return;
  sink.push(state.latest_error_class);
}

function considerOldestPending(
  state: RequestTargetState | undefined,
  sink: number[],
) {
  if (!state || state.resolution !== "pending" || state.oldest_pending_ts == null) return;
  sink.push(state.oldest_pending_ts);
}

function buildTargetStateIndex(
  rows: RequestTargetState[],
): Map<string, RequestTargetState> {
  const byKey = new Map<string, RequestTargetState>();
  for (const row of rows) {
    byKey.set(row.custom_key, row);
  }
  return byKey;
}

async function buildRunStageProgress(
  ctx: QueryCtx | MutationCtx,
  run_id: Id<"runs">,
  targetStates: Map<string, RequestTargetState>,
): Promise<StageProgressSummary> {
  const pendingTimes: number[] = [];
  const terminalErrorClasses: string[] = [];
  const historicalErrorClasses: string[] = [];
  for (const state of targetStates.values()) {
    considerOldestPending(state, pendingTimes);
    appendErrorClass(state, historicalErrorClasses);
    if (isTargetFailed(state)) {
      appendErrorClass(state, terminalErrorClasses);
    }
  }

  const stageRows = await Promise.all(
    RUN_STAGES.map(async (stage) => {
      const progress = await getRunStageProgress(ctx, run_id, stage);
      const targetTotal = progress?.total ?? 0;
      const completed = progress?.completed ?? 0;
      const failed = progress?.failed ?? 0;
      const pending = Math.max(0, targetTotal - completed - failed);
      return {
        stage,
        target_total: targetTotal,
        completed,
        pending,
        failed,
      };
    }),
  );

  return {
    progress: stageRows,
    terminalErrorClasses,
    historicalErrorClasses,
    oldestPendingTs: pendingTimes.length > 0 ? Math.min(...pendingTimes) : null,
  };
}

async function buildWindowStageProgress(
  ctx: QueryCtx | MutationCtx,
  window_id: Id<"windows">,
  targetStates: Map<string, RequestTargetState>,
): Promise<StageProgressSummary> {
  const evidences = await ctx.db
    .query("evidences")
    .withIndex("by_window_id", (q) => q.eq("window_id", window_id))
    .take(STAGE_ARTIFACT_SCAN_MAX_ROWS);

  const pendingTimes: number[] = [];
  const terminalErrorClasses: string[] = [];
  const historicalErrorClasses: string[] = [];
  const progress = [] as Array<z.infer<typeof StageProgressSchema>>;

  for (const stage of WINDOW_STAGES) {
    const total = evidences.length;
    let completed = 0;
    let failed = 0;

    for (const evidence of evidences) {
      const key = `evidence:${evidence._id}:${stage}`;
      const state = targetStates.get(key);
      const stageCompleted = stage === "l1_cleaned"
        ? Boolean(evidence.l1_cleaned_content)
        : stage === "l2_neutralized"
          ? Boolean(evidence.l2_neutralized_content)
          : Boolean(evidence.l3_abstracted_content);

      if (stageCompleted) completed += 1;
      if (!stageCompleted && isTargetFailed(state)) failed += 1;
      considerOldestPending(state, pendingTimes);
      appendErrorClass(state, historicalErrorClasses);
      if (!stageCompleted && isTargetFailed(state)) {
        appendErrorClass(state, terminalErrorClasses);
      }
    }

    const pending = Math.max(0, total - completed - failed);
    progress.push({
      stage,
      target_total: total,
      completed,
      pending,
      failed,
    });
  }

  return {
    progress,
    terminalErrorClasses,
    historicalErrorClasses,
    oldestPendingTs: pendingTimes.length > 0 ? Math.min(...pendingTimes) : null,
  };
}

function parseProcessFromCustomKey(customKey: string): {
  process_type: "run" | "window" | null;
  process_id: string | null;
} {
  const [processType, processId] = customKey.split(":");
  if ((processType === "run" || processType === "window") && processId) {
    return { process_type: processType, process_id: processId };
  }
  return { process_type: null, process_id: null };
}

function requestBelongsToMembership(
  membership: ProcessMembership,
  request: Doc<"llm_requests">,
): boolean {
  const parsed = parseCustomKey(request.custom_key);
  if (!parsed.targetId || !parsed.stage) return false;

  if (membership.process_type === "run") {
    if (parsed.targetType === "sample") {
      return membership.sampleIds.has(parsed.targetId);
    }
    if (parsed.targetType === "sample_score_target") {
      return membership.scoreTargetIds.has(parsed.targetId);
    }
    return false;
  }

  return parsed.targetType === "evidence" && membership.evidenceIds.has(parsed.targetId);
}

function stageNamesForProcess(processType: "run" | "window"): string[] {
  return processType === "run"
    ? [...RUN_STAGES]
    : [...WINDOW_STAGES];
}

async function listActiveBatchesForProcess(
  ctx: QueryCtx | MutationCtx,
  processType: "run" | "window",
  processId: string,
): Promise<Doc<"llm_batches">[]> {
  const statuses = ["submitting", "running", "finalizing"] as const;
  const rows: Doc<"llm_batches">[] = [];
  for (const stage of stageNamesForProcess(processType)) {
    const customKey = `${processType}:${processId}:${stage}`;
    for (const status of statuses) {
      const batch = await ctx.db
        .query("llm_batches")
        .withIndex("by_custom_key_status", (q) =>
          q.eq("custom_key", customKey).eq("status", status),
        )
        .first();
      if (batch) rows.push(batch);
    }
  }
  return rows;
}

async function executeDebugAction(
  ctx: MutationCtx,
  dryRun: boolean,
  action: z.infer<typeof DebugActionSchema>,
): Promise<z.infer<typeof DebugActionResultSchema>> {
  const now = Date.now();

  if (action.action === "start_scheduler_if_idle") {
    const [batchState, jobState, orphaned, schedulerScheduled] = await Promise.all([
      ctx.runQuery(internal.domain.llm_calls.llm_batch_repo.listActiveBatches, {}),
      ctx.runQuery(internal.domain.llm_calls.llm_job_repo.listActiveJobs, {}),
      ctx.runQuery(internal.domain.llm_calls.llm_request_repo.listOrphanedRequests, {}),
      hasScheduledScheduler(ctx),
    ]);

    const hasActiveWork =
      batchState.queued_batches.length > 0
      || batchState.running_batches.length > 0
      || jobState.queued_jobs.length > 0
      || jobState.running_jobs.length > 0
      || orphaned.length > 0;
    if (!hasActiveWork) {
      return {
        action: action.action,
        status: "skipped",
        reason: "No active orchestration work",
      };
    }
    if (schedulerScheduled) {
      return {
        action: action.action,
        status: "skipped",
        reason: "Scheduler already scheduled",
      };
    }
    if (!dryRun) {
      await ctx.runMutation(internal.domain.orchestrator.scheduler.startScheduler, {});
    }
    return {
      action: action.action,
      status: "applied",
      reason: dryRun ? "Dry run: would schedule scheduler" : "Scheduler started",
    };
  }

  if (action.action === "requeue_orphan_request") {
    const request = await ctx.runQuery(internal.domain.llm_calls.llm_request_repo.getLlmRequest, {
      request_id: action.request_id,
    });
    if (request.status !== "pending" || request.batch_id != null || request.job_id != null) {
      return {
        action: action.action,
        entity_id: String(request._id),
        status: "skipped",
        reason: "Request is not orphaned pending work",
      };
    }
    if (!dryRun) {
      await ctx.runMutation(internal.domain.orchestrator.scheduler.requeueRequest, {
        request_id: request._id,
      });
    }
    return {
      action: action.action,
      entity_id: String(request._id),
      status: "applied",
      reason: dryRun ? "Dry run: would requeue orphan request" : "Orphan request requeued",
    };
  }

  if (action.action === "requeue_retryable_request") {
    const request = await ctx.runQuery(internal.domain.llm_calls.llm_request_repo.getLlmRequest, {
      request_id: action.request_id,
    });
    if (request.status !== "error") {
      return {
        action: action.action,
        entity_id: String(request._id),
        status: "skipped",
        reason: "Request is not in error state",
      };
    }
    const attemptIndex = request.attempt_index ?? 1;
    if (attemptIndex >= ENGINE_SETTINGS.run_policy.max_request_attempts) {
      return {
        action: action.action,
        entity_id: String(request._id),
        status: "skipped",
        reason: "Request is exhausted",
      };
    }
    const pendingReplacement = await ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", request.custom_key).eq("status", "pending"),
      )
      .first();
    if (pendingReplacement) {
      return {
        action: action.action,
        entity_id: String(request._id),
        status: "skipped",
        reason: "A pending replacement already exists",
      };
    }
    if (!dryRun) {
      await ctx.runMutation(internal.domain.orchestrator.scheduler.requeueRequest, {
        request_id: request._id,
      });
    }
    return {
      action: action.action,
      entity_id: String(request._id),
      status: "applied",
      reason: dryRun ? "Dry run: would requeue retryable request" : "Retryable request requeued",
    };
  }

  if (action.action === "release_expired_batch_claim") {
    const batch = await ctx.db.get(action.batch_id);
    if (!batch) {
      return {
        action: action.action,
        entity_id: String(action.batch_id),
        status: "skipped",
        reason: "Batch not found",
      };
    }
    const claimOwner = batch.poll_claim_owner ?? null;
    const claimExpiresAt = batch.poll_claim_expires_at ?? null;
    if (claimOwner == null || claimExpiresAt == null || claimExpiresAt > now) {
      return {
        action: action.action,
        entity_id: String(action.batch_id),
        status: "skipped",
        reason: "No expired claim to release",
      };
    }
    if (!dryRun) {
      await ctx.runMutation(
        internal.domain.llm_calls.llm_batch_repo.releaseExpiredBatchPollClaim,
        {
          batch_id: action.batch_id,
          now,
        },
      );
    }
    return {
      action: action.action,
      entity_id: String(action.batch_id),
      status: "applied",
      reason: dryRun ? "Dry run: would release expired claim" : "Released expired claim",
    };
  }

  const batch = await ctx.db.get(action.batch_id);
  if (!batch || (batch.status !== "submitting" && batch.status !== "running" && batch.status !== "finalizing")) {
    return {
      action: action.action,
      entity_id: String(action.batch_id),
      status: "skipped",
      reason: "Batch not in pollable state",
    };
  }
  if (!dryRun) {
    await ctx.runMutation(internal.domain.llm_calls.llm_batch_repo.nudgeBatchPollNow, {
      batch_id: action.batch_id,
      now,
    });
  }
  return {
    action: action.action,
    entity_id: String(action.batch_id),
    status: "applied",
    reason: dryRun ? "Dry run: would nudge batch poll" : "Batch poll nudged",
  };
}

async function collectProcessHealth(
  ctx: QueryCtx | MutationCtx,
  args: {
    process_type: "run" | "window";
    process_id: string;
    include_recent_events?: number;
  },
): Promise<z.infer<typeof HealthSummarySchema>> {
  const membership = await buildMembership(ctx, args.process_type, args.process_id);
  if (!membership) {
    throw new Error(`${args.process_type} not found: ${args.process_id}`);
  }

  const [batchState, jobState, orphanedRequests, schedulerScheduled, stateRowsResult] = await Promise.all([
    ctx.runQuery(internal.domain.llm_calls.llm_batch_repo.listActiveBatches, {}),
    ctx.runQuery(internal.domain.llm_calls.llm_job_repo.listActiveJobs, {}),
    ctx.runQuery(internal.domain.llm_calls.llm_request_repo.listOrphanedRequests, {}),
    hasScheduledScheduler(ctx),
    listProcessRequestTargetStates(ctx, membership),
  ]);

  const processPrefix = `${membership.process_type}:${membership.process_id}:`;
  const queuedBatches = batchState.queued_batches.filter((row: Doc<"llm_batches">) =>
    row.custom_key.startsWith(processPrefix),
  );
  const runningBatches = batchState.running_batches.filter((row: Doc<"llm_batches">) =>
    row.custom_key.startsWith(processPrefix),
  );
  const queuedJobs = jobState.queued_jobs.filter((row: Doc<"llm_jobs">) =>
    row.custom_key.startsWith(processPrefix),
  );
  const runningJobs = jobState.running_jobs.filter((row: Doc<"llm_jobs">) =>
    row.custom_key.startsWith(processPrefix),
  );

  const memberOrphans = orphanedRequests.filter((row: Doc<"llm_requests">) =>
    requestBelongsToMembership(membership, row),
  );

  const stateByCustomKey = buildTargetStateIndex(stateRowsResult.rows);
  const stageSummary = membership.process_type === "run"
    ? await buildRunStageProgress(ctx, membership.process_id as Id<"runs">, stateByCustomKey)
    : await buildWindowStageProgress(ctx, membership.process_id as Id<"windows">, stateByCustomKey);

  const observability = await ctx.runQuery(
    internal.domain.telemetry.events.getProcessObservability,
    {
      process_type: membership.process_type,
      process_id: membership.process_id,
    },
  );

  const latestProgressTs = Math.max(
    observability?.updated_at_ms ?? 0,
    stateRowsResult.latest_updated_at_ms ?? 0,
  );
  const noProgressForMs = latestProgressTs > 0
    ? Math.max(0, Date.now() - latestProgressTs)
    : null;

  const oldestPendingRequestAgeMs = stageSummary.oldestPendingTs == null
    ? null
    : Math.max(0, Date.now() - stageSummary.oldestPendingTs);

  const errorCounts = new Map<string, number>();
  for (const errorClass of stageSummary.terminalErrorClasses) {
    errorCounts.set(errorClass, (errorCounts.get(errorClass) ?? 0) + 1);
  }

  const historicalErrorCounts = new Map<string, number>();
  for (const errorClass of stageSummary.historicalErrorClasses) {
    historicalErrorCounts.set(
      errorClass,
      (historicalErrorCounts.get(errorClass) ?? 0) + 1,
    );
  }

  const recentLimit = args.include_recent_events ?? 50;
  const recentRows = recentLimit <= 0
    ? []
    : (observability?.recent_events ?? []).slice(-recentLimit);

  return {
    process_type: membership.process_type,
    process_id: membership.process_id,
    trace_id: membership.trace_id,
    telemetry_backend: "axiom" as const,
    external_trace_ref: observability?.external_trace_ref ?? buildExternalTraceRef(membership.trace_id),
    status: membership.status,
    current_stage: membership.current_stage,
    stage_progress: stageSummary.progress,
    active_transport: {
      queued_batches: queuedBatches.length,
      running_batches: runningBatches.length,
      queued_jobs: queuedJobs.length,
      running_jobs: runningJobs.length,
      orphaned_requests: memberOrphans.length,
    },
    stalled_signals: {
      no_progress_for_ms: noProgressForMs,
      oldest_pending_request_age_ms: oldestPendingRequestAgeMs,
      scheduler_scheduled: schedulerScheduled,
    },
    request_state_meta: {
      approximate: stateRowsResult.approximate,
      scanned_targets: stateRowsResult.rows.length,
      latest_updated_at_ms: stateRowsResult.latest_updated_at_ms,
    },
    error_summary: [...errorCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([errorClass, count]) => ({ class: errorClass, count })),
    historical_error_summary: [...historicalErrorCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([errorClass, count]) => ({ class: errorClass, count })),
    recent_events: recentRows.map((event) => ({
      seq: event.seq,
      ts_ms: event.ts_ms,
      event_name: event.event_name,
      stage: event.stage ?? null,
      status: event.status ?? null,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      custom_key: event.custom_key ?? null,
      payload_json: event.payload_json ?? null,
    })),
    entity_states: [],
  };
}

async function listTraceEventsBounded(
  ctx: QueryCtx | MutationCtx,
  trace_id: string,
  maxEvents: number,
): Promise<{
  events: TraceEvent[];
  reached_end_of_trace: boolean;
}> {
  const events: TraceEvent[] = [];
  let cursorSeq: number | undefined;
  while (events.length < maxEvents) {
    const remaining = Math.max(1, maxEvents - events.length);
    const pageSize = Math.min(500, remaining);
    const page = await ctx.runQuery(internal.domain.telemetry.events.listByTrace, {
      trace_id,
      cursor_seq: cursorSeq,
      limit: pageSize,
    });
    events.push(...page.events);
    if (page.next_cursor_seq == null) {
      return { events, reached_end_of_trace: true };
    }
    cursorSeq = page.next_cursor_seq;
  }
  return { events, reached_end_of_trace: false };
}

function computeSequenceDiagnostics(
  seqs: number[],
) {
  if (seqs.length === 0) {
    return {
      seq_min: null,
      seq_max: null,
      missing_seq_count: 0,
      duplicate_seq_count: 0,
    };
  }

  const sorted = seqs.slice().sort((a, b) => a - b);
  const seqMin = sorted[0];
  const seqMax = sorted[sorted.length - 1];

  let duplicate = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (current === prev) {
      duplicate += 1;
    }
  }

  return {
    seq_min: seqMin,
    seq_max: seqMax,
    // Telemetry seq uses timestamp-entropy and is intentionally non-contiguous.
    // Missing-sequence math is not meaningful in this mode.
    missing_seq_count: 0,
    duplicate_seq_count: duplicate,
  };
}

function incrementMapCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function isTerminalProcessEvent(
  processType: "run" | "window",
  eventName: string,
): boolean {
  return processType === "run"
    ? eventName === "run_completed" || eventName === "run_terminal_error"
    : eventName === "window_completed" || eventName === "window_terminal_error";
}

export const tailTrace: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    trace_id: z.string(),
    cursor_seq: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  returns: z.object({
    events: z.array(
      z.object({
        trace_id: z.string(),
        seq: z.number(),
        entity_type: z.string(),
        entity_id: z.string(),
        event_name: z.string(),
        stage: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        custom_key: z.string().nullable().optional(),
        attempt: z.number().nullable().optional(),
        ts_ms: z.number(),
        payload_json: z.string().nullable().optional(),
      }),
    ),
    next_cursor_seq: z.number().nullable(),
    telemetry_backend: z.literal("axiom"),
    external_trace_ref: z.string().nullable(),
  }),
  handler: async (ctx, args) => {
    return ctx.runQuery(internal.domain.telemetry.events.listByTrace, args);
  },
});

export const getProcessHealth: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    process_type: ProcessTypeSchema,
    process_id: z.string(),
    include_recent_events: z.number().int().min(0).max(500).optional(),
  }),
  returns: HealthSummarySchema,
  handler: async (ctx, args) => collectProcessHealth(ctx, args),
});

export const getStuckWork: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    process_type: ProcessTypeSchema.optional(),
    older_than_ms: z.number().int().min(1).default(120_000),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  returns: z.object({
    checked_at_ms: z.number(),
    items: z.array(StuckWorkSchema),
    meta: z.object({
      truncated: z.boolean(),
      scan_caps_hit: z.boolean(),
      health_checks_limited: z.boolean(),
      scanned: z.object({
        submitting_batches: z.number(),
        running_batches: z.number(),
        finalizing_batches: z.number(),
        orphaned_requests: z.number(),
        candidate_runs: z.number(),
        candidate_windows: z.number(),
        health_checks: z.number(),
      }),
    }),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now - args.older_than_ms;
    const items: Array<z.infer<typeof StuckWorkSchema>> = [];

    const submittingBatchQuery = ctx.db.query("llm_batches").withIndex("by_status", (q) => q.eq("status", "submitting"));
    const runningBatchQuery = ctx.db.query("llm_batches").withIndex("by_status", (q) => q.eq("status", "running"));
    const finalizingBatchQuery = ctx.db.query("llm_batches").withIndex("by_status", (q) => q.eq("status", "finalizing"));
    const runQuery = ctx.db.query("runs");
    const windowQuery = ctx.db.query("windows");

    const [
      submittingBatches,
      runningBatches,
      finalizingBatches,
      orphaned,
      runs,
      windows,
      schedulerScheduled,
    ] = await Promise.all([
      submittingBatchQuery.take(STUCK_BATCH_SCAN_MAX_ROWS),
      runningBatchQuery.take(STUCK_BATCH_SCAN_MAX_ROWS),
      finalizingBatchQuery.take(STUCK_BATCH_SCAN_MAX_ROWS),
      ctx.runQuery(internal.domain.llm_calls.llm_request_repo.listOrphanedRequests, {
        limit: STUCK_BATCH_SCAN_MAX_ROWS,
      }),
      args.process_type && args.process_type !== "run"
        ? Promise.resolve([] as Doc<"runs">[])
        : runQuery.take(STUCK_PROCESS_SCAN_MAX_ROWS),
      args.process_type && args.process_type !== "window"
        ? Promise.resolve([] as Doc<"windows">[])
        : windowQuery.take(STUCK_PROCESS_SCAN_MAX_ROWS),
      hasScheduledScheduler(ctx),
    ]);
    const scanCapsHit = (
      submittingBatches.length === STUCK_BATCH_SCAN_MAX_ROWS
      || runningBatches.length === STUCK_BATCH_SCAN_MAX_ROWS
      || finalizingBatches.length === STUCK_BATCH_SCAN_MAX_ROWS
      || orphaned.length === STUCK_BATCH_SCAN_MAX_ROWS
      || runs.length === STUCK_PROCESS_SCAN_MAX_ROWS
      || windows.length === STUCK_PROCESS_SCAN_MAX_ROWS
    );

    const isAllowedProcess = (customKey: string) => {
      if (!args.process_type) return true;
      return customKey.startsWith(`${args.process_type}:`);
    };

    for (const batch of [...submittingBatches, ...runningBatches]) {
      if (!isAllowedProcess(batch.custom_key)) continue;
      if (batch.batch_ref) continue;
      const ageMs = Math.max(0, now - batch._creationTime);
      if (ageMs < args.older_than_ms) continue;
      const parsed = parseProcessFromCustomKey(batch.custom_key);
      if (!parsed.process_type || !parsed.process_id) continue;
      items.push({
        process_type: parsed.process_type,
        process_id: parsed.process_id,
        reason: "batch_missing_ref",
        entity_type: "batch",
        entity_id: String(batch._id),
        custom_key: batch.custom_key,
        age_ms: ageMs,
        details: "Batch is submitting/running/finalizing without provider batch_ref",
      });
    }

    for (const batch of finalizingBatches) {
      if (!isAllowedProcess(batch.custom_key)) continue;
      const nextPollAt = batch.next_poll_at ?? batch._creationTime;
      if (nextPollAt > cutoff) continue;
      const parsed = parseProcessFromCustomKey(batch.custom_key);
      if (!parsed.process_type || !parsed.process_id) continue;
      items.push({
        process_type: parsed.process_type,
        process_id: parsed.process_id,
        reason: "finalizing_no_progress",
        entity_type: "batch",
        entity_id: String(batch._id),
        custom_key: batch.custom_key,
        age_ms: Math.max(0, now - nextPollAt),
        details: "Finalizing batch has no poll progress beyond threshold",
      });
    }

    for (const request of orphaned) {
      if (request._creationTime > cutoff) continue;
      const parsedKey = parseCustomKey(request.custom_key);
      let processType: "run" | "window" | null = null;
      let processId: string | null = null;

      if (parsedKey.targetType === "sample") {
        const sample = await ctx.db.get(parsedKey.targetId as Id<"samples">);
        if (sample) {
          processType = "run";
          processId = String(sample.run_id);
        }
      }
      if (parsedKey.targetType === "sample_score_target") {
        const scoreTarget = await ctx.db.get(parsedKey.targetId as Id<"sample_score_targets">);
        if (scoreTarget) {
          processType = "run";
          processId = String(scoreTarget.run_id);
        }
      }
      if (parsedKey.targetType === "evidence") {
        const evidence = await ctx.db.get(parsedKey.targetId as Id<"evidences">);
        if (evidence) {
          processType = "window";
          processId = String(evidence.window_id);
        }
      }

      if (!processType || !processId) continue;
      if (args.process_type && args.process_type !== processType) continue;
      items.push({
        process_type: processType,
        process_id: processId,
        reason: "pending_request_no_owner",
        entity_type: "request",
        entity_id: String(request._id),
        custom_key: request.custom_key,
        age_ms: Math.max(0, now - request._creationTime),
        details: "Pending request is not assigned to batch/job",
      });
    }

    if (!schedulerScheduled) {
      const hasBacklog = submittingBatches.length > 0 || runningBatches.length > 0 || finalizingBatches.length > 0 || orphaned.length > 0;
      if (hasBacklog) {
        const processType = args.process_type ?? "run";
        const processId = args.process_type === "window" ? String(windows[0]?._id ?? "unknown") : String(runs[0]?._id ?? "unknown");
        items.push({
          process_type: processType,
          process_id: processId,
          reason: "scheduler_not_running",
          entity_type: "scheduler",
          entity_id: "scheduler",
          custom_key: "scheduler:global",
          age_ms: null,
          details: "Scheduler has backlog work but no scheduled run",
        });
      }
    }

    const runRows = args.process_type === "window"
      ? []
      : runs;
    let healthChecks = 0;
    const runHealthRows = runRows
      .filter((run) =>
        run.status !== "completed"
        && run.status !== "error"
        && run.status !== "canceled",
      )
      .slice(0, STUCK_HEALTH_CHECK_MAX_PROCESSES);
    for (const run of runRows) {
      if (args.process_type && args.process_type !== "run") continue;
      if (!runHealthRows.find((row) => row._id === run._id)) continue;
      healthChecks += 1;
      const health = await collectProcessHealth(ctx, {
        process_type: "run",
        process_id: String(run._id),
        include_recent_events: 0,
      });
      const currentStage = health.stage_progress.find((row: z.infer<typeof StageProgressSchema>) =>
        row.stage === health.current_stage,
      );
      if (!currentStage) continue;
      if (currentStage.failed === 0 || currentStage.pending > 0) continue;
      items.push({
        process_type: "run",
        process_id: String(run._id),
        reason: "stage_waiting_on_exhausted_requests",
        entity_type: "run",
        entity_id: String(run._id),
        custom_key: `run:${run._id}:${health.current_stage}`,
        age_ms: null,
        details: "Current stage has exhausted failures and no pending work",
      });
    }

    const windowRows = args.process_type === "run"
      ? []
      : windows.filter((window) =>
        window.status !== "completed"
        && window.status !== "error"
        && window.status !== "canceled",
      );
    const windowHealthRows = windowRows
      .filter((window) =>
        window.status !== "completed"
        && window.status !== "error"
        && window.status !== "canceled",
      )
      .slice(0, STUCK_HEALTH_CHECK_MAX_PROCESSES);
    for (const window of windowRows) {
      if (args.process_type && args.process_type !== "window") continue;
      if (!windowHealthRows.find((row) => row._id === window._id)) continue;
      healthChecks += 1;
      const health = await collectProcessHealth(ctx, {
        process_type: "window",
        process_id: String(window._id),
        include_recent_events: 0,
      });
      if (
        window.status === "start"
        && window.current_stage === "l0_raw"
        && health.active_transport.queued_batches === 0
        && health.active_transport.running_batches === 0
        && health.active_transport.queued_jobs === 0
        && health.active_transport.running_jobs === 0
        && health.active_transport.orphaned_requests === 0
        && health.stage_progress.every((row) => row.target_total === 0)
        && now - window._creationTime >= args.older_than_ms
      ) {
        items.push({
          process_type: "window",
          process_id: String(window._id),
          reason: "raw_collection_no_progress",
          entity_type: "window",
          entity_id: String(window._id),
          custom_key: `window:${window._id}:l0_raw`,
          age_ms: now - window._creationTime,
          details: "Window has no collected evidence, no active transport, and no raw-collection progress",
        });
        continue;
      }
      const currentStage = health.stage_progress.find((row: z.infer<typeof StageProgressSchema>) =>
        row.stage === health.current_stage,
      );
      if (!currentStage) continue;
      if (currentStage.failed === 0 || currentStage.pending > 0) continue;
      items.push({
        process_type: "window",
        process_id: String(window._id),
        reason: "stage_waiting_on_exhausted_requests",
        entity_type: "window",
        entity_id: String(window._id),
        custom_key: `window:${window._id}:${health.current_stage}`,
        age_ms: null,
        details: "Current stage has exhausted failures and no pending work",
      });
    }

    return {
      checked_at_ms: now,
      items: items.slice(0, args.limit),
      meta: {
        truncated: items.length > args.limit,
        scan_caps_hit: scanCapsHit,
        health_checks_limited: (
          runRows.length > STUCK_HEALTH_CHECK_MAX_PROCESSES
          || windowRows.length > STUCK_HEALTH_CHECK_MAX_PROCESSES
        ),
        scanned: {
          submitting_batches: submittingBatches.length,
          running_batches: runningBatches.length,
          finalizing_batches: finalizingBatches.length,
          orphaned_requests: orphaned.length,
          candidate_runs: runRows.length,
          candidate_windows: windowRows.length,
          health_checks: healthChecks,
        },
      },
    };
  },
});

export const analyzeProcessTelemetry: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    process_type: ProcessTypeSchema,
    process_id: z.string(),
    max_events: z.number().int().min(50).max(20_000).default(5_000),
  }),
  returns: ProcessTelemetryAnalysisSchema,
  handler: async (ctx, args) => {
    const membership = await buildMembership(ctx, args.process_type, args.process_id);
    if (!membership) {
      throw new Error(`${args.process_type} not found: ${args.process_id}`);
    }

    const traceScan = await listTraceEventsBounded(ctx, membership.trace_id, args.max_events);
    const events = traceScan.events.slice().sort((a, b) => a.seq - b.seq);
    const seqs = events.map((event) => event.seq);
    const seqDiagnostics = computeSequenceDiagnostics(seqs);

    const eventCounts = new Map<string, number>();
    const stageSummaries = new Map<string, z.infer<typeof AnalyzeStageSummarySchema>>();
    const requestAppliedByRequest = new Map<string, number>();
    const requestDuplicateByRequest = new Map<string, number>();
    const jobFinalizedByJob = new Map<string, number>();

    let firstTs: number | null = null;
    let lastTs: number | null = null;
    let terminalSeq: number | null = null;
    let terminalEventName: string | null = null;

    const getStageSummary = (stage: string) => {
      const existing = stageSummaries.get(stage);
      if (existing) return existing;
      const created: z.infer<typeof AnalyzeStageSummarySchema> = {
        stage,
        first_ts_ms: null,
        last_ts_ms: null,
        duration_ms: null,
        route: "none",
        request_applied: 0,
        request_apply_duplicate_success: 0,
        request_error: 0,
        job_queued_handler_started: 0,
        job_running_polled: 0,
        job_finalized: 0,
        batch_queued_handler_started: 0,
        batch_polled: 0,
        batch_success: 0,
        batch_poll_claim_denied: 0,
        batch_submit_claim_denied: 0,
      };
      stageSummaries.set(stage, created);
      return created;
    };

    for (const event of events) {
      incrementMapCount(eventCounts, event.event_name);

      if (firstTs == null || event.ts_ms < firstTs) firstTs = event.ts_ms;
      if (lastTs == null || event.ts_ms > lastTs) lastTs = event.ts_ms;

      if (terminalSeq == null && isTerminalProcessEvent(args.process_type, event.event_name)) {
        terminalSeq = event.seq;
        terminalEventName = event.event_name;
      }

      const stage = event.stage ?? "none";
      const stageSummary = getStageSummary(stage);
      if (stageSummary.first_ts_ms == null || event.ts_ms < stageSummary.first_ts_ms) {
        stageSummary.first_ts_ms = event.ts_ms;
      }
      if (stageSummary.last_ts_ms == null || event.ts_ms > stageSummary.last_ts_ms) {
        stageSummary.last_ts_ms = event.ts_ms;
      }

      if (event.event_name === "request_applied") {
        stageSummary.request_applied += 1;
        if (event.entity_type === "request") {
          incrementMapCount(requestAppliedByRequest, event.entity_id);
        }
      }
      if (event.event_name === "request_apply_duplicate_success") {
        stageSummary.request_apply_duplicate_success += 1;
        if (event.entity_type === "request") {
          incrementMapCount(requestDuplicateByRequest, event.entity_id);
        }
      }
      if (event.event_name === "request_error") stageSummary.request_error += 1;
      if (event.event_name === "job_queued_handler_started") {
        stageSummary.job_queued_handler_started += 1;
        stageSummary.route = stageSummary.route === "batch" ? "mixed" : "job";
      }
      if (event.event_name === "job_running_polled") stageSummary.job_running_polled += 1;
      if (event.event_name === "job_finalized") {
        stageSummary.job_finalized += 1;
        if (event.entity_type === "job") {
          incrementMapCount(jobFinalizedByJob, event.entity_id);
        }
      }
      if (event.event_name === "batch_queued_handler_started") {
        stageSummary.batch_queued_handler_started += 1;
        stageSummary.route = stageSummary.route === "job" ? "mixed" : "batch";
      }
      if (event.event_name === "batch_polled") stageSummary.batch_polled += 1;
      if (event.event_name === "batch_success") stageSummary.batch_success += 1;
      if (event.event_name === "batch_poll_claim_denied") stageSummary.batch_poll_claim_denied += 1;
      if (event.event_name === "batch_submit_claim_denied") stageSummary.batch_submit_claim_denied += 1;
    }

    for (const summary of stageSummaries.values()) {
      if (summary.first_ts_ms != null && summary.last_ts_ms != null) {
        summary.duration_ms = Math.max(0, summary.last_ts_ms - summary.first_ts_ms);
      }
    }

    const duplicateValues = [...requestDuplicateByRequest.values()];
    const jobFinalizeValues = [...jobFinalizedByJob.values()];

    const observability = await ctx.runQuery(
      internal.domain.telemetry.events.getProcessObservability,
      {
        process_type: args.process_type,
        process_id: args.process_id,
      },
    );

    return {
      process_type: args.process_type,
      process_id: args.process_id,
      trace_id: membership.trace_id,
      telemetry_backend: "axiom" as const,
      external_trace_ref: observability?.external_trace_ref ?? buildExternalTraceRef(membership.trace_id),
      sampled_events: events.length,
      reached_end_of_trace: false,
      seq_min: seqDiagnostics.seq_min,
      seq_max: seqDiagnostics.seq_max,
      missing_seq_count: seqDiagnostics.missing_seq_count,
      duplicate_seq_count: seqDiagnostics.duplicate_seq_count,
      first_ts_ms: firstTs,
      last_ts_ms: lastTs,
      duration_ms: firstTs != null && lastTs != null ? Math.max(0, lastTs - firstTs) : null,
      event_counts: [...eventCounts.entries()]
        .map(([event_name, count]) => ({ event_name, count }))
        .sort((a, b) => b.count - a.count || a.event_name.localeCompare(b.event_name)),
      stage_summaries: [...stageSummaries.values()]
        .sort((a, b) => a.stage.localeCompare(b.stage)),
      request_stats: {
        unique_request_entities: new Set(
          events
            .filter((event) => event.entity_type === "request")
            .map((event) => event.entity_id),
        ).size,
        request_applied_total: [...requestAppliedByRequest.values()].reduce((sum, count) => sum + count, 0),
        duplicate_apply_success_total: duplicateValues.reduce((sum, count) => sum + count, 0),
        requests_with_duplicate_apply_success: duplicateValues.filter((count) => count > 0).length,
        max_duplicate_apply_success_per_request: duplicateValues.length > 0 ? Math.max(...duplicateValues) : 0,
      },
      job_stats: {
        unique_job_entities: new Set(
          events
            .filter((event) => event.entity_type === "job")
            .map((event) => event.entity_id),
        ).size,
        job_finalized_total: jobFinalizeValues.reduce((sum, count) => sum + count, 0),
        jobs_finalized_multiple_times: jobFinalizeValues.filter((count) => count > 1).length,
        max_job_finalized_per_job: jobFinalizeValues.length > 0 ? Math.max(...jobFinalizeValues) : 0,
      },
      terminal_stats: {
        terminal_event_name: terminalEventName,
        terminal_seq: terminalSeq,
        events_after_terminal: terminalSeq == null
          ? 0
          : events.filter((event) => event.seq > terminalSeq).length,
      },
    };
  },
});

export const testAxiomIngest: ReturnType<typeof zAction> = zAction({
  args: z.object({
    trace_id: z.string().optional(),
    event_name: z.string().default("axiom_smoke_test"),
  }),
  returns: z.object({
    ok: z.boolean(),
    status: z.number(),
    dataset: z.string(),
    trace_id: z.string(),
    response_text: z.string().optional(),
  }),
  handler: async (ctx, args) => {
    const trace_id = args.trace_id ?? `smoke:${Date.now()}`;
    const event = buildAxiomEventEnvelope({
      trace_id,
      entity_type: "scheduler",
      entity_id: "smoke_test",
      event_name: args.event_name,
      status: "ok",
      payload_json: JSON.stringify({ source: "codex", smoke_test: true }),
      ts_ms: Date.now(),
    });
    return ctx.runAction(internal.domain.telemetry.events.exportEvent, {
      event,
    });
  },
});

export const runDebugActions: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    dry_run: z.boolean().default(true),
    actions: z.array(DebugActionSchema).min(1).max(200),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    results: z.array(DebugActionResultSchema),
  }),
  handler: async (ctx, args) => {
    const results: Array<z.infer<typeof DebugActionResultSchema>> = [];
    for (const action of args.actions) {
      try {
        results.push(await executeDebugAction(ctx, args.dry_run, action));
      } catch (error) {
        results.push({
          action: action.action,
          entity_id: action.action === "start_scheduler_if_idle"
            ? null
            : String((action as { request_id?: string; batch_id?: string }).request_id ?? (action as { batch_id?: string }).batch_id ?? ""),
          status: "failed",
          reason: String(error),
        });
      }
    }

    return {
      dry_run: args.dry_run,
      results,
    };
  },
});

export const autoHealProcess: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    process_type: ProcessTypeSchema,
    process_id: z.string(),
    dry_run: z.boolean().default(true),
    older_than_ms: z.number().int().min(1).default(120_000),
    cursor: z.number().int().min(0).optional(),
    max_actions: z.number().int().min(1).max(500).default(AUTO_HEAL_DEFAULT_MAX_ACTIONS),
    max_stage_scan: z.number().int().min(1).max(PROCESS_TARGET_STATE_SCAN_MAX_ROWS).default(AUTO_HEAL_STAGE_SCAN_MAX),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    planned_actions: z.array(DebugActionSchema),
    results: z.array(DebugActionResultSchema),
    meta: z.object({
      total_planned_actions: z.number(),
      executed_actions: z.number(),
      remaining_actions: z.number(),
      next_cursor: z.number().nullable(),
      request_state_approximate: z.boolean(),
      scan_caps_hit: z.boolean(),
      scanned_target_states: z.number(),
      scanned_batches: z.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const membership = await buildMembership(ctx, args.process_type, args.process_id);
    if (!membership) {
      throw new Error(`${args.process_type} not found: ${args.process_id}`);
    }

    const now = Date.now();
    const cutoff = now - args.older_than_ms;
    const plannedActions: Array<z.infer<typeof DebugActionSchema>> = [];

    const schedulerScheduled = await hasScheduledScheduler(ctx);
    if (!schedulerScheduled) {
      plannedActions.push({ action: "start_scheduler_if_idle" });
    }

    const targetStateResult = await listProcessRequestTargetStates(ctx, membership);
    const scannedRows = targetStateResult.rows.slice(0, args.max_stage_scan);
    for (const targetState of scannedRows) {
      if (
        targetState.resolution === "pending"
        && targetState.oldest_pending_ts != null
        && targetState.oldest_pending_ts <= cutoff
      ) {
        const pending = targetState.active_request_id
          ? await ctx.db.get(targetState.active_request_id)
          : null;
        if (pending && pending.batch_id == null && pending.job_id == null) {
          plannedActions.push({
            action: "requeue_orphan_request",
            request_id: pending._id,
          });
        }
        continue;
      }

      if (targetState.resolution === "pending") continue;
      if (targetState.resolution === "exhausted") continue;
      if (targetState.resolution === "succeeded") continue;
      if (
        targetState.attempt_count <= 0
        && targetState.latest_error_class == null
        && targetState.latest_error_message == null
      ) {
        continue;
      }

      const pendingReplacement = await ctx.db
        .query("llm_requests")
        .withIndex("by_custom_key_status", (q) =>
          q.eq("custom_key", targetState.custom_key).eq("status", "pending"),
        )
        .first();
      if (pendingReplacement) continue;

      const latestError = targetState.latest_error_request_id
        ? await ctx.db.get(targetState.latest_error_request_id)
        : null;
      if (!latestError) continue;
      plannedActions.push({
        action: "requeue_retryable_request",
        request_id: latestError._id,
      });
    }

    const activeBatches = await listActiveBatchesForProcess(
      ctx,
      args.process_type,
      args.process_id,
    );
    const staleBatches = activeBatches.filter((batch) => {
      const leaseExpired = batch.poll_claim_expires_at != null && batch.poll_claim_expires_at <= now;
      const stalePoll = (batch.next_poll_at ?? 0) <= cutoff;
      return leaseExpired || stalePoll;
    });
    for (const batch of staleBatches) {
      plannedActions.push({
        action: "release_expired_batch_claim",
        batch_id: batch._id,
      });
      plannedActions.push({
        action: "nudge_batch_poll_now",
        batch_id: batch._id,
      });
    }

    const deduped = new Map<string, z.infer<typeof DebugActionSchema>>();
    for (const action of plannedActions) {
      const key = action.action === "start_scheduler_if_idle"
        ? action.action
        : `${action.action}:${"request_id" in action ? action.request_id : action.batch_id}`;
      deduped.set(key, action);
    }
    const orderedActions = [...deduped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, action]) => action);
    const cursor = args.cursor ?? 0;
    const page = orderedActions.slice(cursor, cursor + args.max_actions);
    const nextCursor = cursor + page.length < orderedActions.length
      ? cursor + page.length
      : null;

    const results: Array<z.infer<typeof DebugActionResultSchema>> = [];
    for (const action of page) {
      try {
        results.push(await executeDebugAction(ctx, args.dry_run, action));
      } catch (error) {
        results.push({
          action: action.action,
          entity_id: action.action === "start_scheduler_if_idle"
            ? null
            : String((action as { request_id?: string; batch_id?: string }).request_id ?? (action as { batch_id?: string }).batch_id ?? ""),
          status: "failed",
          reason: String(error),
        });
      }
    }

    return {
      dry_run: args.dry_run,
      planned_actions: page,
      results,
      meta: {
        total_planned_actions: orderedActions.length,
        executed_actions: page.length,
        remaining_actions: Math.max(0, orderedActions.length - (cursor + page.length)),
        next_cursor: nextCursor,
        request_state_approximate: targetStateResult.approximate,
        scan_caps_hit: targetStateResult.approximate || targetStateResult.rows.length > args.max_stage_scan,
        scanned_target_states: scannedRows.length,
        scanned_batches: activeBatches.length,
      },
    };
  },
});

export const backfillRunCompletedCounts: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    dry_run: z.boolean().default(true),
    cursor: z.number().int().min(0).optional(),
    max_runs: z.number().int().min(1).max(500).default(100),
    run_ids: z.array(zid("runs")).optional(),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    processed: z.number(),
    updated: z.number(),
    next_cursor: z.number().nullable(),
    rows: z.array(z.object({
      run_id: zid("runs"),
      status: z.string(),
      target_count: z.number(),
      previous_completed_count: z.number().nullable(),
      computed_completed_count: z.number(),
      changed: z.boolean(),
    })),
  }),
  handler: async (ctx, args) => {
    const cursor = args.cursor ?? 0;
    let nextCursor: number | null = null;
    let runs: Array<Doc<"runs">> = [];

    if (args.run_ids?.length) {
      const loadedRuns = await Promise.all(args.run_ids.map((runId) => ctx.db.get(runId)));
      runs = loadedRuns.filter((run): run is Doc<"runs"> => run != null);
    } else {
      const orderedRuns = await ctx.db
        .query("runs")
        .order("asc")
        .take(cursor + args.max_runs + 1);
      const page = orderedRuns.slice(cursor, cursor + args.max_runs + 1);
      runs = page.slice(0, args.max_runs);
      if (page.length > args.max_runs) {
        nextCursor = cursor + args.max_runs;
      }
    }

    const rows: Array<{
      run_id: Id<"runs">;
      status: string;
      target_count: number;
      previous_completed_count: number | null;
      computed_completed_count: number;
      changed: boolean;
    }> = [];
    let updated = 0;

    for (const run of runs) {
      const computedCompletedCount = await getRunCompletedCount(ctx, run._id);
      const previousCompletedCount = typeof run.completed_count === "number"
        ? run.completed_count
        : null;
      const changed = previousCompletedCount !== computedCompletedCount;

      if (changed && !args.dry_run) {
        await ctx.db.patch(run._id, {
          completed_count: computedCompletedCount,
        });
      }
      if (changed) {
        updated += 1;
      }

      rows.push({
        run_id: run._id,
        status: run.status,
        target_count: run.target_count,
        previous_completed_count: previousCompletedCount,
        computed_completed_count: computedCompletedCount,
        changed,
      });
    }

    return {
      dry_run: args.dry_run,
      processed: runs.length,
      updated,
      next_cursor: nextCursor,
      rows,
    };
  },
});

export const backfillExperimentTotalCounts: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    dry_run: z.boolean().default(true),
    cursor: z.number().int().min(0).optional(),
    max_experiments: z.number().int().min(1).max(500).default(100),
    experiment_ids: z.array(zid("experiments")).optional(),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    processed: z.number(),
    updated: z.number(),
    next_cursor: z.number().nullable(),
    rows: z.array(z.object({
      experiment_id: zid("experiments"),
      experiment_tag: z.string(),
      previous_total_count: z.number().nullable(),
      computed_total_count: z.number(),
      changed: z.boolean(),
    })),
  }),
  handler: async (ctx, args) => {
    const cursor = args.cursor ?? 0;
    let nextCursor: number | null = null;
    let experiments: Array<Doc<"experiments">> = [];

    if (args.experiment_ids?.length) {
      const loaded = await Promise.all(
        args.experiment_ids.map((experimentId) => ctx.db.get(experimentId)),
      );
      experiments = loaded.filter(
        (experiment): experiment is Doc<"experiments"> => experiment != null,
      );
    } else {
      const orderedExperiments = await ctx.db
        .query("experiments")
        .order("asc")
        .take(cursor + args.max_experiments + 1);
      const page = orderedExperiments.slice(cursor, cursor + args.max_experiments + 1);
      experiments = page.slice(0, args.max_experiments);
      if (page.length > args.max_experiments) {
        nextCursor = cursor + args.max_experiments;
      }
    }

    const rows: Array<{
      experiment_id: Id<"experiments">;
      experiment_tag: string;
      previous_total_count: number | null;
      computed_total_count: number;
      changed: boolean;
    }> = [];
    let updated = 0;

    for (const experiment of experiments) {
      const computedTotalCount = await getExperimentTotalCount(ctx, experiment._id);
      const previousTotalCount = typeof experiment.total_count === "number"
        ? experiment.total_count
        : null;
      const changed = previousTotalCount !== computedTotalCount;

      if (changed && !args.dry_run) {
        await ctx.db.patch(experiment._id, {
          total_count: computedTotalCount,
        });
      }
      if (changed) {
        updated += 1;
      }

      rows.push({
        experiment_id: experiment._id,
        experiment_tag: experiment.experiment_tag,
        previous_total_count: previousTotalCount,
        computed_total_count: computedTotalCount,
        changed,
      });
    }

    return {
      dry_run: args.dry_run,
      processed: experiments.length,
      updated,
      next_cursor: nextCursor,
      rows,
    };
  },
});

export const backfillWindowCompletedCounts: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    dry_run: z.boolean().default(true),
    cursor: z.number().int().min(0).optional(),
    max_windows: z.number().int().min(1).max(500).default(100),
    window_ids: z.array(zid("windows")).optional(),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    processed: z.number(),
    updated: z.number(),
    next_cursor: z.number().nullable(),
    rows: z.array(z.object({
      window_id: zid("windows"),
      previous_target_count: z.number().nullable(),
      previous_completed_count: z.number().nullable(),
      computed_target_count: z.number(),
      computed_completed_count: z.number(),
      changed: z.boolean(),
    })),
  }),
  handler: async (ctx, args) => {
    const cursor = args.cursor ?? 0;
    let nextCursor: number | null = null;
    let windows: Array<Doc<"windows">> = [];

    if (args.window_ids?.length) {
      const loaded = await Promise.all(args.window_ids.map((windowId) => ctx.db.get(windowId)));
      windows = loaded.filter((window): window is Doc<"windows"> => window != null);
    } else {
      const orderedWindows = await ctx.db
        .query("windows")
        .order("asc")
        .take(cursor + args.max_windows + 1);
      const page = orderedWindows.slice(cursor, cursor + args.max_windows + 1);
      windows = page.slice(0, args.max_windows);
      if (page.length > args.max_windows) {
        nextCursor = cursor + args.max_windows;
      }
    }

    const rows: Array<{
      window_id: Id<"windows">;
      previous_target_count: number | null;
      previous_completed_count: number | null;
      computed_target_count: number;
      computed_completed_count: number;
      changed: boolean;
    }> = [];
    let updated = 0;

    for (const window of windows) {
      const evidences = await ctx.db
        .query("evidences")
        .withIndex("by_window_id", (q) => q.eq("window_id", window._id))
        .collect();
      const computedTargetCount = evidences.length;
      const computedCompletedCount = evidences.filter(
        (evidence) => evidence.l3_abstracted_content != null,
      ).length;
      const previousTargetCount = typeof window.target_count === "number"
        ? window.target_count
        : null;
      const previousCompletedCount = typeof window.completed_count === "number"
        ? window.completed_count
        : null;
      const changed =
        previousTargetCount !== computedTargetCount
        || previousCompletedCount !== computedCompletedCount;

      if (changed && !args.dry_run) {
        await ctx.db.patch(window._id, {
          target_count: computedTargetCount,
          completed_count: computedCompletedCount,
        });
      }
      if (changed) {
        updated += 1;
      }

      rows.push({
        window_id: window._id,
        previous_target_count: previousTargetCount,
        previous_completed_count: previousCompletedCount,
        computed_target_count: computedTargetCount,
        computed_completed_count: computedCompletedCount,
        changed,
      });
    }

    return {
      dry_run: args.dry_run,
      processed: windows.length,
      updated,
      next_cursor: nextCursor,
      rows,
    };
  },
});

export const backfillPoolEvidenceCounts: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    dry_run: z.boolean().default(true),
    cursor: z.number().int().min(0).optional(),
    max_pools: z.number().int().min(1).max(500).default(100),
    pool_ids: z.array(zid("pools")).optional(),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    processed: z.number(),
    updated: z.number(),
    next_cursor: z.number().nullable(),
    rows: z.array(z.object({
      pool_id: zid("pools"),
      pool_tag: z.string(),
      previous_evidence_count: z.number().nullable(),
      computed_evidence_count: z.number(),
      changed: z.boolean(),
    })),
  }),
  handler: async (ctx, args) => {
    const cursor = args.cursor ?? 0;
    let nextCursor: number | null = null;
    let pools: Array<Doc<"pools">> = [];

    if (args.pool_ids?.length) {
      const loaded = await Promise.all(args.pool_ids.map((poolId) => ctx.db.get(poolId)));
      pools = loaded.filter((pool): pool is Doc<"pools"> => pool != null);
    } else {
      const orderedPools = await ctx.db
        .query("pools")
        .order("asc")
        .take(cursor + args.max_pools + 1);
      const page = orderedPools.slice(cursor, cursor + args.max_pools + 1);
      pools = page.slice(0, args.max_pools);
      if (page.length > args.max_pools) {
        nextCursor = cursor + args.max_pools;
      }
    }

    const rows: Array<{
      pool_id: Id<"pools">;
      pool_tag: string;
      previous_evidence_count: number | null;
      computed_evidence_count: number;
      changed: boolean;
    }> = [];
    let updated = 0;

    for (const pool of pools) {
      const links = await ctx.db
        .query("pool_evidences")
        .withIndex("by_pool", (q) => q.eq("pool_id", pool._id))
        .collect();
      const computedEvidenceCount = links.length;
      const previousEvidenceCount = typeof pool.evidence_count === "number"
        ? pool.evidence_count
        : null;
      const changed = previousEvidenceCount !== computedEvidenceCount;

      if (changed && !args.dry_run) {
        await ctx.db.patch(pool._id, {
          evidence_count: computedEvidenceCount,
        });
      }
      if (changed) {
        updated += 1;
      }

      rows.push({
        pool_id: pool._id,
        pool_tag: pool.pool_tag,
        previous_evidence_count: previousEvidenceCount,
        computed_evidence_count: computedEvidenceCount,
        changed,
      });
    }

    return {
      dry_run: args.dry_run,
      processed: pools.length,
      updated,
      next_cursor: nextCursor,
      rows,
    };
  },
});

export const backfillSampleScoreCounts: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    dry_run: z.boolean().default(true),
    cursor: z.number().int().min(0).optional(),
    max_samples: z.number().int().min(1).max(1000).default(200),
    sample_ids: z.array(zid("samples")).optional(),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    processed: z.number(),
    updated: z.number(),
    next_cursor: z.number().nullable(),
    rows: z.array(z.object({
      sample_id: zid("samples"),
      run_id: zid("runs"),
      previous_score_count: z.number().nullable(),
      previous_score_critic_count: z.number().nullable(),
      computed_score_count: z.number(),
      computed_score_critic_count: z.number(),
      changed: z.boolean(),
      removed_legacy_fields: z.boolean(),
    })),
  }),
  handler: async (ctx, args) => {
    const cursor = args.cursor ?? 0;
    let nextCursor: number | null = null;
    let samples: Array<Doc<"samples">> = [];

    if (args.sample_ids?.length) {
      const loaded = await Promise.all(args.sample_ids.map((sampleId) => ctx.db.get(sampleId)));
      samples = loaded.filter((sample): sample is Doc<"samples"> => sample != null);
    } else {
      const orderedSamples = await ctx.db
        .query("samples")
        .order("asc")
        .take(cursor + args.max_samples + 1);
      const page = orderedSamples.slice(cursor, cursor + args.max_samples + 1);
      samples = page.slice(0, args.max_samples);
      if (page.length > args.max_samples) {
        nextCursor = cursor + args.max_samples;
      }
    }

    const rows: Array<{
      sample_id: Id<"samples">;
      run_id: Id<"runs">;
      previous_score_count: number | null;
      previous_score_critic_count: number | null;
      computed_score_count: number;
      computed_score_critic_count: number;
      changed: boolean;
      removed_legacy_fields: boolean;
    }> = [];
    let updated = 0;

    for (const sample of samples) {
      const rawSample = sample as Doc<"samples"> & {
        score_id?: Id<"scores"> | null;
        score_critic_id?: Id<"score_critics"> | null;
      };
      const counts = await getSampleScoreCounts(ctx, sample._id);
      const previousScoreCount = typeof sample.score_count === "number"
        ? sample.score_count
        : null;
      const previousScoreCriticCount = typeof sample.score_critic_count === "number"
        ? sample.score_critic_count
        : null;
      const removedLegacyFields = "score_id" in rawSample || "score_critic_id" in rawSample;
      const changed =
        previousScoreCount !== counts.score_count
        || previousScoreCriticCount !== counts.score_critic_count
        || removedLegacyFields;

      if (changed && !args.dry_run) {
        await ctx.db.replace(sample._id, {
          run_id: sample.run_id,
          experiment_id: sample.experiment_id,
          model: sample.model,
          seed: sample.seed,
          rubric_id: sample.rubric_id,
          rubric_critic_id: sample.rubric_critic_id,
          score_count: counts.score_count,
          score_critic_count: counts.score_critic_count,
        });
      }
      if (changed) {
        updated += 1;
      }

      rows.push({
        sample_id: sample._id,
        run_id: sample.run_id,
        previous_score_count: previousScoreCount,
        previous_score_critic_count: previousScoreCriticCount,
        computed_score_count: counts.score_count,
        computed_score_critic_count: counts.score_critic_count,
        changed,
        removed_legacy_fields: removedLegacyFields,
      });
    }

    return {
      dry_run: args.dry_run,
      processed: samples.length,
      updated,
      next_cursor: nextCursor,
      rows,
    };
  },
});
