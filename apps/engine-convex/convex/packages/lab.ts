import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation, zQuery, zInternalAction } from "../utils/custom_fns";
import { api, internal } from "../_generated/api";
import { modelTypeSchema, type ModelType } from "@judge-gym/engine-settings/provider";
import type { Doc, Id } from "../_generated/dataModel";
import { WindowsTableSchema } from "../models/window";
import { ExperimentsTableSchema, RunStageSchema } from "../models/experiments";
import {
  BundleStrategySchema,
  SemanticLevelSchema,
} from "../models/_shared";
import { CreateWindowResult } from "../domain/window/window_repo";
import { emitTraceEvent } from "../domain/telemetry/emit";

const EvidenceWindowInputSchema = z.object({
  window_tag: WindowsTableSchema.shape.window_tag.optional(),
  source_provider: WindowsTableSchema.shape.source_provider.optional(),
  query: WindowsTableSchema.shape.query,
  country: WindowsTableSchema.shape.country,
  start_date: WindowsTableSchema.shape.start_date,
  end_date: WindowsTableSchema.shape.end_date,
  default_target_stage: WindowsTableSchema.shape.default_target_stage.optional(),
});

const WindowRunTargetStageSchema = SemanticLevelSchema;

export const createWindowForm = zMutation({
  args: z.object({
    evidence_window: EvidenceWindowInputSchema,
    evidence_limit: z.number().int().min(1),
  }),
  handler: async (ctx, args): Promise<CreateWindowResult> => {
    const { evidence_window, evidence_limit } = args;
    const startDate = new Date(evidence_window.start_date);
    const endDate = new Date(evidence_window.end_date);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      throw new Error("Invalid window dates");
    }

    const { window_id } = await ctx.runMutation(
      internal.domain.window.window_repo.createWindow,
      {
        ...evidence_window,
        default_target_count: evidence_limit,
      },
    );
    await emitTraceEvent(ctx, {
      trace_id: `window:${window_id}`,
      entity_type: "window",
      entity_id: String(window_id),
      event_name: "window_created",
      status: "start",
      stage: "l0_raw",
      payload_json: JSON.stringify({
        country: evidence_window.country,
        query: evidence_window.query,
      }),
    });

    return { window_id };
  },
});

export const upsertWindowDefinition: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_window: EvidenceWindowInputSchema.extend({
      window_tag: WindowsTableSchema.shape.window_tag,
      source_provider: WindowsTableSchema.shape.source_provider.default("firecrawl"),
      default_target_stage: WindowsTableSchema.shape.default_target_stage.default("l3_abstracted"),
    }),
    evidence_limit: z.number().int().min(1),
  }),
  returns: z.object({
    window_id: zid("windows"),
    action: z.enum(["created", "updated", "unchanged"]),
  }),
  handler: async (ctx, args): Promise<{ window_id: Id<"windows">; action: "created" | "updated" | "unchanged" }> => {
    const { evidence_window, evidence_limit } = args;
    const { window_id, action }: { window_id: Id<"windows">; action: "created" | "updated" | "unchanged" } = await ctx.runMutation(
      internal.domain.window.window_repo.upsertWindow,
      {
        ...evidence_window,
        default_target_count: evidence_limit,
      },
    );
    return { window_id, action };
  },
});

export const startWindowRunForm: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    window_id: zid("windows"),
    model: modelTypeSchema,
    target_stage: WindowRunTargetStageSchema.optional(),
    evidence_limit: z.number().int().min(1).optional(),
    pause_after: z.enum(["collect", "l1_cleaned", "l2_neutralized", "l3_abstracted"]).nullable().optional(),
  }),
  returns: z.object({
    window_run_id: zid("window_runs"),
  }),
  handler: async (ctx, args): Promise<{ window_run_id: Id<"window_runs"> }> => {
    const { window_run_id }: { window_run_id: Id<"window_runs"> } = await ctx.runMutation(
      internal.domain.window.window_repo.createWindowRun,
      {
        window_id: args.window_id,
        model: args.model,
        target_count: args.evidence_limit,
        target_stage: args.target_stage,
        pause_after: args.pause_after ?? null,
      },
    );
    await emitTraceEvent(ctx, {
      trace_id: `window:${window_run_id}`,
      entity_type: "window",
      entity_id: String(window_run_id),
      event_name: "window_run_created",
      status: "start",
      stage: "l0_raw",
      payload_json: JSON.stringify({
        window_id: args.window_id,
        model: args.model,
        target_stage: args.target_stage,
        evidence_limit: args.evidence_limit ?? null,
      }),
    });

    await ctx.scheduler.runAfter(0, internal.packages.lab.startWindowRunFlow, {
      window_run_id,
    });

    return { window_run_id };
  },
});

