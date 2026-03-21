import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Id } from "../../_generated/dataModel";
import { api, internal } from "../../_generated/api";
import { zAction, zMutation, zQuery } from "../../utils/custom_fns";
import { RunStageSchema } from "../../models/experiments";
import { StateStatusSchema } from "../../models/_shared";
import { emitTraceEvent } from "../telemetry/emit";

const StartPolicySchema = z.enum(["all", "incomplete_only"]);
const V3LaunchModeSchema = z.enum(["canary", "rubric_gate", "full"]);
export const CampaignStateSchema = z.enum([
  "preflight_clean",
  "healthy_progressing",
  "stalled_recoverable",
  "stalled_unknown",
  "scientifically_invalid",
  "complete",
]);
const ScientificValiditySchema = z.enum([
  "scientifically_valid",
  "scientifically_invalid",
  "scientifically_unknown",
]);

const RecoverableReasonSchema = z.enum([
  "missing_workflow_binding",
  "retryable_stage_failure",
  "stale_projection",
]);
const StuckReasonSchema = z.enum([
  "raw_collection_no_progress",
  "missing_workflow_binding",
  "retryable_stage_failure",
  "stale_projection",
]);

const StageCountsSchema = z.object({
  rubric_gen: z.number(),
  rubric_critic: z.number(),
  score_gen: z.number(),
  score_critic: z.number(),
});

const ScoreTargetEstimateSchema = z.object({
  per_sample: z.number(),
  total_for_latest_run: z.number().nullable(),
});

const V3ExperimentStatusRowSchema = z.object({
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  total_count: z.number(),
  evidence_selected_count: z.number(),
  window_count: z.number(),
  score_target_estimate: ScoreTargetEstimateSchema,
  status: StateStatusSchema,
  latest_run: z.object({
    run_id: zid("runs"),
    status: StateStatusSchema,
    current_stage: RunStageSchema,
    target_count: z.number(),
    completed_count: z.number(),
    pause_after: RunStageSchema.nullable(),
    stage_counts: StageCountsSchema,
    created_at: z.number(),
    has_failures: z.boolean(),
  }).optional(),
});

const WorkloadFamilySummaryRowSchema = z.object({
  estimated_total_score_targets: z.number(),
  experiment_count: z.number(),
  start: z.number(),
  queued: z.number(),
  completed: z.number(),
  running: z.number(),
  paused: z.number(),
  error: z.number(),
  canceled: z.number(),
  with_failures: z.number(),
});

const CampaignStuckSummaryRowSchema = z.object({
  reason: StuckReasonSchema,
  count: z.number(),
});

const CampaignStuckItemSchema = z.object({
  process_type: z.enum(["run", "window"]),
  process_id: z.string(),
  reason: StuckReasonSchema,
  entity_type: z.string(),
  entity_id: z.string(),
  custom_key: z.string().nullable().optional(),
  age_ms: z.number().nullable().optional(),
  details: z.string(),
});

const ResetExperimentRowSchema = z.object({
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  runs_found: z.number(),
  deleted: z.object({
    runs: z.number(),
    samples: z.number(),
    sample_score_targets: z.number(),
    sample_score_target_items: z.number(),
    rubrics: z.number(),
    rubric_critics: z.number(),
    scores: z.number(),
    score_critics: z.number(),
    llm_attempts: z.number(),
    llm_attempt_payloads: z.number(),
    process_observability: z.number(),
  }),
});

const LaunchRowSchema = z.object({
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  action: z.enum(["started", "skipped"]),
  reason: z.string(),
  run_id: zid("runs").nullable(),
});

const ResumeRowSchema = z.object({
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  action: z.enum(["resumed", "skipped"]),
  reason: z.string(),
  run_id: zid("runs").nullable(),
});

const CampaignLaunchConfigSchema = z.object({
  target_count: z.number(),
  pause_after: RunStageSchema.nullable(),
  start_policy: StartPolicySchema,
});

const CampaignTemporalResetRowSchema = z.object({
  process_type: z.literal("run"),
  process_id: z.string(),
  experiment_id: zid("experiments"),
  workflow_id: z.string().nullable(),
  action: z.enum(["skipped", "cancelled"]),
  reason: z.string(),
});

const CampaignResetResultSchema = z.object({
  dry_run: z.boolean(),
  selected_experiment_count: z.number(),
  missing_experiment_tags: z.array(z.string()),
  cancelled_processes: z.array(CampaignTemporalResetRowSchema),
  processed_experiment_count: z.number(),
  rows: z.array(ResetExperimentRowSchema),
  totals: ResetExperimentRowSchema.shape.deleted,
});

const CampaignStartResultSchema = z.object({
  mode: V3LaunchModeSchema,
  config: CampaignLaunchConfigSchema,
  dry_run: z.boolean(),
  selected_experiment_count: z.number(),
  missing_experiment_tags: z.array(z.string()),
  rows: z.array(LaunchRowSchema),
});

