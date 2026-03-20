import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Doc, Id } from "../../_generated/dataModel";
import { api, internal } from "../../_generated/api";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { zMutation, zQuery } from "../../utils/custom_fns";
import { RunStageSchema } from "../../models/experiments";
import { buildExternalTraceRef } from "../telemetry/events";

const ProcessTypeSchema = z.enum(["run", "window"]);
const DebugActionTypeSchema = z.enum(["repair_stage_transport"]);
const StuckReasonSchema = z.enum([
  "raw_collection_no_progress",
  "retryable_no_transport",
  "stage_transition_no_transport",
  "pending_requests_on_dead_transport",
]);

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
    recoverable_stage_stalls: z.array(z.object({
      stage: z.string(),
      retryable_targets: z.number(),
    })),
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

const DebugActionSchema = z.object({
  action: z.literal("repair_stage_transport"),
  process_type: ProcessTypeSchema,
  process_id: z.string(),
  stage: z.string(),
});

const DebugActionResultSchema = z.object({
  action: DebugActionTypeSchema,
  entity_id: z.string().nullable().optional(),
  status: z.enum(["applied", "skipped", "failed"]),
  reason: z.string(),
});

const RepairRunStageTransportResultSchema = z.object({
  run_id: z.string(),
  stage: z.string(),
  dry_run: z.boolean(),
  outcome: z.enum([
    "missing_process",
    "invalid_stage",
    "not_running",
    "stage_mismatch",
    "active_transport_exists",
    "repaired",
    "reenqueued_stage",
    "no_pending_requests",
    "no_repair_needed",
  ]),
  repaired_request_count: z.number(),
  pending_request_count: z.number(),
  detached_batch_ids: z.array(z.string()),
  detached_job_ids: z.array(z.string()),
  active_transport_present: z.boolean(),
  scheduler_started: z.boolean(),
});

type ProcessRow =
  | { process_type: "run"; row: Doc<"runs"> }
  | { process_type: "window"; row: Doc<"windows"> };

type LocalTraceEvent = {
  trace_id: string;
  seq: number;
  entity_type: string;
  entity_id: string;
  event_name: string;
  stage?: string | null;
  status?: string | null;
  custom_key?: string | null;
  ts_ms: number;
  payload_json?: string | null;
};

const ACTIVE_STATUSES = new Set(["start", "queued", "running"]);

function groupCounts(values: string[]) {
  const grouped = new Map<string, number>();
  for (const value of values) {
    grouped.set(value, (grouped.get(value) ?? 0) + 1);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, count]) => ({ class: name, count }));
}

function buildEntityStates(recentEvents: LocalTraceEvent[]) {
  const latestByEntity = new Map<string, z.infer<typeof HealthSummarySchema>["entity_states"][number]>();
  for (const event of recentEvents) {
    latestByEntity.set(`${event.entity_type}:${event.entity_id}`, {
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      last_event_name: event.event_name,
      last_status: event.status ?? null,
      last_stage: event.stage ?? null,
      last_ts_ms: event.ts_ms,
    });
  }
  return [...latestByEntity.values()].sort((left, right) => right.last_ts_ms - left.last_ts_ms);
}

async function getProcessRow(
  ctx: QueryCtx | MutationCtx,
  process_type: "run" | "window",
  process_id: string,
): Promise<ProcessRow | null> {
  if (process_type === "run") {
    const row = await ctx.db.get(process_id as Id<"runs">);
    return row ? { process_type, row } : null;
  }
  const row = await ctx.db.get(process_id as Id<"windows">);
  return row ? { process_type, row } : null;
}

async function getProcessObservability(
  ctx: QueryCtx | MutationCtx,
  process_type: "run" | "window",
  process_id: string,
) {
  return ctx.runQuery(internal.domain.telemetry.events.getProcessObservability, {
    process_type,
    process_id,
  });
}

async function listProcessAttempts(
  ctx: QueryCtx | MutationCtx,
  process_type: "run" | "window",
  process_id: string,
) {
  return ctx.db
    .query("llm_attempts")
    .withIndex("by_process", (q) =>
      q.eq("process_kind", process_type).eq("process_id", process_id),
    )
    .collect();
}