function semanticLevelToWindowPauseStage(
  level: z.infer<typeof WindowRunTargetStageSchema>,
): "collect" | "l1_cleaned" | "l2_neutralized" | "l3_abstracted" {
  switch (level) {
    case "l0_raw":
      return "collect";
    case "l1_cleaned":
      return "l1_cleaned";
    case "l2_neutralized":
      return "l2_neutralized";
    case "l3_abstracted":
      return "l3_abstracted";
  }
}

export const startWindowRunFlow = zInternalAction({
  args: z.object({
    window_run_id: zid("window_runs"),
  }),
  handler: async (ctx, args) => {
    const windowRun = await ctx.runQuery(
      internal.domain.window.window_repo.getWindowRun,
      { window_run_id: args.window_run_id },
    );
    await emitTraceEvent(ctx, {
      trace_id: `window:${args.window_run_id}`,
      entity_type: "window",
      entity_id: String(args.window_run_id),
      event_name: "window_run_started",
      payload_json: JSON.stringify({
        window_id: windowRun.window_id,
        target_count: windowRun.target_count,
        target_stage: windowRun.target_stage,
      }),
    });

    try {
      const { workflow_id, workflow_run_id } =
        await ctx.runAction(internal.domain.temporal.temporal_client.startWindowWorkflow, {
          window_run_id: args.window_run_id,
          target_stage: semanticLevelToWindowPauseStage(windowRun.target_stage),
        });
      await ctx.runMutation(
        api.packages.worker.bindWindowWorkflow,
        {
          window_run_id: args.window_run_id,
          workflow_id,
          workflow_run_id,
        },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.packages.worker.markWindowProcessError, {
        window_run_id: args.window_run_id,
        stage: "collect",
        error_message: errorMessage,
      });
    }
  },
});

export const resumeWindowExecution = zInternalAction({
  args: z.object({
    window_run_id: zid("window_runs"),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(internal.domain.temporal.temporal_client.resumeWindowWorkflow, {
        window_run_id: args.window_run_id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.packages.worker.markWindowProcessError, {
        window_run_id: args.window_run_id,
        stage: "collect",
        error_message: errorMessage,
      });
    }
    return null;
  },
});

export const backfillLegacyWindowRuns: ReturnType<typeof zMutation> = zMutation({
  args: z.object({}),
  returns: z.object({
    windows_patched: z.number(),
    runs_created: z.number(),
    evidences_patched: z.number(),
    skipped_windows: z.number(),
    active_windows_restarted_as_error: z.number(),
  }),
  handler: async (ctx): Promise<{
    windows_patched: number;
    runs_created: number;
    evidences_patched: number;
    skipped_windows: number;
    active_windows_restarted_as_error: number;
  }> => {
    return ctx.runMutation(
      internal.domain.window.window_repo.backfillLegacyWindowRuns,
      {},
    );
  },
});


// todo, clean up the list functions

type EvidenceStatus =
  | "scraping"
  | "error"
  | "cleaning"
  | "neutralizing"
  | "abstracting"
  | "ready";


export const listEvidenceWindows: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      window_id: zid("windows"),
      window_tag: z.string(),
      source_provider: WindowsTableSchema.shape.source_provider,
      start_date: z.string(),
      end_date: z.string(),
      country: z.string(),
      query: z.string(),
      default_target_count: z.number(),
      default_target_stage: SemanticLevelSchema,
      latest_window_run_id: zid("window_runs").nullable(),
      model: modelTypeSchema.nullable(),
      target_stage: SemanticLevelSchema.nullable(),
      evidence_count: z.number(),
      evidence_status: z.enum([
        "scraping",
        "error",
        "cleaning",
        "neutralizing",
        "abstracting",
        "ready",
      ]),
    }),
  ),
  handler: async (ctx) => {
    const windows = await ctx.runQuery(
      internal.domain.window.window_repo.listWindows,
      {},
    );
    const windowRuns = await ctx.runQuery(
      internal.domain.window.window_repo.listWindowRuns,
      {},
    );
    const evidenceRows = await ctx.db.query("evidences").collect();
    const evidencesByWindow = new Map<string, Array<Doc<"evidences">>>();
    for (const evidence of evidenceRows) {
      const current = evidencesByWindow.get(evidence.window_id) ?? [];
      current.push(evidence);
      evidencesByWindow.set(evidence.window_id, current);
    }

    const latestRunByWindow = new Map<string, Doc<"window_runs">>();
    for (const windowRun of windowRuns as Array<Doc<"window_runs">>) {
      const current = latestRunByWindow.get(String(windowRun.window_id));
      if (!current || current._creationTime < windowRun._creationTime) {
        latestRunByWindow.set(String(windowRun.window_id), windowRun);
      }
    }

    const results = [] as Array<{
      window_id: string;
      window_tag: string;
      source_provider: z.infer<typeof WindowsTableSchema.shape.source_provider>;
      start_date: string;
      end_date: string;
      country: string;
      query: string;
      default_target_count: number;
      default_target_stage: z.infer<typeof SemanticLevelSchema>;
      latest_window_run_id: string | null;
      model: ModelType | null;
      target_stage: z.infer<typeof SemanticLevelSchema> | null;
      evidence_count: number;
      evidence_status: EvidenceStatus;
    }>;

    for (const window of windows) {
      const evidences = evidencesByWindow.get(window._id) ?? [];
      const latestRun = latestRunByWindow.get(String(window._id)) ?? null;
      const evidence_status = deriveEvidenceStatus(latestRun?.status ?? "start", evidences);
      results.push({
        window_id: window._id,
        window_tag: window.window_tag,
        source_provider: window.source_provider,
        start_date: window.start_date,
        end_date: window.end_date,
        country: window.country,
        query: window.query,
        default_target_count: window.default_target_count ?? 0,
        default_target_stage: window.default_target_stage,
        latest_window_run_id: latestRun?._id ?? null,
        model: latestRun?.model ?? null,
        target_stage: latestRun?.target_stage ?? null,
        evidence_count: evidences.length,
        evidence_status,
      });
    }

    results.sort((a, b) => a.window_tag.localeCompare(b.window_tag));
    return results;
  },
});

