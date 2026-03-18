import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { zInternalQuery } from "../../utils/custom_fns";

export const ANALYSIS_EXPORT_SCHEMA_VERSION = 2;
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 250;

export const AnalysisPaginationArgsSchema = z.object({
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  cursor: z.string().nullable().optional(),
});

const NormalizedExperimentSchema = z.object({
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  pool_id: zid("pools"),
  pool_tag: z.string().nullable(),
  bundle_plan_id: zid("bundle_plans").nullable(),
  bundle_plan_tag: z.string().nullable(),
  bundle_strategy: z.enum([
    "window_round_robin",
    "random_bundle",
    "semantic_cluster",
    "semantic_cluster_projected",
  ]),
  bundle_strategy_version: z.string().nullable(),
  clustering_seed: z.number().nullable(),
  bundle_source_view: z.enum([
    "l0_raw",
    "l1_cleaned",
    "l2_neutralized",
    "l3_abstracted",
  ]).nullable(),
  evidence_count: z.number().int().nonnegative(),
  model_id: z.string(),
  rubric_model: z.string(),
  scoring_model: z.string(),
  concept: z.string(),
  scale_size: z.number().int().positive(),
  scoring_method: z.enum(["single", "subset"]),
  abstain_enabled: z.boolean(),
  evidence_view: z.enum([
    "l0_raw",
    "l1_cleaned",
    "l2_neutralized",
    "l3_abstracted",
  ]),
  evidence_bundle_size: z.number().int().positive(),
  randomizations: z.array(
    z.enum(["anonymize_stages", "hide_label_text", "shuffle_rubric_order"]),
  ),
});

const AnalysisRunSummarySchema = z.object({
  run_id: zid("runs"),
  status: z.enum(["start", "queued", "running", "paused", "completed", "error", "canceled"]),
  created_at: z.number(),
  target_count: z.number().int().nonnegative(),
  completed_count: z.number().int().nonnegative(),
  current_stage: z.enum(["rubric_gen", "rubric_critic", "score_gen", "score_critic"]),
  pause_after: z.enum(["rubric_gen", "rubric_critic", "score_gen", "score_critic"]).nullable(),
});

export const AnalysisExperimentSummarySchema = NormalizedExperimentSchema.extend({
  latest_completed_run_id: zid("runs").nullable(),
  latest_completed_run_created_at: z.number().nullable(),
  completed_run_count: z.number().int().nonnegative(),
});

export const AnalysisManifestSchema = z.object({
  export_schema_version: z.number().int().positive(),
  experiment: NormalizedExperimentSchema,
  run: AnalysisRunSummarySchema,
  counts: z.object({
    responses: z.number().int().nonnegative(),
    rubrics: z.number().int().nonnegative(),
    evidence: z.number().int().nonnegative(),
    samples: z.number().int().nonnegative(),
  }),
});

export const AnalysisResponseRowSchema = z.object({
  response_id: zid("scores"),
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  run_id: zid("runs"),
  sample_id: zid("samples"),
  sample_ordinal: z.number().int().positive(),
  score_target_id: zid("sample_score_targets"),
  score_critic_id: zid("score_critics").nullable(),
  rubric_id: zid("rubrics").nullable(),
  rubric_critic_id: zid("rubric_critics").nullable(),
  model: z.string(),
  concept: z.string(),
  scale_size: z.number().int().positive(),
  scoring_method: z.enum(["single", "subset"]),
  abstain_enabled: z.boolean(),
  evidence_view: z.enum([
    "l0_raw",
    "l1_cleaned",
    "l2_neutralized",
    "l3_abstracted",
  ]),
  evidence_bundle_size: z.number().int().positive(),
  bundle_plan_tag: z.string().nullable(),
  bundle_strategy: z.enum([
    "window_round_robin",
    "random_bundle",
    "semantic_cluster",
    "semantic_cluster_projected",
  ]),
  bundle_strategy_version: z.string().nullable(),
  clustering_seed: z.number().nullable(),
  randomizations: z.array(
    z.enum(["anonymize_stages", "hide_label_text", "shuffle_rubric_order"]),
  ),
  decoded_scores: z.array(z.number().int()),
  abstained: z.boolean(),
  subset_size: z.number().int().nonnegative(),
  justification: z.string(),
  score_expert_agreement_prob: z.number().nullable(),
  rubric_observability_score: z.number().nullable(),
  rubric_discriminability_score: z.number().nullable(),
  evidence_ids: z.array(zid("evidences")),
  evidence_labels: z.array(z.string()),
  evidence_titles: z.array(z.string()),
  evidence_urls: z.array(z.string()),
  window_ids: z.array(zid("windows")),
  evidence_positions: z.array(z.number().int().nonnegative()),
});