const V3_LAUNCH_MODES = {
  canary: {
    target_count: 1,
    pause_after: "rubric_critic" as const,
    start_policy: "all" as const,
  },
  rubric_gate: {
    target_count: 30,
    pause_after: "rubric_critic" as const,
    start_policy: "all" as const,
  },
  full: {
    target_count: 30,
    pause_after: null,
    start_policy: "all" as const,
  },
} as const;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export const GetV3CampaignStatusReturnSchema = z.object({
  selected_experiment_count: z.number(),
  missing_experiment_tags: z.array(z.string()),
  campaign_state: CampaignStateSchema,
  scientific_validity: ScientificValiditySchema,
  launch_ready: z.boolean(),
  counts: z.object({
    total: z.number(),
    with_latest_run: z.number(),
    start: z.number(),
    queued: z.number(),
    running: z.number(),
    paused: z.number(),
    completed: z.number(),
    error: z.number(),
    canceled: z.number(),
    latest_runs_with_failures: z.number(),
  }),
  stage_distribution: z.array(z.object({
    stage: RunStageSchema,
    count: z.number(),
  })),
  workload_family_summary: z.array(WorkloadFamilySummaryRowSchema),
  stuck_summary: z.array(CampaignStuckSummaryRowSchema),
  stuck_items: z.array(CampaignStuckItemSchema),
  experiments: z.array(V3ExperimentStatusRowSchema),
});

type ListedExperiment = z.infer<typeof V3ExperimentStatusRowSchema>;
type RawListedExperiment = Omit<ListedExperiment, "score_target_estimate"> & {
  scoring_config: {
    evidence_bundle_size: number;
  };
};

async function listAllExperiments(ctx: any): Promise<RawListedExperiment[]> {
  return ctx.runQuery(
    internal.domain.runs.experiments_service.listExperiments,
    {},
  ) as Promise<RawListedExperiment[]>;
}

function filterV3Experiments(
  experiments: RawListedExperiment[],
  experimentTags?: string[],
): { selected: RawListedExperiment[]; missingTags: string[] } {
  if (experimentTags && experimentTags.length > 0) {
    const wanted = new Set(experimentTags);
    const selected = experiments.filter((experiment) => wanted.has(experiment.experiment_tag));
    const found = new Set(selected.map((experiment) => experiment.experiment_tag));
    const missingTags = experimentTags.filter((tag) => !found.has(tag));
    return { selected, missingTags };
  }

  return {
    selected: experiments.filter((experiment) => experiment.experiment_tag.startsWith("v3_")),
    missingTags: [],
  };
}

function estimateScoreTargetsPerSample(experiment: RawListedExperiment): number {
  if (experiment.evidence_selected_count <= 0) return 0;
  const bundleSize = Math.max(1, experiment.scoring_config.evidence_bundle_size);
  return Math.ceil(experiment.evidence_selected_count / bundleSize);
}

function summarizeWorkloadFamilies(experiments: RawListedExperiment[]) {
  const summaries = new Map<number, z.infer<typeof WorkloadFamilySummaryRowSchema>>();

  for (const experiment of experiments) {
    const perSample = estimateScoreTargetsPerSample(experiment);
    const estimatedTotal = experiment.latest_run
      ? perSample * experiment.latest_run.target_count
      : 0;
    const current = summaries.get(estimatedTotal) ?? {
      estimated_total_score_targets: estimatedTotal,
      experiment_count: 0,
      start: 0,
      queued: 0,
      completed: 0,
      running: 0,
      paused: 0,
      error: 0,
      canceled: 0,
      with_failures: 0,
    };
    current.experiment_count += 1;
    current[experiment.status] += 1;
    if (experiment.latest_run?.has_failures) {
      current.with_failures += 1;
    }
    summaries.set(estimatedTotal, current);
  }

  return [...summaries.values()].sort(
    (left, right) =>
      left.estimated_total_score_targets - right.estimated_total_score_targets,
  );
}

function toCampaignExperimentRow(experiment: RawListedExperiment): ListedExperiment {
  const perSample = estimateScoreTargetsPerSample(experiment);
  return {
    experiment_id: experiment.experiment_id,
    experiment_tag: experiment.experiment_tag,
    total_count: experiment.total_count,
    evidence_selected_count: experiment.evidence_selected_count,
    window_count: experiment.window_count,
    score_target_estimate: {
      per_sample: perSample,
      total_for_latest_run: experiment.latest_run
        ? perSample * experiment.latest_run.target_count
        : null,
    },
    status: experiment.status,
    latest_run: experiment.latest_run,
  };
}