export const listEvidenceByWindow: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ window_id: zid("windows") }),
  returns: z.array(
    z.object({
      evidence_id: zid("evidences"),
      title: z.string(),
      url: z.string(),
      created_at: z.number(),
    }),
  ),
  handler: async (ctx, { window_id }) => {
    const rows = (await ctx.runQuery(
      internal.domain.window.window_repo.listEvidenceByWindow,
      { window_id },
    )) as Array<Doc<"evidences">>;

    return rows
      .slice()
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((row) => ({
        evidence_id: row._id,
        title: row.title,
        url: row.url,
        created_at: row._creationTime,
      }));
  },
});

export const listWindowRuns: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    window_id: zid("windows").optional(),
  }),
  returns: z.array(z.object({
    window_run_id: zid("window_runs"),
    window_id: zid("windows"),
    status: z.string(),
    current_stage: SemanticLevelSchema,
    pause_after: z.enum(["collect", "l1_cleaned", "l2_neutralized", "l3_abstracted"]).nullable(),
    target_stage: SemanticLevelSchema,
    target_count: z.number(),
    completed_count: z.number(),
    model: modelTypeSchema,
    workflow_id: z.string().nullable().optional(),
    workflow_run_id: z.string().nullable().optional(),
    last_error_message: z.string().nullable().optional(),
    created_at: z.number(),
  })),
  handler: async (ctx, args) => {
    const rows = (await ctx.runQuery(
      internal.domain.window.window_repo.listWindowRuns,
      args.window_id ? { window_id: args.window_id } : {},
    )) as Array<Doc<"window_runs">>;

    return rows
      .slice()
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((row) => ({
        window_run_id: row._id,
        window_id: row.window_id,
        status: row.status,
        current_stage: row.current_stage,
        pause_after: row.pause_after ?? null,
        target_stage: row.target_stage,
        target_count: row.target_count,
        completed_count: row.completed_count,
        model: row.model,
        workflow_id: row.workflow_id ?? null,
        workflow_run_id: row.workflow_run_id ?? null,
        last_error_message: row.last_error_message ?? null,
        created_at: row._creationTime,
      }));
  },
});

export const listEvidenceByWindowRun: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ window_run_id: zid("window_runs") }),
  returns: z.array(
    z.object({
      evidence_id: zid("evidences"),
      window_run_id: zid("window_runs"),
      title: z.string(),
      url: z.string(),
      created_at: z.number(),
    }),
  ),
  handler: async (ctx, { window_run_id }) => {
    const rows = (await ctx.runQuery(
      internal.domain.window.window_repo.listEvidenceByWindowRun,
      { window_run_id },
    )) as Array<Doc<"evidences">>;

    return rows
      .slice()
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((row) => ({
        evidence_id: row._id,
        window_run_id: row.window_run_id,
        title: row.title,
        url: row.url,
        created_at: row._creationTime,
      }));
  },
});

