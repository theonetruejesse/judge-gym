import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation, zQuery, zInternalAction } from "../utils/custom_fns";
import { api, internal } from "../_generated/api";
import { modelTypeSchema, type ModelType } from "../platform/providers/provider_types";
import type { Doc, Id } from "../_generated/dataModel";
import { WindowsTableSchema } from "../models/window";
import { ExperimentsTableSchema, RunStageSchema } from "../models/experiments";
import {
  BundleStrategySchema,
  SemanticLevelSchema,
} from "../models/_shared";
import { CreateWindowResult } from "../domain/window/window_repo";
import { emitTraceEvent } from "../domain/telemetry/emit";

const EvidenceWindowInputSchema = WindowsTableSchema.pick({
  query: true,
  country: true,
  start_date: true,
  end_date: true,
  model: true,
});

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
        target_count: evidence_limit,
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

    await ctx.scheduler.runAfter(0, internal.packages.lab.startWindowFlow,
      { window_id, evidence_limit }
    );

    return { window_id };
  },
});

export const startWindowFlow = zInternalAction({
  args: z.object({
    window_id: zid("windows"),
    evidence_limit: z.number().int().min(1),
  }),
  handler: async (ctx, args) => {
    const { window_id, evidence_limit } = args;
    await emitTraceEvent(ctx, {
      trace_id: `window:${window_id}`,
      entity_type: "window",
      entity_id: String(window_id),
      event_name: "window_flow_started",
      payload_json: JSON.stringify({
        evidence_limit,
      }),
    });

    try {
      const { workflow_id, workflow_run_id } =
        await ctx.runAction(internal.domain.temporal.temporal_client.startWindowWorkflow, {
          window_id,
        });
      await ctx.runMutation(
        api.packages.worker.bindWindowWorkflow,
        {
          window_id,
          workflow_id,
          workflow_run_id,
        },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.packages.worker.markWindowProcessError, {
        window_id,
        stage: "collect",
        error_message: errorMessage,
      });
    }
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
      start_date: z.string(),
      end_date: z.string(),
      country: z.string(),
      query: z.string(),
      model: modelTypeSchema,
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
    const evidenceRows = await ctx.db.query("evidences").collect();
    const evidencesByWindow = new Map<string, Array<Doc<"evidences">>>();
    for (const evidence of evidenceRows) {
      const current = evidencesByWindow.get(evidence.window_id) ?? [];
      current.push(evidence);
      evidencesByWindow.set(evidence.window_id, current);
    }

    const results = [] as Array<{
      window_id: string;
      start_date: string;
      end_date: string;
      country: string;
      query: string;
      model: ModelType;
      evidence_count: number;
      evidence_status: EvidenceStatus;
    }>;

    for (const window of windows) {
      const evidences = evidencesByWindow.get(window._id) ?? [];
      const evidence_status = deriveEvidenceStatus(window.status, evidences);
      results.push({
        window_id: window._id,
        start_date: window.start_date,
        end_date: window.end_date,
        country: window.country,
        query: window.query,
        model: window.model,
        evidence_count: window.target_count,
        evidence_status,
      });
    }

    results.sort((a, b) => a.query.localeCompare(b.query));
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
      internal.domain.runs.experiments_repo.listPoolEvidenceLinks,
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
      internal.domain.runs.experiments_repo.createPool,
      args,
    );
    return { pool_id };
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
    await ctx.runMutation(
      internal.domain.orchestrator.scheduler.startScheduler,
      {},
    );
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
      internal.domain.runs.experiments_data.listExperiments,
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
      internal.domain.runs.experiments_data.getExperimentSummary,
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
      internal.domain.runs.experiments_data.listExperimentEvidence,
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
      internal.domain.runs.experiments_data.getRunSummary,
      args,
    );
  },
});

export const getWindowSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ window_id: zid("windows") }),
  handler: async (ctx, { window_id }) => {
    const window = await ctx.runQuery(
      internal.domain.window.window_repo.getWindow,
      { window_id },
    );
    const evidences = (await ctx.runQuery(
      internal.domain.window.window_repo.listEvidenceByWindow,
      { window_id },
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
      window_id: window._id,
      status: window.status,
      current_stage: window.current_stage,
      target_count: window.target_count,
      completed_count: window.completed_count,
      evidence_total: window.target_count,
      l1_completed,
      l2_completed,
      l3_completed,
      trace_id: `window:${window._id}`,
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
    const requestRows = await ctx.db
      .query("llm_requests")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();
    const targetStates = await ctx.db
      .query("process_request_targets")
      .withIndex("by_process", (q) =>
        q.eq("process_type", "run").eq("process_id", run_id),
      )
      .collect();
    const runSummary = await ctx.runQuery(
      internal.domain.runs.experiments_data.getRunSummary,
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
      request_id: Id<"llm_requests">;
      custom_key: string;
      attempt_index: number | null;
      last_error: string | null;
      status: "pending" | "success" | "error";
      assistant_output_preview: string | null;
    }>;

    for (const request of requestRows) {
      const parts = request.custom_key.split(":");
      const stage = parts[2];
      if (
        stage !== "rubric_gen" &&
        stage !== "rubric_critic" &&
        stage !== "score_gen" &&
        stage !== "score_critic"
      ) {
        continue;
      }
      stageRollup[stage][request.status] += 1;
      if (request.status === "error") {
        failed_requests.push({
          request_id: request._id,
          custom_key: request.custom_key,
          attempt_index: request.attempt_index ?? null,
          last_error: request.last_error ?? null,
          status: request.status,
          assistant_output_preview: request.assistant_output?.slice(0, 400) ?? null,
        });
      }
    }

    const terminal_failed_targets = targetStates
      .filter((state) => state.resolution === "exhausted")
      .map((state) => ({
        sample_id: state.target_type === "sample"
          ? state.target_id as Id<"samples">
          : sampleIdByScoreTargetId.get(state.target_id) ?? null,
        sample_ordinal: state.target_type === "sample"
          ? sampleOrdinalById.get(state.target_id) ?? null
          : sampleOrdinalById.get(String(sampleIdByScoreTargetId.get(state.target_id) ?? "")) ?? null,
        target_type: state.target_type,
        target_id: state.target_id,
        stage: state.stage,
        custom_key: state.custom_key,
        attempt_count: state.attempt_count,
        retry_count: state.retry_count,
        error_class: state.latest_error_class,
        error_message: state.latest_error_message,
      }));

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
        total: requestRows.length,
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