export const AnalysisRubricRowSchema = z.object({
  rubric_id: zid("rubrics"),
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  run_id: zid("runs"),
  sample_id: zid("samples"),
  sample_ordinal: z.number().int().positive(),
  model: z.string(),
  concept: z.string(),
  scale_size: z.number().int().positive(),
  stages: z.array(z.object({
    stage_number: z.number().int().positive(),
    label: z.string(),
    criteria: z.array(z.string()),
  })),
  label_mapping: z.record(z.string(), z.number().int()),
  justification: z.string(),
  observability_score: z.number().nullable(),
  discriminability_score: z.number().nullable(),
});

export const AnalysisEvidenceRowSchema = z.object({
  evidence_id: zid("evidences"),
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  run_id: zid("runs"),
  pool_tag: z.string().nullable(),
  label: z.string(),
  title: z.string(),
  url: z.string(),
  window_id: zid("windows"),
});

export const AnalysisSampleRowSchema = z.object({
  sample_id: zid("samples"),
  experiment_id: zid("experiments"),
  experiment_tag: z.string(),
  run_id: zid("runs"),
  sample_ordinal: z.number().int().positive(),
  model: z.string(),
  seed: z.number(),
  rubric_id: zid("rubrics").nullable(),
  rubric_critic_id: zid("rubric_critics").nullable(),
  score_target_total: z.number().int().nonnegative(),
  score_count: z.number().int().nonnegative(),
  score_critic_count: z.number().int().nonnegative(),
});

export function analysisPageResultSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    page: z.array(item),
    continue_cursor: z.string().nullable(),
    is_done: z.boolean(),
    total_count: z.number().int().nonnegative(),
  });
}

type NormalizedExperiment = z.infer<typeof NormalizedExperimentSchema>;
type AnalysisRunSummary = z.infer<typeof AnalysisRunSummarySchema>;

function normalizePageArgs(args: z.infer<typeof AnalysisPaginationArgsSchema>) {
  const limit = args.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = args.cursor == null || args.cursor === ""
    ? 0
    : Math.max(0, Number.parseInt(args.cursor, 10) || 0);
  return { limit, offset };
}

function slicePage<T>(
  rows: T[],
  args: z.infer<typeof AnalysisPaginationArgsSchema>,
) {
  const { limit, offset } = normalizePageArgs(args);
  const page = rows.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    page,
    continue_cursor: nextOffset < rows.length ? String(nextOffset) : null,
    is_done: nextOffset >= rows.length,
    total_count: rows.length,
  };
}

function sortByCreationTime<T extends { _creationTime: number; _id: string }>(
  rows: T[],
) {
  return rows
    .slice()
    .sort((a, b) => a._creationTime - b._creationTime || String(a._id).localeCompare(String(b._id)));
}

async function getExperimentByTag(
  ctx: QueryCtx,
  experimentTag: string,
) {
  const experiment = await ctx.db
    .query("experiments")
    .withIndex("by_experiment_tag", (q) => q.eq("experiment_tag", experimentTag))
    .first();
  if (!experiment) {
    throw new Error(`Experiment not found for tag "${experimentTag}"`);
  }
  return experiment;
}

async function getCompletedRunsForExperiment(
  ctx: QueryCtx,
  experimentId: Id<"experiments">,
) {
  const runs = await ctx.db
    .query("runs")
    .withIndex("by_experiment", (q) => q.eq("experiment_id", experimentId))
    .collect();
  return sortByCreationTime(
    runs.filter((run) => run.status === "completed"),
  );
}

async function getRequiredRun(
  ctx: QueryCtx,
  runId: Id<"runs">,
) {
  const run = await ctx.db.get(runId);
  if (!run) throw new Error("Run not found");
  if (run.status !== "completed") {
    throw new Error("Analysis exports require a completed run");
  }
  return run;
}