const ExperimentConfigInputSchema = ExperimentsTableSchema.pick({
  rubric_config: true,
  scoring_config: true,
});

export const initExperiment: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_tag: z.string().optional(),
    experiment_config: ExperimentConfigInputSchema,
    pool_id: zid("pools"),
    bundle_plan_id: zid("bundle_plans").optional(),
  }),
  returns: z.object({
    experiment_id: zid("experiments"),
  }),
  handler: async (ctx, args) => {
    const { experiment_config, pool_id, bundle_plan_id } = args;

    const experiment_id: Id<"experiments"> = await ctx.runMutation(internal.domain.runs.experiments_repo.createExperiment,
      {
        experiment_tag: args.experiment_tag,
        ...experiment_config,
        pool_id,
        bundle_plan_id,
      }
    );
    const poolLinks = await ctx.runQuery(
      internal.domain.runs.pool_repo.listPoolEvidenceLinks,
      { pool_id },
    );
    await emitTraceEvent(ctx, {
      trace_id: `experiment:${experiment_id}`,
      entity_type: "run",
      entity_id: String(experiment_id),
      event_name: "experiment_initialized",
      status: "start",
      payload_json: JSON.stringify({
        evidence_count: poolLinks.length,
        scoring_model: experiment_config.scoring_config.model,
      }),
    });

    return { experiment_id };
  },
});

export const createPool: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_ids: z.array(zid("evidences")).min(1),
    pool_tag: z.string().optional(),
  }),
  returns: z.object({
    pool_id: zid("pools"),
  }),
  handler: async (ctx, args) => {
    const pool_id = await ctx.runMutation(
      internal.domain.runs.pool_repo.createPool,
      args,
    );
    return { pool_id };
  },
});

export const createPoolFromWindowRun: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    window_run_id: zid("window_runs"),
    pool_tag: z.string().optional(),
  }),
  returns: z.object({
    pool_id: zid("pools"),
    evidence_count: z.number(),
  }),
  handler: async (ctx, args) => {
    const windowRun = await ctx.runQuery(
      internal.domain.window.window_repo.getWindowRun,
      { window_run_id: args.window_run_id },
    );
    if (windowRun.status !== "completed") {
      throw new Error("Window run must be completed before creating a pool");
    }
    const evidences = await ctx.runQuery(
      internal.domain.window.window_repo.listEvidenceByWindowRun,
      { window_run_id: args.window_run_id },
    );
    if (evidences.length === 0) {
      throw new Error("Window run has no evidence");
    }
    const pool_id = await ctx.runMutation(
      internal.domain.runs.pool_repo.createPool,
      {
        evidence_ids: evidences.map((evidence: Doc<"evidences">) => evidence._id),
        pool_tag: args.pool_tag,
      },
    );
    return {
      pool_id,
      evidence_count: evidences.length,
    };
  },
});

export const createBundlePlan: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    bundle_plan_tag: z.string().optional(),
    pool_id: zid("pools"),
    strategy: BundleStrategySchema,
    strategy_version: z.string().optional(),
    source_view: SemanticLevelSchema.nullable().optional(),
    bundle_size: z.number().int().min(1),
    seed: z.number().int().nullable().optional(),
  }),
  returns: z.object({
    bundle_plan_id: zid("bundle_plans"),
    bundle_plan_tag: z.string(),
    created: z.boolean(),
  }),
  handler: async (ctx, args) => {
    return ctx.runMutation(
      internal.domain.runs.bundle_plan_repo.createBundlePlan,
      args,
    );
  },
});

export const listBundlePlans: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    pool_id: zid("pools").optional(),
  }),
  returns: z.array(z.object({
    bundle_plan_id: zid("bundle_plans"),
    bundle_plan_tag: z.string(),
    pool_id: zid("pools"),
    strategy: BundleStrategySchema,
    strategy_version: z.string(),
    source_view: SemanticLevelSchema.nullable(),
    bundle_size: z.number().int().min(1),
    seed: z.number().int().nullable(),
    evidence_count: z.number().int().nonnegative(),
    bundle_count: z.number().int().nonnegative(),
    status: z.string(),
    materialized_item_count: z.number().int().nonnegative(),
  })),
  handler: async (ctx, args) => {
    const plans = await ctx.runQuery(
      internal.domain.runs.bundle_plan_repo.listBundlePlans,
      args,
    );
    return plans.map((plan: (typeof plans)[number]) => ({
      bundle_plan_id: plan._id,
      bundle_plan_tag: plan.bundle_plan_tag,
      pool_id: plan.pool_id,
      strategy: plan.strategy,
      strategy_version: plan.strategy_version,
      source_view: plan.source_view,
      bundle_size: plan.bundle_size,
      seed: plan.seed,
      evidence_count: plan.evidence_count,
      bundle_count: plan.bundle_count,
      status: plan.status,
      materialized_item_count: plan.materialized_item_count,
    }));
  },
});

