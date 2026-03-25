import z from "zod";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { zMutation, zQuery } from "../../utils/custom_fns";
import { ProcessTypeSchema } from "../temporal/schemas";

const DebugActionTypeSchema = z.enum(["repair_process_execution"]);
const StuckReasonSchema = z.enum([
  "missing_workflow_binding",
  "retryable_stage_failure",
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

const ACTIVE_STATUSES = new Set(["start", "queued", "running", "paused"]);
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

function buildEntityStatesFromEvents(
  events: Array<{
    entity_type: string;
    entity_id: string;
    event_name: string;
    status?: string | null;
    stage?: string | null;
    ts_ms: number;
  }>,
) {
  const latestByEntity = new Map<string, {
    entity_type: string;
    entity_id: string;
    last_event_name: string;
    last_status: string | null;
    last_stage: string | null;
    last_ts_ms: number;
  }>();

  for (const event of events) {
    const key = `${event.entity_type}:${event.entity_id}`;
    const current = latestByEntity.get(key);
    if (!current || event.ts_ms >= current.last_ts_ms) {
      latestByEntity.set(key, {
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        last_event_name: event.event_name,
        last_status: event.status ?? null,
        last_stage: event.stage ?? null,
        last_ts_ms: event.ts_ms,
      });
    }
  }

  return [...latestByEntity.values()].sort((left, right) => left.last_ts_ms - right.last_ts_ms);
}

async function getRun(ctx: QueryCtx | MutationCtx, process_id: string) {
  return ctx.db.get(process_id as Id<"runs">);
}

async function buildRunStageProgress(
  ctx: QueryCtx | MutationCtx,
  run_id: Id<"runs">,
) {
  const summary = await ctx.runQuery(internal.domain.runs.experiments_service.getRunSummary, {
    run_id,
  });
  return summary.stages.map((stage: (typeof summary.stages)[number]) => ({
    stage: stage.stage,
    target_total: stage.total,
    completed: stage.completed,
    pending: Math.max(0, stage.total - stage.completed - stage.failed),
    failed: stage.failed,
  }));
}

async function buildErrorSummaries(
  ctx: QueryCtx | MutationCtx,
  run: Doc<"runs">,
  attempts: Doc<"llm_attempts">[],
) {
  const historical = attempts
    .filter((attempt) => attempt.status === "failed")
    .map((attempt) => attempt.stage);
  const terminal: string[] = [];

  const [samples, targets] = await Promise.all([
    ctx.db.query("samples").withIndex("by_run", (q) => q.eq("run_id", run._id)).collect(),
    ctx.db.query("sample_score_targets").withIndex("by_run", (q) => q.eq("run_id", run._id)).collect(),
  ]);

  for (const sample of samples) {
    if (sample.rubric_gen_error_message) terminal.push("rubric_gen");
    if (sample.rubric_critic_error_message) terminal.push("rubric_critic");
  }
  for (const target of targets) {
    if (target.score_gen_error_message) terminal.push("score_gen");
    if (target.score_critic_error_message) terminal.push("score_critic");
  }
  if (run.last_error_message) {
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
    process_type: "run";
    process_id: string;
    include_recent_events?: number;
  },
) {
  const run = await getRun(ctx, args.process_id);
  if (!run) {
    throw new Error(`Run ${args.process_id} not found.`);
  }

  const [attempts, observability, stage_progress] = await Promise.all([
    ctx.db
      .query("llm_attempts")
      .withIndex("by_process", (q) => q.eq("process_kind", "run").eq("process_id", args.process_id))
      .collect(),
    ctx.runQuery(internal.domain.telemetry.events.getProcessObservability, {
      process_type: "run",
      process_id: args.process_id,
    }),
    buildRunStageProgress(ctx, run._id),
  ]);

  const errorSummaries = await buildErrorSummaries(ctx, run, attempts);
  const lastUpdatedAt = observability?.updated_at_ms ?? null;
  const noProgressForMs = lastUpdatedAt == null ? null : Math.max(0, Date.now() - lastUpdatedAt);
  const retryableTargets = errorSummaries.error_summary
    .filter((row) => row.class !== "process_error")
    .map((row) => ({
      stage: row.class,
      retryable_targets: row.count,
    }));

  return {
    process_type: "run" as const,
    process_id: args.process_id,
    trace_id: `run:${args.process_id}`,
    telemetry_backend: "axiom" as const,
    external_trace_ref: null,
    status: run.status,
    current_stage: run.current_stage,
    stage_progress,
    execution_binding: {
      workflow_bound: run.workflow_id != null,
      workflow_id: run.workflow_id ?? null,
      workflow_run_id: run.workflow_run_id ?? null,
      projection_fresh:
        lastUpdatedAt != null && Date.now() - lastUpdatedAt <= ACTIVE_PROJECTION_FRESH_MS,
    },
    stalled_signals: {
      no_progress_for_ms: noProgressForMs,
      oldest_pending_request_age_ms: null,
      recoverable_stage_stalls: retryableTargets,
    },
    projection_meta: {
      approximate: false,
      scanned_targets: stage_progress.reduce((sum: number, stage) => sum + stage.target_total, 0),
      latest_updated_at_ms: lastUpdatedAt,
      last_milestone_at_ms: observability?.last_milestone_at_ms ?? null,
      projection_fresh:
        lastUpdatedAt != null && Date.now() - lastUpdatedAt <= ACTIVE_PROJECTION_FRESH_MS,
    },
    error_summary: errorSummaries.error_summary,
    historical_error_summary: errorSummaries.historical_error_summary,
    recent_events: (observability?.recent_events ?? []).slice(
      -1 * (args.include_recent_events ?? 50),
    ),
    entity_states: buildEntityStatesFromEvents(observability?.recent_events ?? []),
  };
}

async function detectStuckWorkForRun(
  ctx: QueryCtx | MutationCtx,
  run: Doc<"runs">,
  older_than_ms: number,
) {
  const items: Array<z.infer<typeof StuckWorkSchema>> = [];
  const health = await collectProcessHealth(ctx, {
    process_type: "run",
    process_id: String(run._id),
    include_recent_events: 10,
  });

  if (!health.execution_binding.workflow_bound) {
    items.push({
      process_type: "run",
      process_id: String(run._id),
      reason: "missing_workflow_binding",
      entity_type: "run",
      entity_id: String(run._id),
      custom_key: null,
      age_ms: null,
      details: "Run is active but has no Temporal workflow binding.",
    });
  }

  if (
    health.stalled_signals.no_progress_for_ms != null
    && health.stalled_signals.no_progress_for_ms >= older_than_ms
  ) {
    items.push({
      process_type: "run",
      process_id: String(run._id),
      reason: "stale_projection",
      entity_type: "run",
      entity_id: String(run._id),
      custom_key: null,
      age_ms: health.stalled_signals.no_progress_for_ms,
      details: "Run projection has not advanced recently.",
    });
  }

  for (const stall of health.stalled_signals.recoverable_stage_stalls) {
    items.push({
      process_type: "run",
      process_id: String(run._id),
      reason: "retryable_stage_failure",
      entity_type: "run",
      entity_id: String(run._id),
      custom_key: stall.stage,
      age_ms: null,
      details: `${stall.retryable_targets} targets failed in ${stall.stage}.`,
    });
  }

  return items;
}

async function repairProcessExecutionAction(
  ctx: MutationCtx,
  action: z.infer<typeof DebugActionSchema>,
  dry_run: boolean,
): Promise<z.infer<typeof DebugActionResultSchema>> {
  const run = await ctx.db.get(action.process_id as Id<"runs">);
  if (!run) {
    return {
      action: action.action,
      entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
      status: "skipped",
      reason: "run_missing",
    };
  }

  if (!ACTIVE_STATUSES.has(run.status)) {
    return {
      action: action.action,
      entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
      status: "skipped",
      reason: `run_not_active:${run.status}`,
    };
  }

  if (!dry_run && run.workflow_id) {
    await ctx.scheduler.runAfter(0, internal.domain.temporal.temporal_client.controlProcessWorkflow, {
      process_type: "run",
      process_id: String(run._id),
      action: run.status === "paused" ? "resume" : "repair_bounded",
      operation: run.status === "paused" ? undefined : "reproject_snapshot",
    });
  }

  return {
    action: action.action,
    entity_id: `${action.process_type}:${action.process_id}:${action.stage}`,
    status: "applied",
    reason: run.workflow_id ? "workflow_nudged" : "workflow_missing",
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
        health_checks: z.number(),
      }),
    }),
  }),
  handler: async (ctx, args) => {
    const runs = !args.process_type || args.process_type === "run"
      ? await ctx.db.query("runs").collect()
      : [];

    const items: Array<z.infer<typeof StuckWorkSchema>> = [];
    let healthChecks = 0;
    for (const run of runs) {
      healthChecks += 1;
      items.push(...await detectStuckWorkForRun(ctx, run, args.older_than_ms));
      if (items.length >= args.limit) break;
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
    older_than_ms: z.number().int().min(1).default(120_000),
    dry_run: z.boolean().default(false),
  }),
  returns: z.object({
    health: HealthSummarySchema,
    healed: z.boolean(),
    actions: z.array(DebugActionResultSchema),
  }),
  handler: async (ctx, args) => {
    const health = await collectProcessHealth(ctx, args);
    const stuck = await detectStuckWorkForRun(
      ctx,
      await getRun(ctx, args.process_id) as Doc<"runs">,
      args.older_than_ms,
    );
    const actions = stuck.length === 0
      ? []
      : [
          await repairProcessExecutionAction(ctx, {
            action: "repair_process_execution",
            process_type: "run",
            process_id: args.process_id,
            stage: health.current_stage,
          }, args.dry_run),
        ];
    return {
      health,
      healed: actions.some((action) => action.status === "applied"),
      actions,
    };
  },
});