async function buildRunStageProgress(
  ctx: QueryCtx | MutationCtx,
  run_id: Id<"runs">,
) {
  const summary = await ctx.runQuery(internal.domain.runs.experiments_data.getRunSummary, {
    run_id,
  });
  return summary.stages.map((stage) => ({
    stage: stage.stage,
    target_total: stage.total,
    completed: stage.completed,
    pending: Math.max(0, stage.total - stage.completed - stage.failed),
    failed: stage.failed,
  }));
}

async function buildWindowStageProgress(
  ctx: QueryCtx | MutationCtx,
  window_id: Id<"windows">,
  targetCount: number,
) {
  const evidences = await ctx.db
    .query("evidences")
    .withIndex("by_window_id", (q) => q.eq("window_id", window_id))
    .collect();

  const collectCompleted = evidences.length;
  const collectFailed = 0;

  let l1Completed = 0;
  let l1Failed = 0;
  let l2Completed = 0;
  let l2Failed = 0;
  let l3Completed = 0;
  let l3Failed = 0;

  for (const evidence of evidences) {
    if (evidence.l1_cleaned_content) l1Completed += 1;
    else if (evidence.l1_error_message) l1Failed += 1;

    if (evidence.l2_neutralized_content) l2Completed += 1;
    else if (evidence.l2_error_message) l2Failed += 1;

    if (evidence.l3_abstracted_content) l3Completed += 1;
    else if (evidence.l3_error_message) l3Failed += 1;
  }

  return [
    {
      stage: "collect",
      target_total: targetCount,
      completed: collectCompleted,
      pending: Math.max(0, targetCount - collectCompleted - collectFailed),
      failed: collectFailed,
    },
    {
      stage: "l1_cleaned",
      target_total: evidences.length,
      completed: l1Completed,
      pending: Math.max(0, evidences.length - l1Completed - l1Failed),
      failed: l1Failed,
    },
    {
      stage: "l2_neutralized",
      target_total: evidences.length,
      completed: l2Completed,
      pending: Math.max(0, evidences.length - l2Completed - l2Failed),
      failed: l2Failed,
    },
    {
      stage: "l3_abstracted",
      target_total: evidences.length,
      completed: l3Completed,
      pending: Math.max(0, evidences.length - l3Completed - l3Failed),
      failed: l3Failed,
    },
  ];
}