export const startExperimentRun: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    target_count: z.number().int().min(1),
    pause_after: RunStageSchema.nullable().optional(),
  }),
  returns: z.object({
    run_id: zid("runs"),
    samples_created: z.number(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      internal.domain.runs.run_service.startRunFlow,
      args,
    );
    await emitTraceEvent(ctx, {
      trace_id: `run:${result.run_id}`,
      entity_type: "run",
      entity_id: String(result.run_id),
      event_name: "run_started",
      stage: "rubric_gen",
      status: "queued",
      payload_json: JSON.stringify({
        experiment_id: args.experiment_id,
        target_count: args.target_count,
      }),
    });
    return {
      run_id: result.run_id,
      samples_created: args.target_count,
    };
  },
});

// todo, clean up the list functions

export const listExperiments: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      experiment_id: zid("experiments"),
      experiment_tag: z.string(),
      bundle_plan_id: zid("bundle_plans").optional(),
      rubric_config: ExperimentsTableSchema.shape.rubric_config,
      scoring_config: ExperimentsTableSchema.shape.scoring_config,
      total_count: z.number(),
      evidence_selected_count: z.number(),
      window_count: z.number(),
      status: z.string(),
      latest_run: z
        .object({
          run_id: zid("runs"),
          status: z.string(),
          current_stage: z.string(),
          target_count: z.number(),
          completed_count: z.number(),
          pause_after: RunStageSchema.nullable(),
          stage_counts: z.object({
            rubric_gen: z.number(),
            rubric_critic: z.number(),
            score_gen: z.number(),
            score_critic: z.number(),
          }),
          created_at: z.number(),
          has_failures: z.boolean(),
        })
        .optional(),
    }),
  ),
  handler: async (ctx) => {
    return ctx.runQuery(
      internal.domain.runs.experiments_service.listExperiments,
      {},
    );
  },
});

export const getExperimentSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  returns: z.object({
    experiment_id: zid("experiments"),
    experiment_tag: z.string(),
    bundle_plan_id: zid("bundle_plans").optional(),
    rubric_config: ExperimentsTableSchema.shape.rubric_config,
    scoring_config: ExperimentsTableSchema.shape.scoring_config,
    total_count: z.number(),
    evidence_selected_count: z.number(),
    window_count: z.number(),
    window_ids: z.array(z.string()),
    run_count: z.number(),
    status: z.string(),
    latest_run: z.object({
      run_id: zid("runs"),
      status: z.string(),
      current_stage: z.string(),
      target_count: z.number(),
      completed_count: z.number(),
      pause_after: RunStageSchema.nullable(),
      stage_counts: z.object({
        rubric_gen: z.number(),
        rubric_critic: z.number(),
        score_gen: z.number(),
        score_critic: z.number(),
      }),
      created_at: z.number(),
      has_failures: z.boolean(),
    }).optional(),
    counts: z.object({
      samples: z.number(),
      rubrics: z.number(),
      rubric_critics: z.number(),
      scores: z.number(),
      score_critics: z.number(),
    }),
  }),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      internal.domain.runs.experiments_service.getExperimentSummary,
      args,
    );
  },
});

export const listExperimentEvidence: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  returns: z.array(
    z.object({
      evidence_id: zid("evidences"),
      window_id: zid("windows"),
      title: z.string(),
      url: z.string(),
      created_at: z.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      internal.domain.runs.experiments_service.listExperimentEvidence,
      args,
    );
  },
});

export const getRunSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ run_id: zid("runs") }),
  returns: z.object({
    run_id: zid("runs"),
    status: z.string(),
    current_stage: z.string(),
    pause_after: RunStageSchema.nullable(),
    target_count: z.number(),
    completed_count: z.number(),
    stage_counts: z.object({
      rubric_gen: z.number(),
      rubric_critic: z.number(),
      score_gen: z.number(),
      score_critic: z.number(),
    }),
    has_failures: z.boolean(),
    failed_stage_count: z.number(),
    stages: z.array(z.object({
      stage: z.string(),
      status: z.string(),
      total: z.number(),
      completed: z.number(),
      failed: z.number(),
    })),
  }),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      internal.domain.runs.experiments_service.getRunSummary,
      args,
    );
  },
});