function classifyCampaignState(args: {
  experiments: RawListedExperiment[];
  missingTags: string[];
  expectedPauseAfter: z.infer<typeof RunStageSchema> | null;
  stuckItems: z.infer<typeof CampaignStuckItemSchema>[];
}) {
  const { experiments, missingTags, expectedPauseAfter, stuckItems } = args;
  const latestRuns = experiments
    .map((experiment) => experiment.latest_run)
    .filter((run): run is NonNullable<ListedExperiment["latest_run"]> => run != null);

  const recoverableReasons = new Set<z.infer<typeof RecoverableReasonSchema>>([
    "missing_workflow_binding",
    "retryable_stage_failure",
    "stale_projection",
  ]);

  const hasInvalidSignals = missingTags.length > 0
    || latestRuns.some((run) => run.has_failures || run.status === "error" || run.status === "canceled");

  if (hasInvalidSignals) {
    return {
      campaign_state: "scientifically_invalid" as const,
      scientific_validity: "scientifically_invalid" as const,
    };
  }

  if (latestRuns.length === 0) {
    return {
      campaign_state: "preflight_clean" as const,
      scientific_validity: "scientifically_unknown" as const,
    };
  }

  const allComplete = experiments.length > 0
    && latestRuns.length === experiments.length
    && latestRuns.every((run) => run.status === "completed");

  const allPausedAtGate = expectedPauseAfter != null
    && experiments.length > 0
    && latestRuns.length === experiments.length
    && latestRuns.every((run) =>
      run.status === "paused"
      && run.current_stage === expectedPauseAfter
      && run.stage_counts[expectedPauseAfter] === run.target_count,
    );

  if (allComplete || allPausedAtGate) {
    return {
      campaign_state: "complete" as const,
      scientific_validity: "scientifically_valid" as const,
    };
  }

  if (stuckItems.length > 0) {
    const onlyRecoverable = stuckItems.every((item) => recoverableReasons.has(item.reason as z.infer<typeof RecoverableReasonSchema>));
    return {
      campaign_state: onlyRecoverable
        ? "stalled_recoverable" as const
        : "stalled_unknown" as const,
      scientific_validity: "scientifically_unknown" as const,
    };
  }

  return {
    campaign_state: "healthy_progressing" as const,
    scientific_validity: "scientifically_unknown" as const,
  };
}

const ACTIVE_RUN_STATUSES = new Set<z.infer<typeof StateStatusSchema>>([
  "start",
  "queued",
  "running",
  "paused",
]);

function isTemporalExecutionActive(temporalStatus: string | null) {
  if (!temporalStatus) return false;
  return temporalStatus === "RUNNING";
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const resetRuns = zMutation({
  args: z.object({
    dry_run: z.boolean().default(true),
    experiment_tags: z.array(z.string()).optional(),
    allow_active: z.boolean().default(false),
    cursor: z.number().int().min(0).optional(),
    max_experiments: z.number().int().min(1).max(64).default(2),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    selected_experiment_count: z.number(),
    processed_experiment_count: z.number(),
    missing_experiment_tags: z.array(z.string()),
    next_cursor: z.number().nullable(),
    rows: z.array(ResetExperimentRowSchema),
    totals: ResetExperimentRowSchema.shape.deleted,
  }),
  handler: async (ctx, args) => {
    const experiments = await listAllExperiments(ctx);
    const filtered = filterV3Experiments(experiments, args.experiment_tags);
    const cursor = args.cursor ?? 0;
    const page = filtered.selected.slice(cursor, cursor + args.max_experiments);
    const nextCursor = cursor + page.length < filtered.selected.length
      ? cursor + page.length
      : null;
    const totals = {
      runs: 0,
      samples: 0,
      sample_score_targets: 0,
      sample_score_target_items: 0,
      rubrics: 0,
      rubric_critics: 0,
      scores: 0,
      score_critics: 0,
      llm_attempts: 0,
      llm_attempt_payloads: 0,
      process_observability: 0,
    };

    const rows = [] as z.infer<typeof ResetExperimentRowSchema>[];
    for (const experiment of page) {
      const runIds: Id<"runs">[] = await ctx.runQuery(
        internal.domain.maintenance.danger.listExperimentRunIds,
        {
          experiment_id: experiment.experiment_id,
        },
      );
      const deleted = {
        runs: 0,
        samples: 0,
        sample_score_targets: 0,
        sample_score_target_items: 0,
        rubrics: 0,
        rubric_critics: 0,
        scores: 0,
        score_critics: 0,
        llm_attempts: 0,
        llm_attempt_payloads: 0,
        process_observability: 0,
      };
      for (const runId of runIds) {
        let hasMore = true;
        while (hasMore) {
          const result = await ctx.runMutation(
            internal.domain.maintenance.danger.deleteRunDataPass,
            {
              run_id: runId,
              limit_per_table: 250,
              isDryRun: args.dry_run,
              allow_active: args.allow_active,
            },
          );
          deleted.runs += result.deleted.runs;
          deleted.samples += result.deleted.samples;
          deleted.sample_score_targets += result.deleted.sample_score_targets;
          deleted.sample_score_target_items += result.deleted.sample_score_target_items;
          deleted.rubrics += result.deleted.rubrics;
          deleted.rubric_critics += result.deleted.rubric_critics;
          deleted.scores += result.deleted.scores;
          deleted.score_critics += result.deleted.score_critics;
          deleted.llm_attempts += result.deleted.llm_attempts;
          deleted.llm_attempt_payloads += result.deleted.llm_attempt_payloads;
          deleted.process_observability += result.deleted.process_observability;
          hasMore = result.has_more;
        }
      }
      if (!args.dry_run) {
        await ctx.db.patch(experiment.experiment_id, { total_count: 0 });
      }
      rows.push({
        experiment_id: experiment.experiment_id,
        experiment_tag: experiment.experiment_tag,
        runs_found: runIds.length,
        deleted,
      });
      for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
        totals[key] += deleted[key];
      }
    }

    return {
      dry_run: args.dry_run,
      selected_experiment_count: filtered.selected.length,
      processed_experiment_count: page.length,
      missing_experiment_tags: filtered.missingTags,
      next_cursor: nextCursor,
      rows,
      totals,
    };
  },
});