async function buildErrorSummaries(
  ctx: QueryCtx | MutationCtx,
  process: ProcessRow,
  attempts: Doc<"llm_attempts">[],
) {
  const historical: string[] = [];
  const terminal: string[] = [];

  for (const attempt of attempts) {
    if (attempt.status !== "failed") continue;
    historical.push(attempt.stage);
  }

  if (process.process_type === "run") {
    const sampleRows = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", process.row._id))
      .collect();
    const targetRows = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", process.row._id))
      .collect();

    for (const sample of sampleRows) {
      if (sample.rubric_gen_error_message) terminal.push("rubric_gen");
      if (sample.rubric_critic_error_message) terminal.push("rubric_critic");
    }
    for (const target of targetRows) {
      if (target.score_gen_error_message) terminal.push("score_gen");
      if (target.score_critic_error_message) terminal.push("score_critic");
    }
  } else {
    const evidences = await ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("window_id", process.row._id))
      .collect();
    for (const evidence of evidences) {
      if (evidence.l1_error_message) terminal.push("l1_cleaned");
      if (evidence.l2_error_message) terminal.push("l2_neutralized");
      if (evidence.l3_error_message) terminal.push("l3_abstracted");
    }
  }

  if (process.row.last_error_message) {
    historical.push("process_error");
    terminal.push("process_error");
  }

  return {
    error_summary: groupCounts(terminal),
    historical_error_summary: groupCounts(historical),
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
  const process = await getProcessRow(ctx, args.process_type, args.process_id);
  if (!process) {
    throw new Error(`${args.process_type} not found: ${args.process_id}`);
  }

  const [observability, attempts] = await Promise.all([
    getProcessObservability(ctx, args.process_type, args.process_id),
    listProcessAttempts(ctx, args.process_type, args.process_id),
  ]);

  const stage_progress = process.process_type === "run"
    ? await buildRunStageProgress(ctx, process.row._id)
    : await buildWindowStageProgress(ctx, process.row._id, process.row.target_count);
  const { error_summary, historical_error_summary } = await buildErrorSummaries(ctx, process, attempts);

  const latestUpdatedAt = observability?.updated_at_ms ?? null;
  const milestone = observability?.last_milestone_at_ms ?? latestUpdatedAt ?? process.row._creationTime;
  const noProgressForMs = ACTIVE_STATUSES.has(process.row.status)
    ? Math.max(0, Date.now() - milestone)
    : null;
  const pendingStages = stage_progress.filter((stage) => stage.pending > 0);
  const recent_events = (observability?.recent_events ?? [])
    .slice(-(args.include_recent_events ?? 25));

  return {
    process_type: args.process_type,
    process_id: args.process_id,
    trace_id: observability?.trace_id ?? `${args.process_type}:${args.process_id}`,
    telemetry_backend: "axiom",
    external_trace_ref: observability?.external_trace_ref
      ?? buildExternalTraceRef(`${args.process_type}:${args.process_id}`),
    status: process.row.status,
    current_stage: process.row.current_stage,
    stage_progress,
    active_transport: {
      queued_batches: 0,
      running_batches: 0,
      queued_jobs: 0,
      running_jobs: 0,
      orphaned_requests: 0,
    },
    stalled_signals: {
      no_progress_for_ms: noProgressForMs,
      oldest_pending_request_age_ms: pendingStages.length > 0 ? noProgressForMs : null,
      scheduler_scheduled: false,
      recoverable_stage_stalls: noProgressForMs != null && noProgressForMs > 0 && pendingStages.length > 0
        ? [{
            stage: process.row.current_stage,
            retryable_targets: pendingStages.reduce((sum, stage) => sum + stage.pending, 0),
          }]
        : [],
    },
    request_state_meta: {
      approximate: false,
      scanned_targets: stage_progress.reduce((sum, stage) => sum + stage.target_total, 0),
      latest_updated_at_ms: latestUpdatedAt,
    },
    error_summary,
    historical_error_summary,
    recent_events,
    entity_states: buildEntityStates(recent_events),
  };
}

async function detectStuckWorkForProcess(
  ctx: QueryCtx | MutationCtx,
  process: ProcessRow,
  older_than_ms: number,
): Promise<Array<z.infer<typeof StuckWorkSchema>>> {
  if (process.row.status === "completed" || process.row.status === "canceled" || process.row.status === "paused") {
    return [];
  }

  const observability = await getProcessObservability(ctx, process.process_type, String(process.row._id));
  const lastProgressAt = observability?.last_milestone_at_ms ?? observability?.updated_at_ms ?? process.row._creationTime;
  const ageMs = Math.max(0, Date.now() - lastProgressAt);
  if (ageMs < older_than_ms) {
    return [];
  }

  const stage = process.row.current_stage;
  const base = {
    process_type: process.process_type,
    process_id: String(process.row._id),
    entity_type: process.process_type,
    entity_id: String(process.row._id),
    custom_key: `${process.process_type}:${process.row._id}:${stage}`,
    age_ms: ageMs,
  } as const;

  if (!process.row.workflow_id) {
    return [{
      ...base,
      reason: stage === "l0_raw" ? "raw_collection_no_progress" : "stage_transition_no_transport",
      details: "Process has no bound Temporal workflow",
    }];
  }

  if (process.row.status === "error" && process.row.last_error_message) {
    return [{
      ...base,
      reason: "retryable_no_transport",
      details: process.row.last_error_message,
    }];
  }

  if (ACTIVE_STATUSES.has(process.row.status)) {
    return [{
      ...base,
      reason: stage === "l0_raw" ? "raw_collection_no_progress" : "pending_requests_on_dead_transport",
      details: "Temporal workflow is bound but no recent process projection was recorded",
    }];
  }

  return [];
}