async function getPoolTag(
  ctx: QueryCtx,
  poolId: Id<"pools">,
) {
  const pool = await ctx.db.get(poolId);
  return pool?.pool_tag ?? null;
}

async function getPoolEvidenceRows(
  ctx: QueryCtx,
  poolId: Id<"pools">,
) {
  const links = await ctx.db
    .query("pool_evidences")
    .withIndex("by_pool", (q) => q.eq("pool_id", poolId))
    .collect();
  const sortedLinks = links
    .slice()
    .sort((a, b) => String(a.evidence_id).localeCompare(String(b.evidence_id)));
  const evidences = await Promise.all(
    sortedLinks.map(async (link) => {
      const evidence = await ctx.db.get(link.evidence_id);
      if (!evidence) return null;
      return {
        evidence,
        link,
      };
    }),
  );
  return evidences.filter((row): row is { evidence: Doc<"evidences">; link: Doc<"pool_evidences"> } => row != null);
}

async function normalizeExperiment(
  ctx: QueryCtx,
  experiment: Doc<"experiments">,
): Promise<NormalizedExperiment> {
  const poolTag = await getPoolTag(ctx, experiment.pool_id);
  const bundlePlan = experiment.bundle_plan_id
    ? await ctx.db.get(experiment.bundle_plan_id)
    : null;
  const bundleStrategy = bundlePlan?.strategy
    ?? experiment.scoring_config.bundle_strategy
    ?? "window_round_robin";
  return {
    experiment_id: experiment._id,
    experiment_tag: experiment.experiment_tag,
    pool_id: experiment.pool_id,
    pool_tag: poolTag,
    bundle_plan_id: experiment.bundle_plan_id ?? null,
    bundle_plan_tag: bundlePlan?.bundle_plan_tag ?? null,
    bundle_strategy: bundleStrategy,
    bundle_strategy_version: bundlePlan?.strategy_version
      ?? experiment.scoring_config.bundle_strategy_version
      ?? null,
    clustering_seed: bundlePlan?.seed
      ?? experiment.scoring_config.clustering_seed
      ?? null,
    bundle_source_view: bundlePlan?.source_view ?? null,
    evidence_count: experiment.total_count > 0 ? experiment.total_count : (
      await ctx.db
        .query("pool_evidences")
        .withIndex("by_pool", (q) => q.eq("pool_id", experiment.pool_id))
        .collect()
    ).length,
    model_id: experiment.scoring_config.model,
    rubric_model: experiment.rubric_config.model,
    scoring_model: experiment.scoring_config.model,
    concept: experiment.rubric_config.concept,
    scale_size: experiment.rubric_config.scale_size,
    scoring_method: experiment.scoring_config.method,
    abstain_enabled: experiment.scoring_config.abstain_enabled,
    evidence_view: experiment.scoring_config.evidence_view,
    evidence_bundle_size: experiment.scoring_config.evidence_bundle_size,
    randomizations: experiment.scoring_config.randomizations,
  };
}

function summarizeRun(run: Doc<"runs">): AnalysisRunSummary {
  return {
    run_id: run._id,
    status: run.status,
    created_at: run._creationTime,
    target_count: run.target_count,
    completed_count: run.completed_count,
    current_stage: run.current_stage,
    pause_after: run.pause_after ?? null,
  };
}