export const getWindowSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ window_run_id: zid("window_runs") }),
  handler: async (ctx, { window_run_id }) => {
    const windowRun = await ctx.runQuery(
      internal.domain.window.window_repo.getWindowRun,
      { window_run_id },
    );
    const evidences = (await ctx.runQuery(
      internal.domain.window.window_repo.listEvidenceByWindowRun,
      { window_run_id },
    )) as Array<Doc<"evidences">>;

    let l1_completed = 0;
    let l2_completed = 0;
    let l3_completed = 0;
    for (const evidence of evidences) {
      if (evidence.l1_cleaned_content) l1_completed += 1;
      if (evidence.l2_neutralized_content) l2_completed += 1;
      if (evidence.l3_abstracted_content) l3_completed += 1;
    }

    return {
      window_run_id: windowRun._id,
      window_id: windowRun.window_id,
      status: windowRun.status,
      current_stage: windowRun.current_stage,
      target_stage: windowRun.target_stage,
      target_count: windowRun.target_count,
      completed_count: windowRun.completed_count,
      evidence_total: evidences.length,
      l1_completed,
      l2_completed,
      l3_completed,
      trace_id: `window:${windowRun._id}`,
    };
  },
});

export const getRunDiagnostics: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, { run_id }) => {
    const run = await ctx.runQuery(internal.domain.runs.run_repo.getRun, {
      run_id,
    });
    const experiment = await ctx.db.get(run.experiment_id) as Doc<"experiments"> | null;
    if (!experiment) {
      throw new Error("Experiment not found");
    }
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();
    const orderedSamples = samples
      .slice()
      .sort((left, right) => left._creationTime - right._creationTime);
    const sampleOrdinalById = new Map(
      orderedSamples.map((sample, index) => [String(sample._id), index] as const),
    );
    const scoreTargets = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();
    const sampleIdByScoreTargetId = new Map(
      scoreTargets.map((target) => [String(target._id), target.sample_id] as const),
    );
    const attemptRows = await ctx.db
      .query("llm_attempts")
      .withIndex("by_process", (q) =>
        q.eq("process_kind", "run").eq("process_id", run_id),
      )
      .collect();
    const runSummary = await ctx.runQuery(
      internal.domain.runs.experiments_service.getRunSummary,
      { run_id },
    );
    const evidenceLinks = await ctx.db
      .query("pool_evidences")
      .withIndex("by_pool", (q) => q.eq("pool_id", experiment.pool_id))
      .collect();
    const scoreTargetsPerSample = evidenceLinks.length > 0
      ? Math.ceil(
        evidenceLinks.length
          / Math.max(1, experiment.scoring_config.evidence_bundle_size),
      )
      : 0;

    const stageRollup = {
      rubric_gen: { pending: 0, success: 0, error: 0 },
      rubric_critic: { pending: 0, success: 0, error: 0 },
      score_gen: { pending: 0, success: 0, error: 0 },
      score_critic: { pending: 0, success: 0, error: 0 },
    };
    const failed_requests = [] as Array<{
      request_id: Id<"llm_attempts">;
      custom_key: string;
      attempt_index: number | null;
      last_error: string | null;
      status: "pending" | "success" | "error";
      assistant_output_preview: string | null;
    }>;

    const failedAttemptPayloads = new Map<string, string | null>();
    const outputAttemptPayloads = new Map<string, string | null>();
    for (const attempt of attemptRows) {
      if (attempt.error_payload_id) {
        const payload = await ctx.db.get(attempt.error_payload_id);
        failedAttemptPayloads.set(String(attempt._id), payload?.content_text ?? null);
      }
      if (attempt.assistant_output_payload_id) {
        const payload = await ctx.db.get(attempt.assistant_output_payload_id);
        outputAttemptPayloads.set(String(attempt._id), payload?.content_text ?? null);
      }
    }

    for (const attempt of attemptRows) {
      const stage = attempt.stage;
      if (
        stage !== "rubric_gen" &&
        stage !== "rubric_critic" &&
        stage !== "score_gen" &&
        stage !== "score_critic"
      ) {
        continue;
      }
      const normalizedStatus = attempt.status === "started"
        ? "pending"
        : attempt.status === "succeeded"
          ? "success"
          : "error";
      stageRollup[stage][normalizedStatus] += 1;
      if (normalizedStatus === "error") {
        failed_requests.push({
          request_id: attempt._id,
          custom_key: `${attempt.target_type}:${attempt.target_id}:${attempt.stage}`,
          attempt_index: null,
          last_error: failedAttemptPayloads.get(String(attempt._id)) ?? null,
          status: "error",
          assistant_output_preview: outputAttemptPayloads.get(String(attempt._id))?.slice(0, 400) ?? null,
        });
      }
    }

    const terminal_failed_targets = [
      ...samples.flatMap((sample) => {
        const rows = [] as Array<{
          sample_id: Id<"samples"> | null;
          sample_ordinal: number | null;
          target_type: "sample";
          target_id: string;
          stage: "rubric_gen" | "rubric_critic";
          custom_key: string;
          attempt_count: number;
          retry_count: number;
          error_class: string | null;
          error_message: string | null;
        }>;
        if (sample.rubric_gen_error_message) {
          rows.push({
            sample_id: sample._id,
            sample_ordinal: sampleOrdinalById.get(String(sample._id)) ?? null,
            target_type: "sample",
            target_id: String(sample._id),
            stage: "rubric_gen",
            custom_key: `sample:${sample._id}:rubric_gen`,
            attempt_count: sample.rubric_gen_attempt_id ? 1 : 0,
            retry_count: 0,
            error_class: "attempt_failed",
            error_message: sample.rubric_gen_error_message,
          });
        }
        if (sample.rubric_critic_error_message) {
          rows.push({
            sample_id: sample._id,
            sample_ordinal: sampleOrdinalById.get(String(sample._id)) ?? null,
            target_type: "sample",
            target_id: String(sample._id),
            stage: "rubric_critic",
            custom_key: `sample:${sample._id}:rubric_critic`,
            attempt_count: sample.rubric_critic_attempt_id ? 1 : 0,
            retry_count: 0,
            error_class: "attempt_failed",
            error_message: sample.rubric_critic_error_message,
          });
        }
        return rows;
      }),
      ...scoreTargets.flatMap((target) => {
        const sampleId = sampleIdByScoreTargetId.get(String(target._id)) ?? null;
        const sampleOrdinal = sampleId
          ? sampleOrdinalById.get(String(sampleId)) ?? null
          : null;
        const rows = [] as Array<{
          sample_id: Id<"samples"> | null;
          sample_ordinal: number | null;
          target_type: "sample_score_target";
          target_id: string;
          stage: "score_gen" | "score_critic";
          custom_key: string;
          attempt_count: number;
          retry_count: number;
          error_class: string | null;
          error_message: string | null;
        }>;
        if (target.score_gen_error_message) {
          rows.push({
            sample_id: sampleId,
            sample_ordinal: sampleOrdinal,
            target_type: "sample_score_target",
            target_id: String(target._id),
            stage: "score_gen",
            custom_key: `sample_score_target:${target._id}:score_gen`,
            attempt_count: target.score_gen_attempt_id ? 1 : 0,
            retry_count: 0,
            error_class: "attempt_failed",
            error_message: target.score_gen_error_message,
          });
        }
        if (target.score_critic_error_message) {
          rows.push({
            sample_id: sampleId,
            sample_ordinal: sampleOrdinal,
            target_type: "sample_score_target",
            target_id: String(target._id),
            stage: "score_critic",
            custom_key: `sample_score_target:${target._id}:score_critic`,
            attempt_count: target.score_critic_attempt_id ? 1 : 0,
            retry_count: 0,
            error_class: "attempt_failed",
            error_message: target.score_critic_error_message,
          });
        }
        return rows;
      }),
    ];

    const terminal_failed_target_summary = Object.entries(
      terminal_failed_targets.reduce<Record<string, { count: number; sample_ordinals: number[] }>>(
        (acc, target) => {
          const current = acc[target.stage] ?? { count: 0, sample_ordinals: [] };
          current.count += 1;
          if (typeof target.sample_ordinal === "number") {
            current.sample_ordinals.push(target.sample_ordinal);
          }
          acc[target.stage] = current;
          return acc;
        },
        {},
      ),
    ).map(([stage, value]) => ({
      stage,
      count: value.count,
      sample_ordinals: value.sample_ordinals.slice().sort((left, right) => left - right),
    }));

    const [rubrics, rubric_critics, scores, score_critics] = await Promise.all([
      ctx.db
        .query("rubrics")
        .withIndex("by_run", (q) => q.eq("run_id", run_id))
        .collect(),
      ctx.db
        .query("rubric_critics")
        .withIndex("by_run", (q) => q.eq("run_id", run_id))
        .collect(),
      ctx.db
        .query("scores")
        .withIndex("by_run", (q) => q.eq("run_id", run_id))
        .collect(),
      ctx.db
        .query("score_critics")
        .withIndex("by_run", (q) => q.eq("run_id", run_id))
        .collect(),
    ]);

    return {
      run_id: run._id,
      experiment_tag: experiment.experiment_tag,
      status: run.status,
      current_stage: run.current_stage,
      target_count: run.target_count,
      score_target_estimate: {
        per_sample: scoreTargetsPerSample,
        total_for_run: scoreTargetsPerSample * run.target_count,
      },
      request_counts: {
        total: attemptRows.length,
        error: terminal_failed_targets.length,
        historical_error: failed_requests.length,
        terminal_failed_targets: terminal_failed_targets.length,
      },
      stage_rollup: stageRollup,
      failed_requests,
      terminal_failed_targets,
      terminal_failed_target_summary,
      terminal_stage_rollup: Object.fromEntries(
        runSummary.stages.map((stage: (typeof runSummary.stages)[number]) => [
          stage.stage,
          {
            completed: stage.completed,
            failed: stage.failed,
            pending: Math.max(0, stage.total - stage.completed - stage.failed),
          },
        ]),
      ),
      artifact_counts: {
        samples: samples.length,
        sample_score_targets: scoreTargets.length,
        rubrics: rubrics.length,
        rubric_critics: rubric_critics.length,
        scores: scores.length,
        score_critics: score_critics.length,
      },
      trace_id: `run:${run._id}`,
    };
  },
});