export const startV3Experiments = zMutation({
  args: z.object({
    target_count: z.number().int().min(1),
    pause_after: RunStageSchema.nullable().optional(),
    experiment_tags: z.array(z.string()).optional(),
    start_policy: StartPolicySchema.default("all"),
    start_scheduler: z.boolean().default(true),
    dry_run: z.boolean().default(false),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    selected_experiment_count: z.number(),
    missing_experiment_tags: z.array(z.string()),
    rows: z.array(LaunchRowSchema),
  }),
  handler: async (ctx, args) => {
    const experiments = await listAllExperiments(ctx);
    const filtered = filterV3Experiments(experiments, args.experiment_tags);
    const rows = [] as z.infer<typeof LaunchRowSchema>[];

    for (const experiment of filtered.selected) {
      const latestRun = experiment.latest_run;
      if (
        latestRun
        && (latestRun.status === "running"
          || latestRun.status === "queued"
          || latestRun.status === "paused"
          || latestRun.status === "start")
      ) {
        rows.push({
          experiment_id: experiment.experiment_id,
          experiment_tag: experiment.experiment_tag,
          action: "skipped",
          reason: "active_run_exists",
          run_id: null,
        });
        continue;
      }

      if (
        args.start_policy === "incomplete_only"
        && experiment.total_count >= args.target_count
      ) {
        rows.push({
          experiment_id: experiment.experiment_id,
          experiment_tag: experiment.experiment_tag,
          action: "skipped",
          reason: "already_meets_target_count",
          run_id: null,
        });
        continue;
      }

      if (args.dry_run) {
        rows.push({
          experiment_id: experiment.experiment_id,
          experiment_tag: experiment.experiment_tag,
          action: "started",
          reason: "dry_run",
          run_id: null,
        });
        continue;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.domain.runs.run_service.startRunFlowForCampaign,
        {
          experiment_id: experiment.experiment_id,
          experiment_tag: experiment.experiment_tag,
          target_count: args.target_count,
          pause_after: args.pause_after ?? null,
          start_scheduler: args.start_scheduler,
        },
      );
      rows.push({
        experiment_id: experiment.experiment_id,
        experiment_tag: experiment.experiment_tag,
        action: "started",
        reason: "scheduled_start",
        run_id: null,
      });
    }

    return {
      dry_run: args.dry_run,
      selected_experiment_count: filtered.selected.length,
      missing_experiment_tags: filtered.missingTags,
      rows,
    };
  },
});

export const resumeV3Experiments = zMutation({
  args: z.object({
    pause_after: RunStageSchema.nullable().optional(),
    experiment_tags: z.array(z.string()).optional(),
    start_scheduler: z.boolean().default(true),
    dry_run: z.boolean().default(false),
  }),
  returns: z.object({
    dry_run: z.boolean(),
    selected_experiment_count: z.number(),
    missing_experiment_tags: z.array(z.string()),
    rows: z.array(ResumeRowSchema),
  }),
  handler: async (ctx, args) => {
    const experiments = await listAllExperiments(ctx);
    const filtered = filterV3Experiments(experiments, args.experiment_tags);
    const rows = [] as z.infer<typeof ResumeRowSchema>[];

    for (const experiment of filtered.selected) {
      const latestRun = experiment.latest_run;
      if (!latestRun) {
        rows.push({
          experiment_id: experiment.experiment_id,
          experiment_tag: experiment.experiment_tag,
          action: "skipped",
          reason: "no_latest_run",
          run_id: null,
        });
        continue;
      }

      if (latestRun.status !== "paused") {
        rows.push({
          experiment_id: experiment.experiment_id,
          experiment_tag: experiment.experiment_tag,
          action: "skipped",
          reason: "latest_run_not_paused",
          run_id: latestRun.run_id,
        });
        continue;
      }

      if (args.dry_run) {
        rows.push({
          experiment_id: experiment.experiment_id,
          experiment_tag: experiment.experiment_tag,
          action: "resumed",
          reason: "dry_run",
          run_id: latestRun.run_id,
        });
        continue;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.domain.runs.run_service.resumePausedRunFlowForCampaign,
        {
          run_id: latestRun.run_id,
          pause_after: args.pause_after ?? null,
          start_scheduler: args.start_scheduler,
        },
      );

      rows.push({
        experiment_id: experiment.experiment_id,
        experiment_tag: experiment.experiment_tag,
        action: "resumed",
        reason: "scheduled_resume",
        run_id: latestRun.run_id,
      });
    }

    return {
      dry_run: args.dry_run,
      selected_experiment_count: filtered.selected.length,
      missing_experiment_tags: filtered.missingTags,
      rows,
    };
  },
});