async function resolveManifest(
  ctx: QueryCtx,
  args: {
    experiment_tag?: string;
    run_id?: Id<"runs">;
  },
) {
  let run: Doc<"runs">;
  let experiment: Doc<"experiments">;

  if (args.run_id) {
    run = await getRequiredRun(ctx, args.run_id);
    const foundExperiment = await ctx.db.get(run.experiment_id);
    if (!foundExperiment) throw new Error("Experiment not found for run");
    experiment = foundExperiment;
    if (args.experiment_tag && experiment.experiment_tag !== args.experiment_tag) {
      throw new Error("Run does not belong to experiment_tag");
    }
  } else if (args.experiment_tag) {
    experiment = await getExperimentByTag(ctx, args.experiment_tag);
    const completedRuns = await getCompletedRunsForExperiment(ctx, experiment._id);
    const latestCompleted = completedRuns[completedRuns.length - 1];
    if (!latestCompleted) {
      throw new Error(`No completed runs found for "${args.experiment_tag}"`);
    }
    run = latestCompleted;
  } else {
    throw new Error("Expected run_id or experiment_tag");
  }

  const normalizedExperiment = await normalizeExperiment(ctx, experiment);
  const samples = await ctx.db
    .query("samples")
    .withIndex("by_run", (q) => q.eq("run_id", run._id))
    .collect();
  const rubrics = await ctx.db
    .query("rubrics")
    .withIndex("by_run", (q) => q.eq("run_id", run._id))
    .collect();
  const scores = await ctx.db
    .query("scores")
    .withIndex("by_run", (q) => q.eq("run_id", run._id))
    .collect();
  const poolEvidenceRows = await getPoolEvidenceRows(ctx, experiment.pool_id);

  return {
    experiment,
    normalizedExperiment,
    run,
    summary: summarizeRun(run),
    counts: {
      responses: scores.length,
      rubrics: rubrics.length,
      evidence: poolEvidenceRows.length,
      samples: samples.length,
    },
  };
}

async function buildSampleContext(
  ctx: QueryCtx,
  runId: Id<"runs">,
) {
  const samples = sortByCreationTime(
    await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect(),
  );
  const sampleOrdinalById = new Map<string, number>();
  samples.forEach((sample, index) => {
    sampleOrdinalById.set(String(sample._id), index + 1);
  });

  const rubrics = sortByCreationTime(
    await ctx.db
      .query("rubrics")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect(),
  );
  const rubricBySampleId = new Map<string, Doc<"rubrics">>();
  for (const rubric of rubrics) {
    rubricBySampleId.set(String(rubric.sample_id), rubric);
  }

  const rubricCritics = sortByCreationTime(
    await ctx.db
      .query("rubric_critics")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect(),
  );
  const rubricCriticBySampleId = new Map<string, Doc<"rubric_critics">>();
  for (const critic of rubricCritics) {
    rubricCriticBySampleId.set(String(critic.sample_id), critic);
  }

  return {
    samples,
    sampleOrdinalById,
    rubricBySampleId,
    rubricCriticBySampleId,
  };
}

async function buildEvidenceContext(
  ctx: QueryCtx,
  experiment: Doc<"experiments">,
) {
  const poolEvidenceRows = await getPoolEvidenceRows(ctx, experiment.pool_id);
  const evidenceLabelById = new Map<string, string>();
  const evidenceById = new Map<string, Doc<"evidences">>();
  poolEvidenceRows.forEach(({ evidence }, index) => {
    evidenceLabelById.set(String(evidence._id), `E${index + 1}`);
    evidenceById.set(String(evidence._id), evidence);
  });
  return {
    poolEvidenceRows,
    evidenceLabelById,
    evidenceById,
  };
}

export const listAnalysisExperiments = zInternalQuery({
  args: z.object({}),
  returns: z.array(AnalysisExperimentSummarySchema),
  handler: async (ctx) => {
    const experiments = await ctx.db.query("experiments").collect();
    const results = [] as z.infer<typeof AnalysisExperimentSummarySchema>[];

    for (const experiment of experiments
      .slice()
      .sort((a, b) => a.experiment_tag.localeCompare(b.experiment_tag))) {
      const normalized = await normalizeExperiment(ctx, experiment);
      const completedRuns = await getCompletedRunsForExperiment(ctx, experiment._id);
      const latestCompleted = completedRuns[completedRuns.length - 1] ?? null;
      results.push({
        ...normalized,
        latest_completed_run_id: latestCompleted?._id ?? null,
        latest_completed_run_created_at: latestCompleted?._creationTime ?? null,
        completed_run_count: completedRuns.length,
      });
    }

    return results;
  },
});

export const getAnalysisManifest = zInternalQuery({
  args: z.object({
    experiment_tag: z.string().optional(),
    run_id: zid("runs").optional(),
  }),
  returns: AnalysisManifestSchema,
  handler: async (ctx, args) => {
    const manifest = await resolveManifest(ctx, args);
    return {
      export_schema_version: ANALYSIS_EXPORT_SCHEMA_VERSION,
      experiment: manifest.normalizedExperiment,
      run: manifest.summary,
      counts: manifest.counts,
    };
  },
});

