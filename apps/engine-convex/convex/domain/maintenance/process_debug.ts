import z from "zod";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { zMutation, zQuery } from "../../utils/custom_fns";
import { buildExternalTraceRef } from "../telemetry/events";
import { ProcessTypeSchema } from "../temporal/schemas";
const DebugActionTypeSchema = z.enum(["repair_process_execution"]);
const StuckReasonSchema = z.enum([
  "raw_collection_no_progress",
  "retryable_stage_failure",
  "missing_workflow_binding",
  "stale_projection",
]);

const StageProgressSchema = z.object({
  stage: z.string(),
  target_total: z.number(),
  completed: z.number(),
  pending: z.number(),
  failed: z.number(),
});

const ProjectionMetaSchema = z.object({
  approximate: z.boolean(),
  scanned_targets: z.number(),
  latest_updated_at_ms: z.number().nullable(),
  last_milestone_at_ms: z.number().nullable(),
  projection_fresh: z.boolean(),
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
  execution_binding: z.object({
    workflow_bound: z.boolean(),
    workflow_id: z.string().nullable(),
    workflow_run_id: z.string().nullable(),
    projection_fresh: z.boolean(),
  }),
  stalled_signals: z.object({
    no_progress_for_ms: z.number().nullable(),
    oldest_pending_request_age_ms: z.number().nullable(),
    recoverable_stage_stalls: z.array(z.object({
      stage: z.string(),
      retryable_targets: z.number(),
    })),
  }),
  projection_meta: ProjectionMetaSchema,
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
  action: z.literal("repair_process_execution"),
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

const RepairProcessExecutionResultSchema = z.object({
  process_type: ProcessTypeSchema,
  process_id: z.string(),
  stage: z.string(),
  dry_run: z.boolean(),
  outcome: z.enum([
    "missing_process",
    "not_running",
    "stage_mismatch",
    "repaired",
    "execution_started",
    "execution_resumed",
    "no_repair_needed",
  ]),
  workflow_bound_before: z.boolean(),
});

type ProcessRow =
  | { process_type: "run"; row: Doc<"runs"> }
  | { process_type: "window"; row: Doc<"window_runs"> };

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
const ACTIVE_PROJECTION_FRESH_MS = 30_000;

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
  const row = await ctx.db.get(process_id as Id<"window_runs">);
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
  const summary = await ctx.runQuery(internal.domain.runs.experiments_service.getRunSummary, {
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
  window_run_id: Id<"window_runs">,
  targetCount: number,
) {
  const evidences = await ctx.db
    .query("evidences")
    .withIndex("by_window_run_id", (q) => q.eq("window_run_id", window_run_id))
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
      .withIndex("by_window_run_id", (q) => q.eq("window_run_id", process.row._id))
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
  const lastMilestoneAt = observability?.last_milestone_at_ms ?? latestUpdatedAt ?? process.row._creationTime;
  const milestone = lastMilestoneAt;
  const noProgressForMs = ACTIVE_STATUSES.has(process.row.status)
    ? Math.max(0, Date.now() - milestone)
    : null;
  const projectionFresh = process.row.status === "completed"
    || process.row.status === "canceled"
    || process.row.status === "paused"
    || latestUpdatedAt == null
    || Math.max(0, Date.now() - latestUpdatedAt) <= ACTIVE_PROJECTION_FRESH_MS;
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
    execution_binding: {
      workflow_bound: Boolean(process.row.workflow_id),
      workflow_id: process.row.workflow_id ?? null,
      workflow_run_id: process.row.workflow_run_id ?? null,
      projection_fresh: projectionFresh,
    },
    stalled_signals: {
      no_progress_for_ms: noProgressForMs,
      oldest_pending_request_age_ms: pendingStages.length > 0 ? noProgressForMs : null,
      recoverable_stage_stalls: noProgressForMs != null && noProgressForMs > 0 && pendingStages.length > 0
        ? [{
            stage: process.row.current_stage,
            retryable_targets: pendingStages.reduce((sum, stage) => sum + stage.pending, 0),
          }]
        : [],
    },
    projection_meta: {
      approximate: false,
      scanned_targets: stage_progress.reduce((sum, stage) => sum + stage.target_total, 0),
      latest_updated_at_ms: latestUpdatedAt,
      last_milestone_at_ms: lastMilestoneAt,
      projection_fresh: projectionFresh,
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
      reason: "missing_workflow_binding",
      details: "Process has no bound Temporal workflow",
    }];
  }

  if (process.row.status === "error" && process.row.last_error_message) {
    return [{
      ...base,
      reason: "retryable_stage_failure",
      details: process.row.last_error_message,
    }];
  }

  if (ACTIVE_STATUSES.has(process.row.status)) {
    return [{
      ...base,
      reason: stage === "l0_raw" ? "raw_collection_no_progress" : "stale_projection",
      details: "Temporal workflow is bound but no recent process projection was recorded",
    }];
  }

  return [];
}

async function repairProcessExecutionAction(
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
    if (!process.row.workflow_id) {
      if (process.row.status === "paused") {
        await ctx.runMutation(internal.domain.runs.run_service.resumePausedRunFlow, {
          run_id: process.row._id,
          pause_after: process.row.pause_after ?? null,
          start_scheduler: false,
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.domain.runs.run_service.startRunExecution, {
          run_id: process.row._id,
          pause_after: process.row.pause_after ?? null,
        });
      }
    } else if (process.row.status === "paused") {
      await ctx.scheduler.runAfter(0, internal.domain.temporal.temporal_client.controlProcessWorkflow, {
        process_type: "run",
        process_id: String(process.row._id),
        action: "resume",
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.domain.temporal.temporal_client.controlProcessWorkflow, {
        process_type: "run",
        process_id: String(process.row._id),
        action: "repair_bounded",
        operation: "reproject_snapshot",
      });
    }
  } else {
    if (!process.row.workflow_id) {
      await ctx.scheduler.runAfter(
        0,
        process.row.status === "paused"
          ? internal.packages.lab.resumeWindowExecution
          : internal.packages.lab.startWindowRunFlow,
        {
          window_run_id: process.row._id,
        },
      );
    } else if (process.row.status === "paused") {
      await ctx.scheduler.runAfter(0, internal.domain.temporal.temporal_client.controlProcessWorkflow, {
        process_type: "window",
        process_id: String(process.row._id),
        action: "resume",
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.domain.temporal.temporal_client.controlProcessWorkflow, {
        process_type: "window",
        process_id: String(process.row._id),
        action: "repair_bounded",
        operation: "reproject_snapshot",
      });
    }
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
        ? ctx.db.query("window_runs").collect()
        : Promise.resolve([] as Doc<"window_runs">[]),
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
        results.push(await repairProcessExecutionAction(ctx, action, args.dry_run));
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
      projection_state_approximate: z.boolean(),
      scan_caps_hit: z.boolean(),
      scanned_target_states: z.number(),
      scanned_processes: z.number(),
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
          || item.reason === "retryable_stage_failure"
          || item.reason === "missing_workflow_binding"
          || item.reason === "stale_projection")
        .map(() => process.row.current_stage),
    );
    const orderedActions = [...uniqueStages].map((stage) => ({
      action: "repair_process_execution" as const,
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
        results.push(await repairProcessExecutionAction(ctx, action, args.dry_run));
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
        projection_state_approximate: false,
        scan_caps_hit: false,
        scanned_target_states: 0,
        scanned_processes: 1,
      },
    };
  },
});

export const repairProcessExecution: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    process_type: ProcessTypeSchema,
    process_id: z.string(),
    stage: z.string().optional(),
    dry_run: z.boolean().default(true),
  }),
  returns: RepairProcessExecutionResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof RepairProcessExecutionResultSchema>> => {
    const process = await getProcessRow(ctx, args.process_type, args.process_id);
    if (!process) {
      return {
        process_type: args.process_type,
        process_id: args.process_id,
        stage: args.stage ?? "unknown",
        dry_run: args.dry_run,
        outcome: "missing_process",
        workflow_bound_before: false,
      };
    }

    const stage = args.stage ?? process.row.current_stage;
    if (stage !== process.row.current_stage) {
      return {
        process_type: args.process_type,
        process_id: String(process.row._id),
        stage,
        dry_run: args.dry_run,
        outcome: "stage_mismatch",
        workflow_bound_before: Boolean(process.row.workflow_id),
      };
    }

    if (process.row.status === "completed" || process.row.status === "canceled") {
      return {
        process_type: args.process_type,
        process_id: String(process.row._id),
        stage,
        dry_run: args.dry_run,
        outcome: "not_running",
        workflow_bound_before: Boolean(process.row.workflow_id),
      };
    }

    const workflowBoundBefore = Boolean(process.row.workflow_id);
    const result = await repairProcessExecutionAction(ctx, {
      action: "repair_process_execution",
      process_type: args.process_type,
      process_id: String(process.row._id),
      stage,
    }, args.dry_run);

    return {
      process_type: args.process_type,
      process_id: String(process.row._id),
      stage,
      dry_run: args.dry_run,
      outcome: result.status === "applied"
        ? process.row.status === "paused"
          ? "execution_resumed"
          : workflowBoundBefore
            ? "repaired"
            : "execution_started"
        : result.reason === "not_running"
          ? "not_running"
          : result.reason === "stage_mismatch"
            ? "stage_mismatch"
            : "no_repair_needed",
      workflow_bound_before: workflowBoundBefore,
    };
  },
});