export const resetV3Campaign = zAction({
  args: z.object({
    dry_run: z.boolean().default(false),
    experiment_tags: z.array(z.string()).optional(),
    cancel_timeout_ms: z.number().int().min(1).max(60_000).default(10_000),
    cancel_poll_interval_ms: z.number().int().min(100).max(5_000).default(500),
  }),
  returns: CampaignResetResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof CampaignResetResultSchema>> => {
    const experiments = await listAllExperiments(ctx);
    const filtered = filterV3Experiments(experiments, args.experiment_tags);

    const selectedExperimentIds = filtered.selected.map((experiment) => experiment.experiment_id);
    const runs: Array<{
      run_id: Id<"runs">;
      experiment_id: Id<"experiments">;
      status: z.infer<typeof StateStatusSchema>;
      workflow_id: string | null;
      workflow_run_id: string | null;
      current_stage: z.infer<typeof RunStageSchema>;
      pause_after: z.infer<typeof RunStageSchema> | null;
      created_at: number;
    }> = await ctx.runQuery(
      internal.domain.runs.experiments_service.listRunsForExperiments,
      {
        experiment_ids: selectedExperimentIds,
      },
    );

    const activeRuns = runs.filter((run) => ACTIVE_RUN_STATUSES.has(run.status));
    const cancelled_processes: Array<z.infer<typeof CampaignTemporalResetRowSchema>> = [];

    if (!args.dry_run) {
      for (const run of activeRuns) {
        if (!run.workflow_id) {
          cancelled_processes.push({
            process_type: "run",
            process_id: String(run.run_id),
            experiment_id: run.experiment_id,
            workflow_id: null,
            action: "skipped",
            reason: "workflow_not_bound",
          });
          continue;
        }

        const control = await ctx.runAction(
          internal.domain.temporal.temporal_client.controlProcessWorkflow,
          {
            process_type: "run",
            process_id: String(run.run_id),
            action: "cancel",
            cmd_id: `cmd:reset_v3_campaign:cancel:run:${run.run_id}`,
          },
        );
        cancelled_processes.push({
          process_type: "run",
          process_id: String(run.run_id),
          experiment_id: run.experiment_id,
          workflow_id: control.workflow_id,
          action: control.accepted ? "cancelled" : "skipped",
          reason: control.accepted ? "cancel_requested" : (control.reason ?? "cancel_rejected"),
        });
      }

      const deadline = Date.now() + args.cancel_timeout_ms;
      while (Date.now() < deadline) {
        let openCount = 0;
        for (const run of activeRuns) {
          const inspection = await ctx.runAction(
            internal.domain.temporal.temporal_client.inspectProcessWorkflow,
            {
              process_type: "run",
              process_id: String(run.run_id),
            },
          );
          if (inspection.workflow_found && isTemporalExecutionActive(inspection.temporal_status)) {
            openCount += 1;
          }
        }
        if (openCount === 0) {
          break;
        }
        await sleep(args.cancel_poll_interval_ms);
      }

      const stillActive = [] as string[];
      for (const run of activeRuns) {
        const inspection = await ctx.runAction(
          internal.domain.temporal.temporal_client.inspectProcessWorkflow,
          {
            process_type: "run",
            process_id: String(run.run_id),
          },
        );
        if (inspection.workflow_found && isTemporalExecutionActive(inspection.temporal_status)) {
          stillActive.push(String(run.run_id));
        }
      }

      if (stillActive.length > 0) {
        throw new Error(
          `Timed out waiting for Temporal cancellation on runs: ${stillActive.join(", ")}`,
        );
      }
    } else {
      for (const run of activeRuns) {
        cancelled_processes.push({
          process_type: "run",
          process_id: String(run.run_id),
          experiment_id: run.experiment_id,
          workflow_id: run.workflow_id ?? null,
          action: "cancelled",
          reason: "dry_run",
        });
      }
    }

    if (!args.dry_run) {
      for (const run of runs) {
        const scoreTargetIds: Id<"sample_score_targets">[] = await ctx.runQuery(
          internal.domain.maintenance.danger.listRunScoreTargetIds,
          {
            run_id: run.run_id,
          },
        );
        for (const batch of chunkArray(scoreTargetIds, 100)) {
          if (batch.length === 0) continue;
          await ctx.runMutation(
            internal.domain.maintenance.danger.backfillRunScoreTargetItemsBatch,
            {
              run_id: run.run_id,
              score_target_ids: batch,
            },
          );
        }

        const attemptIds: Id<"llm_attempts">[] = await ctx.runQuery(
          internal.domain.maintenance.danger.listRunAttemptIds,
          {
            run_id: run.run_id,
          },
        );
        for (const batch of chunkArray(attemptIds, 100)) {
          if (batch.length === 0) continue;
          await ctx.runMutation(
            internal.domain.maintenance.danger.backfillRunAttemptPayloadsBatch,
            {
              run_id: run.run_id,
              attempt_ids: batch,
            },
          );
        }
      }
    }

    const rows: Array<z.infer<typeof ResetExperimentRowSchema>> = [];
    const totals = {
      runs: 0,
      samples: 0,
      sample_score_targets: 0,
      sample_score_target_items: 0,
      rubrics: 0,
      rubric_critics: 0,
      scores: 0,
      score_critics: 0,
      llm_attempts: 0,
      llm_attempt_payloads: 0,
      process_observability: 0,
    };
    let processed_experiment_count = 0;

    for (const experiment of filtered.selected) {
      const experimentRuns = runs.filter((run) => run.experiment_id === experiment.experiment_id);
      const deleted = {
        runs: 0,
        samples: 0,
        sample_score_targets: 0,
        sample_score_target_items: 0,
        rubrics: 0,
        rubric_critics: 0,
        scores: 0,
        score_critics: 0,
        llm_attempts: 0,
        llm_attempt_payloads: 0,
        process_observability: 0,
      };

      for (const run of experimentRuns) {
        let hasMore = true;
        while (hasMore) {
          const pass = await ctx.runMutation(
            internal.domain.maintenance.danger.deleteRunDataPass,
            {
              run_id: run.run_id,
              limit_per_table: 250,
              isDryRun: args.dry_run,
              allow_active: true,
            },
          );
          deleted.runs += pass.deleted.runs;
          deleted.samples += pass.deleted.samples;
          deleted.sample_score_targets += pass.deleted.sample_score_targets;
          deleted.sample_score_target_items += pass.deleted.sample_score_target_items;
          deleted.rubrics += pass.deleted.rubrics;
          deleted.rubric_critics += pass.deleted.rubric_critics;
          deleted.scores += pass.deleted.scores;
          deleted.score_critics += pass.deleted.score_critics;
          deleted.llm_attempts += pass.deleted.llm_attempts;
          deleted.llm_attempt_payloads += pass.deleted.llm_attempt_payloads;
          deleted.process_observability += pass.deleted.process_observability;
          hasMore = pass.has_more;
        }
      }

      if (!args.dry_run) {
        await ctx.runMutation(internal.domain.runs.experiments_repo.patchExperiment, {
          experiment_id: experiment.experiment_id,
          patch: { total_count: 0 },
        });
      }

      rows.push({
        experiment_id: experiment.experiment_id,
        experiment_tag: experiment.experiment_tag,
        runs_found: experimentRuns.length,
        deleted,
      });
      processed_experiment_count += 1;
      for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
        totals[key] += deleted[key];
      }
    }

    return {
      dry_run: args.dry_run,
      selected_experiment_count: filtered.selected.length,
      missing_experiment_tags: filtered.missingTags,
      cancelled_processes,
      processed_experiment_count,
      rows,
      totals,
    };
  },
});