export const listAnalysisResponses = zInternalQuery({
  args: z.object({
    run_id: zid("runs"),
    pagination: AnalysisPaginationArgsSchema.optional(),
  }),
  returns: analysisPageResultSchema(AnalysisResponseRowSchema),
  handler: async (ctx, args) => {
    const manifest = await resolveManifest(ctx, { run_id: args.run_id });
    const { experiment, normalizedExperiment, run } = manifest;
    const pagination = args.pagination ?? {};
    const { samples, sampleOrdinalById, rubricCriticBySampleId } = await buildSampleContext(ctx, run._id);
    const sampleById = new Map(samples.map((sample) => [String(sample._id), sample]));
    const scores = sortByCreationTime(
      await ctx.db
        .query("scores")
        .withIndex("by_run", (q) => q.eq("run_id", run._id))
        .collect(),
    );
    const scoreCritics = sortByCreationTime(
      await ctx.db
        .query("score_critics")
        .withIndex("by_run", (q) => q.eq("run_id", run._id))
        .collect(),
    );
    const scoreCriticByTargetId = new Map<string, Doc<"score_critics">>();
    for (const critic of scoreCritics) {
      scoreCriticByTargetId.set(String(critic.score_target_id), critic);
    }
    const { evidenceLabelById, evidenceById } = await buildEvidenceContext(ctx, experiment);

    const rows = await Promise.all(scores.map(async (score) => {
      const sample = sampleById.get(String(score.sample_id));
      if (!sample) {
        throw new Error(`Sample missing for score ${score._id}`);
      }
      const rubricCritic = rubricCriticBySampleId.get(String(sample._id));
      const scoreCritic = scoreCriticByTargetId.get(String(score.score_target_id)) ?? null;
      const items = sortByCreationTime(
        await ctx.db
          .query("sample_score_target_items")
          .withIndex("by_score_target", (q) => q.eq("score_target_id", score.score_target_id))
          .collect(),
      ).sort((a, b) => a.position - b.position);

      const evidenceIds = items.map((item) => item.evidence_id);
      const evidenceLabels = items.map((item) => evidenceLabelById.get(String(item.evidence_id)) ?? String(item.evidence_id));
      const evidenceTitles = items.map((item) => evidenceById.get(String(item.evidence_id))?.title ?? "");
      const evidenceUrls = items.map((item) => evidenceById.get(String(item.evidence_id))?.url ?? "");
      const windowIds = items.map((item) => item.window_id);
      const evidencePositions = items.map((item) => item.position);

      return {
        response_id: score._id,
        experiment_id: experiment._id,
        experiment_tag: experiment.experiment_tag,
        run_id: run._id,
        sample_id: sample._id,
        sample_ordinal: sampleOrdinalById.get(String(sample._id)) ?? 0,
        score_target_id: score.score_target_id,
        score_critic_id: scoreCritic?._id ?? null,
        rubric_id: sample.rubric_id,
        rubric_critic_id: sample.rubric_critic_id,
        model: score.model,
        concept: normalizedExperiment.concept,
        scale_size: normalizedExperiment.scale_size,
        scoring_method: normalizedExperiment.scoring_method,
        abstain_enabled: normalizedExperiment.abstain_enabled,
        evidence_view: normalizedExperiment.evidence_view,
        evidence_bundle_size: normalizedExperiment.evidence_bundle_size,
        bundle_plan_tag: normalizedExperiment.bundle_plan_tag,
        bundle_strategy: normalizedExperiment.bundle_strategy,
        bundle_strategy_version: normalizedExperiment.bundle_strategy_version,
        clustering_seed: normalizedExperiment.clustering_seed,
        randomizations: normalizedExperiment.randomizations,
        decoded_scores: score.decoded_scores,
        abstained: score.decoded_scores.length === 0,
        subset_size: score.decoded_scores.length,
        justification: score.justification,
        score_expert_agreement_prob: scoreCritic?.expert_agreement_prob ?? null,
        rubric_observability_score: rubricCritic?.expert_agreement_prob.observability_score ?? null,
        rubric_discriminability_score: rubricCritic?.expert_agreement_prob.discriminability_score ?? null,
        evidence_ids: evidenceIds,
        evidence_labels: evidenceLabels,
        evidence_titles: evidenceTitles,
        evidence_urls: evidenceUrls,
        window_ids: windowIds,
        evidence_positions: evidencePositions,
      };
    }));

    return slicePage(rows, pagination);
  },
});