export const repairProcessExecution: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    process_type: ProcessTypeSchema,
    process_id: z.string(),
    stage: z.string(),
    dry_run: z.boolean().default(true),
  }),
  returns: RepairProcessExecutionResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof RepairProcessExecutionResultSchema>> => {
    const run = await getRun(ctx, args.process_id);
    if (!run) {
      return {
        process_type: "run",
        process_id: args.process_id,
        stage: args.stage,
        dry_run: args.dry_run,
        outcome: "missing_process",
        workflow_bound_before: false,
      };
    }
    if (!ACTIVE_STATUSES.has(run.status)) {
      return {
        process_type: "run",
        process_id: args.process_id,
        stage: args.stage,
        dry_run: args.dry_run,
        outcome: "not_running",
        workflow_bound_before: run.workflow_id != null,
      };
    }

    if (!args.dry_run && run.workflow_id) {
      await ctx.scheduler.runAfter(0, internal.domain.temporal.temporal_client.controlProcessWorkflow, {
        process_type: "run",
        process_id: args.process_id,
        action: run.status === "paused" ? "resume" : "repair_bounded",
        operation: run.status === "paused" ? undefined : "reproject_snapshot",
      });
    }

    return {
      process_type: "run",
      process_id: args.process_id,
      stage: args.stage,
      dry_run: args.dry_run,
      outcome: run.workflow_id ? (run.status === "paused" ? "execution_resumed" : "repaired") : "no_repair_needed",
      workflow_bound_before: run.workflow_id != null,
    };
  },
});