export const resetV3CampaignChunked = zAction({
  args: z.object({
    dry_run: z.boolean().default(false),
    experiment_tags: z.array(z.string()).optional(),
    cancel_timeout_ms: z.number().int().min(1).max(60_000).default(10_000),
    cancel_poll_interval_ms: z.number().int().min(100).max(5_000).default(500),
  }),
  returns: CampaignResetResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof CampaignResetResultSchema>> => {
    const experiments = await listAllExperiments(ctx);
    const filtered = filterV3Experiments(experiments, args.experiment_tags);

    const selectedExperimentIds = filtered.selected.map((experiment) => experiment.experiment_id);
    const runs: Array<{
      run_id: Id<"runs">;
      experiment_id: Id<"experiments">;
      status: z.infer<typeof StateStatusSchema>;
      workflow_id: string | null;
      workflow_run_id: string | null;
      current_stage: z.infer<typeof RunStageSchema>;
      pause_after: z.infer<typeof RunStageSchema> | null;
      created_at: number;
    }> = await ctx.runQuery(
      internal.domain.runs.experiments_service.listRunsForExperiments,
      {
        experiment_ids: selectedExperimentIds,
      },
    );

    const activeRuns = runs.filter((run) => ACTIVE_RUN_STATUSES.has(run.status));
    const cancelled_processes: Array<z.infer<typeof CampaignTemporalResetRowSchema>> = [];

    if (!args.dry_run) {
      for (const run of activeRuns) {
        if (!run.workflow_id) {
          cancelled_processes.push({
            process_type: "run",
            process_id: String(run.run_id),
            experiment_id: run.experiment_id,
            workflow_id: null,
            action: "skipped",
            reason: "workflow_not_bound",
          });
          continue;
        }

        const control = await ctx.runAction(
          internal.domain.temporal.temporal_client.controlProcessWorkflow,
          {
            process_type: "run",
            process_id: String(run.run_id),
            action: "cancel",
            cmd_id: `cmd:reset_v3_campaign_chunked:cancel:run:${run.run_id}`,
          },
        );
        cancelled_processes.push({
          process_type: "run",
          process_id: String(run.run_id),
          experiment_id: run.experiment_id,
          workflow_id: control.workflow_id,
          action: control.accepted ? "cancelled" : "skipped",
          reason: control.accepted ? "cancel_requested" : (control.reason ?? "cancel_rejected"),
        });
      }

      const deadline = Date.now() + args.cancel_timeout_ms;
      while (Date.now() < deadline) {
        let openCount = 0;
        for (const run of activeRuns) {
          const inspection = await ctx.runAction(
            internal.domain.temporal.temporal_client.inspectProcessWorkflow,
            {
              process_type: "run",
              process_id: String(run.run_id),
            },
          );
          if (inspection.workflow_found && isTemporalExecutionActive(inspection.temporal_status)) {
            openCount += 1;
          }
        }
        if (openCount === 0) {
          break;
        }
        await sleep(args.cancel_poll_interval_ms);
      }

      const stillActive = [] as string[];
      for (const run of activeRuns) {
        const inspection = await ctx.runAction(
          internal.domain.temporal.temporal_client.inspectProcessWorkflow,
          {
            process_type: "run",
            process_id: String(run.run_id),
          },
        );
        if (inspection.workflow_found && isTemporalExecutionActive(inspection.temporal_status)) {
          stillActive.push(String(run.run_id));
        }
      }

      if (stillActive.length > 0) {
        throw new Error(
          `Timed out waiting for Temporal cancellation on runs: ${stillActive.join(", ")}`,
        );
      }
    } else {
      for (const run of activeRuns) {
        cancelled_processes.push({
          process_type: "run",
          process_id: String(run.run_id),
          experiment_id: run.experiment_id,
          workflow_id: run.workflow_id ?? null,
          action: "cancelled",
          reason: "dry_run",
        });
      }
    }

    if (!args.dry_run) {
      for (const run of runs) {
        const scoreTargetIds: Id<"sample_score_targets">[] = await ctx.runQuery(
          internal.domain.maintenance.danger.listRunScoreTargetIds,
          {
            run_id: run.run_id,
          },
        );
        for (const batch of chunkArray(scoreTargetIds, 100)) {
          if (batch.length === 0) continue;
          await ctx.runMutation(
            internal.domain.maintenance.danger.backfillRunScoreTargetItemsBatch,
            {
              run_id: run.run_id,
              score_target_ids: batch,
            },
          );
        }

        const attemptIds: Id<"llm_attempts">[] = await ctx.runQuery(
          internal.domain.maintenance.danger.listRunAttemptIds,
          {
            run_id: run.run_id,
          },
        );
        for (const batch of chunkArray(attemptIds, 100)) {
          if (batch.length === 0) continue;
          await ctx.runMutation(
            internal.domain.maintenance.danger.backfillRunAttemptPayloadsBatch,
            {
              run_id: run.run_id,
              attempt_ids: batch,
            },
          );
        }
      }
    }

    const rows: Array<z.infer<typeof ResetExperimentRowSchema>> = [];
    const totals = {
      runs: 0,
      samples: 0,
      sample_score_targets: 0,
      sample_score_target_items: 0,
      rubrics: 0,
      rubric_critics: 0,
      scores: 0,
      score_critics: 0,
      llm_attempts: 0,
      llm_attempt_payloads: 0,
      process_observability: 0,
    };
    let processed_experiment_count = 0;

    for (const experiment of filtered.selected) {
      const experimentRuns = runs.filter((run) => run.experiment_id === experiment.experiment_id);
      const deleted = {
        runs: 0,
        samples: 0,
        sample_score_targets: 0,
        sample_score_target_items: 0,
        rubrics: 0,
        rubric_critics: 0,
        scores: 0,
        score_critics: 0,
        llm_attempts: 0,
        llm_attempt_payloads: 0,
        process_observability: 0,
      };

      for (const run of experimentRuns) {
        let hasMore = true;
        while (hasMore) {
          const pass = await ctx.runMutation(
            internal.domain.maintenance.danger.deleteRunDataPass,
            {
              run_id: run.run_id,
              limit_per_table: 250,
              isDryRun: args.dry_run,
              allow_active: true,
            },
          );
          deleted.runs += pass.deleted.runs;
          deleted.samples += pass.deleted.samples;
          deleted.sample_score_targets += pass.deleted.sample_score_targets;
          deleted.sample_score_target_items += pass.deleted.sample_score_target_items;
          deleted.rubrics += pass.deleted.rubrics;
          deleted.rubric_critics += pass.deleted.rubric_critics;
          deleted.scores += pass.deleted.scores;
          deleted.score_critics += pass.deleted.score_critics;
          deleted.llm_attempts += pass.deleted.llm_attempts;
          deleted.llm_attempt_payloads += pass.deleted.llm_attempt_payloads;
          deleted.process_observability += pass.deleted.process_observability;
          hasMore = pass.has_more;
        }
      }

      if (!args.dry_run) {
        await ctx.runMutation(internal.domain.runs.experiments_repo.patchExperiment, {
          experiment_id: experiment.experiment_id,
          patch: { total_count: 0 },
        });
      }

      rows.push({
        experiment_id: experiment.experiment_id,
        experiment_tag: experiment.experiment_tag,
        runs_found: experimentRuns.length,
        deleted,
      });
      processed_experiment_count += 1;
      for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
        totals[key] += deleted[key];
      }
    }

    return {
      dry_run: args.dry_run,
      selected_experiment_count: filtered.selected.length,
      missing_experiment_tags: filtered.missingTags,
      cancelled_processes,
      processed_experiment_count,
      rows,
      totals,
    };
  },
});