async function repairStageTransport(
  ctx: MutationCtx,
  action: z.infer<typeof DebugActionSchema>,
  dry_run: boolean,
): Promise<z.infer<typeof DebugActionResultSchema>> {
  const process = await getProcessRow(ctx, action.process_type, action.process_id);
  if (!process) {
    return {
      action: action.action,
      entity_id: `${action.process_type}:${action.process_id}`,
      status: "skipped",
      reason: "missing_process",
    };
  }

  if (process.row.current_stage !== action.stage) {
    return {
      action: action.action,
      entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
      status: "skipped",
      reason: "stage_mismatch",
    };
  }

  if (process.row.status === "completed" || process.row.status === "canceled") {
    return {
      action: action.action,
      entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
      status: "skipped",
      reason: "not_running",
    };
  }

  if (dry_run) {
    return {
      action: action.action,
      entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
      status: "skipped",
      reason: "dry_run",
    };
  }

  if (process.process_type === "run") {
    if (process.row.status === "paused") {
      await ctx.runMutation(internal.domain.runs.run_service.resumePausedRunFlow, {
        run_id: process.row._id,
        pause_after: process.row.pause_after ?? null,
        start_scheduler: false,
      });
    } else if (process.row.workflow_id) {
      await ctx.scheduler.runAfter(0, internal.domain.runs.run_service.resumeRunExecution, {
        run_id: process.row._id,
        pause_after: process.row.pause_after ?? null,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.domain.runs.run_service.startRunExecution, {
        run_id: process.row._id,
        pause_after: process.row.pause_after ?? null,
      });
    }
  } else if (process.row.workflow_id) {
    await ctx.scheduler.runAfter(0, internal.packages.lab.resumeWindowExecution, {
      window_id: process.row._id,
      evidence_limit: process.row.target_count,
    });
  } else {
    await ctx.scheduler.runAfter(0, internal.packages.lab.startWindowFlow, {
      window_id: process.row._id,
      evidence_limit: process.row.target_count,
    });
  }

  return {
    action: action.action,
    entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
    status: "applied",
    reason: process.row.workflow_id ? "workflow_nudged" : "workflow_started",
  };
}

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
        queued_batches: z.number(),
        submitting_batches: z.number(),
        running_batches: z.number(),
        finalizing_batches: z.number(),
        queued_jobs: z.number(),
        orphaned_requests: z.number(),
        candidate_runs: z.number(),
        candidate_windows: z.number(),
        health_checks: z.number(),
      }),
    }),
  }),
  handler: async (ctx, args) => {
    const [runs, windows] = await Promise.all([
      !args.process_type || args.process_type === "run"
        ? ctx.db.query("runs").collect()
        : Promise.resolve([] as Doc<"runs">[]),
      !args.process_type || args.process_type === "window"
        ? ctx.db.query("windows").collect()
        : Promise.resolve([] as Doc<"windows">[]),
    ]);

    const items: Array<z.infer<typeof StuckWorkSchema>> = [];
    let healthChecks = 0;
    for (const run of runs) {
      healthChecks += 1;
      items.push(...await detectStuckWorkForProcess(ctx, { process_type: "run", row: run }, args.older_than_ms));
      if (items.length >= args.limit) break;
    }
    if (items.length < args.limit) {
      for (const window of windows) {
        healthChecks += 1;
        items.push(...await detectStuckWorkForProcess(ctx, { process_type: "window", row: window }, args.older_than_ms));
        if (items.length >= args.limit) break;
      }
    }

    return {
      checked_at_ms: Date.now(),
      items: items.slice(0, args.limit),
      meta: {
        truncated: items.length > args.limit,
        scan_caps_hit: false,
        health_checks_limited: false,
        scanned: {
          queued_batches: 0,
          submitting_batches: 0,
          running_batches: 0,
          finalizing_batches: 0,
          queued_jobs: 0,
          orphaned_requests: 0,
          candidate_runs: runs.length,
          candidate_windows: windows.length,
          health_checks: healthChecks,
        },
      },
    };
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
        results.push(await repairStageTransport(ctx, action, args.dry_run));
      } catch (error) {
        results.push({
          action: action.action,
          entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
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
    max_actions: z.number().int().min(1).max(500).default(120),
    max_stage_scan: z.number().int().min(1).max(5000).default(1200),
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
    const process = await getProcessRow(ctx, args.process_type, args.process_id);
    if (!process) {
      throw new Error(`${args.process_type} not found: ${args.process_id}`);
    }

    const stuckItems = await detectStuckWorkForProcess(ctx, process, args.older_than_ms);
    const uniqueStages = new Set(
      stuckItems
        .filter((item) =>
          item.reason === "raw_collection_no_progress"
          || item.reason === "retryable_no_transport"
          || item.reason === "stage_transition_no_transport"
          || item.reason === "pending_requests_on_dead_transport")
        .map(() => process.row.current_stage),
    );
    const orderedActions = [...uniqueStages].map((stage) => ({
      action: "repair_stage_transport" as const,
      process_type: args.process_type,
      process_id: args.process_id,
      stage,
    }));

    const cursor = args.cursor ?? 0;
    const page = orderedActions.slice(cursor, cursor + args.max_actions);
    const nextCursor = cursor + page.length < orderedActions.length
      ? cursor + page.length
      : null;

    const results: Array<z.infer<typeof DebugActionResultSchema>> = [];
    for (const action of page) {
      try {
        results.push(await repairStageTransport(ctx, action, args.dry_run));
      } catch (error) {
        results.push({
          action: action.action,
          entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
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
        request_state_approximate: false,
        scan_caps_hit: false,
        scanned_target_states: 0,
        scanned_batches: 0,
      },
    };
  },
});

export const repairRunStageTransport: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    run_id: zid("runs"),
    stage: RunStageSchema.optional(),
    dry_run: z.boolean().default(true),
    start_scheduler: z.boolean().default(true),
  }),
  returns: RepairRunStageTransportResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof RepairRunStageTransportResultSchema>> => {
    const run = await ctx.db.get(args.run_id);
    if (!run) {
      return {
        run_id: String(args.run_id),
        stage: args.stage ?? "unknown",
        dry_run: args.dry_run,
        outcome: "missing_process",
        repaired_request_count: 0,
        pending_request_count: 0,
        detached_batch_ids: [],
        detached_job_ids: [],
        active_transport_present: false,
        scheduler_started: false,
      };
    }

    const stage = args.stage ?? run.current_stage;
    if (stage !== run.current_stage) {
      return {
        run_id: String(run._id),
        stage,
        dry_run: args.dry_run,
        outcome: "stage_mismatch",
        repaired_request_count: 0,
        pending_request_count: 0,
        detached_batch_ids: [],
        detached_job_ids: [],
        active_transport_present: Boolean(run.workflow_id),
        scheduler_started: false,
      };
    }

    if (run.status === "completed" || run.status === "canceled") {
      return {
        run_id: String(run._id),
        stage,
        dry_run: args.dry_run,
        outcome: "not_running",
        repaired_request_count: 0,
        pending_request_count: 0,
        detached_batch_ids: [],
        detached_job_ids: [],
        active_transport_present: Boolean(run.workflow_id),
        scheduler_started: false,
      };
    }

    const result = await repairStageTransport(ctx, {
      action: "repair_stage_transport",
      process_type: "run",
      process_id: String(run._id),
      stage,
    }, args.dry_run);

    return {
      run_id: String(run._id),
      stage,
      dry_run: args.dry_run,
      outcome: result.status === "applied"
        ? (run.workflow_id ? "repaired" : "reenqueued_stage")
        : result.reason === "not_running"
          ? "not_running"
          : result.reason === "stage_mismatch"
            ? "stage_mismatch"
            : "no_repair_needed",
      repaired_request_count: 0,
      pending_request_count: 0,
      detached_batch_ids: [],
      detached_job_ids: [],
      active_transport_present: Boolean(run.workflow_id),
      scheduler_started: false,
    };
  },
});