export const listRunScoreTargets: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ run_id: zid("runs") }),
  returns: z.array(z.object({
    score_target_id: zid("sample_score_targets"),
    sample_id: zid("samples"),
    score_id: zid("scores").nullable(),
    score_critic_id: zid("score_critics").nullable(),
    items: z.array(z.object({
      evidence_id: zid("evidences"),
      window_id: zid("windows"),
      position: z.number(),
      title: z.string(),
      url: z.string(),
    })),
  })),
  handler: async (ctx, { run_id }) => {
    const scoreTargets = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();

    const results = [];
    for (const scoreTarget of scoreTargets) {
      const items = await ctx.db
        .query("sample_score_target_items")
        .withIndex("by_score_target", (q) => q.eq("score_target_id", scoreTarget._id))
        .collect();

      const hydratedItems = [];
      for (const item of items.slice().sort((a, b) => a.position - b.position)) {
        const evidence = await ctx.db.get(item.evidence_id);
        if (!evidence) continue;
        hydratedItems.push({
          evidence_id: evidence._id,
          window_id: item.window_id,
          position: item.position,
          title: evidence.title,
          url: evidence.url,
        });
      }

      results.push({
        score_target_id: scoreTarget._id,
        sample_id: scoreTarget.sample_id,
        score_id: scoreTarget.score_id,
        score_critic_id: scoreTarget.score_critic_id,
        items: hydratedItems,
      });
    }

    return results;
  },
});