export const startV3Campaign = zAction({
  args: z.object({
    mode: V3LaunchModeSchema.default("canary"),
    experiment_tags: z.array(z.string()).optional(),
    dry_run: z.boolean().default(false),
    start_scheduler: z.boolean().default(true),
  }),
  returns: CampaignStartResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof CampaignStartResultSchema>> => {
    const config = V3_LAUNCH_MODES[args.mode];
    const result: {
      dry_run: boolean;
      selected_experiment_count: number;
      missing_experiment_tags: string[];
      rows: Array<z.infer<typeof LaunchRowSchema>>;
    } = await ctx.runMutation(api.packages.codex.startV3Experiments, {
      target_count: config.target_count,
      pause_after: config.pause_after,
      experiment_tags: args.experiment_tags,
      start_policy: config.start_policy,
      start_scheduler: args.start_scheduler,
      dry_run: args.dry_run,
    });

    return {
      mode: args.mode,
      config,
      dry_run: result.dry_run,
      selected_experiment_count: result.selected_experiment_count,
      missing_experiment_tags: result.missing_experiment_tags,
      rows: result.rows,
    };
  },
});

export const getV3CampaignStatus = zQuery({
  args: z.object({
    experiment_tags: z.array(z.string()).optional(),
    expected_pause_after: RunStageSchema.nullable().optional(),
    older_than_ms: z.number().int().min(1).default(120_000),
  }),
  returns: GetV3CampaignStatusReturnSchema,
  handler: async (ctx, args): Promise<z.infer<typeof GetV3CampaignStatusReturnSchema>> => {
    const experiments = await listAllExperiments(ctx);
    const filtered = filterV3Experiments(experiments, args.experiment_tags);
    const selectedRows = filtered.selected.map(toCampaignExperimentRow);
    const latestRunIds = new Set(
      selectedRows
        .map((experiment) => experiment.latest_run?.run_id)
        .filter((runId): runId is Id<"runs"> => runId != null)
        .map((runId) => String(runId)),
    );

    const stuck: { items: z.infer<typeof CampaignStuckItemSchema>[] } = await ctx.runQuery(
      api.packages.codex.getStuckWork,
      {
      older_than_ms: args.older_than_ms,
      },
    );
    const stuckItems: z.infer<typeof CampaignStuckItemSchema>[] = stuck.items.filter((item: z.infer<typeof CampaignStuckItemSchema>) =>
      item.process_type === "run" && latestRunIds.has(item.process_id)
    );

    const stageCounts = new Map<z.infer<typeof RunStageSchema>, number>([
      ["rubric_gen", 0],
      ["rubric_critic", 0],
      ["score_gen", 0],
      ["score_critic", 0],
    ]);
    const counts = {
      total: selectedRows.length,
      with_latest_run: 0,
      start: 0,
      queued: 0,
      running: 0,
      paused: 0,
      completed: 0,
      error: 0,
      canceled: 0,
      latest_runs_with_failures: 0,
    };

    for (const experiment of selectedRows) {
      counts[experiment.status] += 1;
      if (experiment.latest_run) {
        counts.with_latest_run += 1;
        stageCounts.set(
          experiment.latest_run.current_stage,
          (stageCounts.get(experiment.latest_run.current_stage) ?? 0) + 1,
        );
        if (experiment.latest_run.has_failures) {
          counts.latest_runs_with_failures += 1;
        }
      }
    }

    const classification = classifyCampaignState({
      experiments: filtered.selected,
      missingTags: filtered.missingTags,
      expectedPauseAfter: args.expected_pause_after ?? null,
      stuckItems,
    });

    const stuckSummary = [...stuckItems.reduce((acc: Map<z.infer<typeof StuckReasonSchema>, number>, item: z.infer<typeof CampaignStuckItemSchema>) => {
      acc.set(item.reason, (acc.get(item.reason) ?? 0) + 1);
      return acc;
    }, new Map<z.infer<typeof StuckReasonSchema>, number>()).entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => left.reason.localeCompare(right.reason));

    return {
      selected_experiment_count: selectedRows.length,
      missing_experiment_tags: filtered.missingTags,
      campaign_state: classification.campaign_state,
      scientific_validity: classification.scientific_validity,
      launch_ready:
        classification.campaign_state === "preflight_clean"
        && filtered.missingTags.length === 0,
      counts,
      stage_distribution: [...stageCounts.entries()].map(([stage, count]) => ({ stage, count })),
      workload_family_summary: summarizeWorkloadFamilies(filtered.selected),
      stuck_summary: stuckSummary,
      stuck_items: stuckItems,
      experiments: selectedRows,
    };
  },
});