export const listAnalysisRubrics = zInternalQuery({
  args: z.object({
    run_id: zid("runs"),
    pagination: AnalysisPaginationArgsSchema.optional(),
  }),
  returns: analysisPageResultSchema(AnalysisRubricRowSchema),
  handler: async (ctx, args) => {
    const manifest = await resolveManifest(ctx, { run_id: args.run_id });
    const { experiment, run } = manifest;
    const normalizedExperiment = manifest.normalizedExperiment;
    const pagination = args.pagination ?? {};
    const { sampleOrdinalById, rubricCriticBySampleId } = await buildSampleContext(ctx, run._id);
    const rubrics = sortByCreationTime(
      await ctx.db
        .query("rubrics")
        .withIndex("by_run", (q) => q.eq("run_id", run._id))
        .collect(),
    );

    const rows = rubrics.map((rubric) => {
      const rubricCritic = rubricCriticBySampleId.get(String(rubric.sample_id));
      return {
        rubric_id: rubric._id,
        experiment_id: experiment._id,
        experiment_tag: experiment.experiment_tag,
        run_id: run._id,
        sample_id: rubric.sample_id,
        sample_ordinal: sampleOrdinalById.get(String(rubric.sample_id)) ?? 0,
        model: rubric.model,
        concept: normalizedExperiment.concept,
        scale_size: rubric.scale_size,
        stages: rubric.stages,
        label_mapping: rubric.label_mapping,
        justification: rubric.justification,
        observability_score: rubricCritic?.expert_agreement_prob.observability_score ?? null,
        discriminability_score: rubricCritic?.expert_agreement_prob.discriminability_score ?? null,
      };
    });

    return slicePage(rows, pagination);
  },
});

export const listAnalysisEvidence = zInternalQuery({
  args: z.object({
    run_id: zid("runs"),
    pagination: AnalysisPaginationArgsSchema.optional(),
  }),
  returns: analysisPageResultSchema(AnalysisEvidenceRowSchema),
  handler: async (ctx, args) => {
    const manifest = await resolveManifest(ctx, { run_id: args.run_id });
    const { experiment, run } = manifest;
    const pagination = args.pagination ?? {};
    const poolTag = await getPoolTag(ctx, experiment.pool_id);
    const { poolEvidenceRows } = await buildEvidenceContext(ctx, experiment);
    const rows = poolEvidenceRows.map(({ evidence }, index) => ({
      evidence_id: evidence._id,
      experiment_id: experiment._id,
      experiment_tag: experiment.experiment_tag,
      run_id: run._id,
      pool_tag: poolTag,
      label: `E${index + 1}`,
      title: evidence.title,
      url: evidence.url,
      window_id: evidence.window_id,
    }));
    return slicePage(rows, pagination);
  },
});

export const listAnalysisSamples = zInternalQuery({
  args: z.object({
    run_id: zid("runs"),
    pagination: AnalysisPaginationArgsSchema.optional(),
  }),
  returns: analysisPageResultSchema(AnalysisSampleRowSchema),
  handler: async (ctx, args) => {
    const manifest = await resolveManifest(ctx, { run_id: args.run_id });
    const { experiment, run } = manifest;
    const pagination = args.pagination ?? {};
    const { samples, sampleOrdinalById } = await buildSampleContext(ctx, run._id);
    const rows = samples.map((sample) => ({
      sample_id: sample._id,
      experiment_id: experiment._id,
      experiment_tag: experiment.experiment_tag,
      run_id: run._id,
      sample_ordinal: sampleOrdinalById.get(String(sample._id)) ?? 0,
      model: sample.model,
      seed: sample.seed,
      rubric_id: sample.rubric_id,
      rubric_critic_id: sample.rubric_critic_id,
      score_target_total: sample.score_target_total,
      score_count: sample.score_count,
      score_critic_count: sample.score_critic_count,
    }));
    return slicePage(rows, pagination);
  },
});