export const getTraceEvents: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    trace_id: z.string(),
    cursor_seq: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  handler: async (ctx, args) => {
    return ctx.runQuery(internal.domain.telemetry.events.listByTrace, args);
  },
});

export const getEvidenceContent: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ evidence_id: zid("evidences") }),
  returns: z
    .object({
      evidence_id: zid("evidences"),
      window_id: zid("windows"),
      title: z.string(),
      url: z.string(),
      raw_content: z.string(),
      cleaned_content: z.string().optional(),
      neutralized_content: z.string().optional(),
      abstracted_content: z.string().optional(),
    })
    .nullable(),
  handler: async (ctx, { evidence_id }) => {
    const evidence = await ctx.runQuery(
      internal.domain.window.window_repo.getEvidence,
      { evidence_id },
    );
    if (!evidence) return null;
    return {
      evidence_id: evidence._id,
      window_id: evidence.window_id,
      title: evidence.title,
      url: evidence.url,
      raw_content: evidence.l0_raw_content,
      cleaned_content: evidence.l1_cleaned_content ?? undefined,
      neutralized_content: evidence.l2_neutralized_content ?? undefined,
      abstracted_content: evidence.l3_abstracted_content ?? undefined,
    };
  },
});

// change this to handle the permanent failure cases
function deriveEvidenceStatus(
  windowStatus: string,
  evidences: Array<{
    l1_cleaned_content: string | null;
    l2_neutralized_content: string | null;
    l3_abstracted_content: string | null;
  }>,
): EvidenceStatus {
  if (windowStatus === "error") return "error";
  if (windowStatus === "completed") return "ready";
  if (evidences.length === 0) return "scraping";
  if (evidences.some((e) => e.l1_cleaned_content === null)) return "cleaning";
  if (evidences.some((e) => e.l2_neutralized_content === null)) return "neutralizing";
  if (evidences.some((e) => e.l3_abstracted_content === null)) return "abstracting";
  return "ready";
}
