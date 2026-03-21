import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalQuery } from "../../utils/custom_fns";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { RunStageSchema } from "../../models/experiments";
import { StateStatusSchema } from "../../models/_shared";
import { getExperimentTotalCount } from "./experiment_progress";
import {
  getRunCompletedCount,
  getRunProgressSnapshot,
} from "./run_progress";
import { countCompletedSamples } from "./sample_progress";

function deriveExperimentStatus(
  runs: Array<Doc<"runs">>,
): z.infer<typeof StateStatusSchema> {
  if (runs.length === 0) return "start";

  const latest = latestRun(runs);
  if (latest) {
    if (latest.status === "running") return "running";
    if (latest.status === "paused") return "paused";
    if (latest.status === "completed") return "completed";
    if (latest.status === "error") return "error";
    if (latest.status === "canceled") return "canceled";
    if (latest.status === "queued" || latest.status === "start") {
      return "queued";
    }
  }

  const statuses = runs.map((run) => run.status);
  if (statuses.includes("running")) return "running";
  if (statuses.includes("paused")) return "paused";
  if (statuses.includes("error")) return "error";
  if (statuses.includes("canceled")) return "canceled";
  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.some((status) => status === "queued" || status === "start")) {
    return "queued";
  }
  return "start";
}

function latestRun(runs: Array<Doc<"runs">>) {
  if (runs.length === 0) return null;
  return runs
    .slice()
    .sort((a, b) => b._creationTime - a._creationTime)[0];
}

function sumSampleScoreCount(
  samples: Array<Doc<"samples">>,
  field: "score_count" | "score_critic_count",
) {
  return samples.reduce((sum, sample) => sum + (sample[field] ?? 0), 0);
}

async function latestRunHasFailures(
  ctx: QueryCtx,
  run: Doc<"runs">,
  samples: Array<Doc<"samples">>,
): Promise<{ hasFailures: boolean; completedCount: number }> {
  const scoreTargets = await ctx.db
    .query("sample_score_targets")
    .withIndex("by_run", (q) => q.eq("run_id", run._id))
    .collect();
  const completedCount = countCompletedSamples(samples, scoreTargets);
  const snapshot = await getRunProgressSnapshot(ctx, run._id);

  return {
    hasFailures: snapshot?.hasFailures ?? false,
    completedCount,
  };
}

function stageCountsFromArtifacts(
  samples: Array<Doc<"samples">>,
) {
  return {
    rubric_gen: samples.filter((sample) => sample.rubric_id != null).length,
    rubric_critic: samples.filter((sample) => sample.rubric_critic_id != null).length,
    score_gen: sumSampleScoreCount(samples, "score_count"),
    score_critic: sumSampleScoreCount(samples, "score_critic_count"),
  };
}

function stageCountsFromSnapshot(
  snapshot: Awaited<ReturnType<typeof getRunProgressSnapshot>> | null,
) {
  return {
    rubric_gen: snapshot?.byStage.rubric_gen.completed ?? 0,
    rubric_critic: snapshot?.byStage.rubric_critic.completed ?? 0,
    score_gen: snapshot?.byStage.score_gen.completed ?? 0,
    score_critic: snapshot?.byStage.score_critic.completed ?? 0,
  };
}

async function listEvidenceLinks(
  ctx: QueryCtx,
  poolId: Id<"pools">,
) {
  return ctx.db
    .query("pool_evidences")
    .withIndex("by_pool", (q) => q.eq("pool_id", poolId))
    .collect();
}

async function collectWindowIdsForLinks(
  ctx: QueryCtx,
  links: Doc<"pool_evidences">[],
  evidenceCache: Map<Id<"evidences">, Doc<"evidences">>,
) {
  const windowIds = new Set<string>();
  for (const link of links) {
    let evidence = evidenceCache.get(link.evidence_id);
    if (!evidence) {
      const fetched = await ctx.db.get(link.evidence_id);
      if (fetched) {
        evidence = fetched;
        evidenceCache.set(link.evidence_id, fetched);
      }
    }
    if (evidence) windowIds.add(String(evidence.window_id));
  }
  return windowIds;
}

async function buildExperimentRows(
  ctx: QueryCtx,
  experiments: Array<Doc<"experiments">>,
) {
  experiments.sort((a, b) => a.experiment_tag.localeCompare(b.experiment_tag));

  const evidenceCache = new Map<Id<"evidences">, Doc<"evidences">>();
  const results = [] as Array<{
    experiment_id: Id<"experiments">;
    experiment_tag: string;
    bundle_plan_id?: Id<"bundle_plans">;
    rubric_config: Doc<"experiments">["rubric_config"];
    scoring_config: Doc<"experiments">["scoring_config"];
    total_count: number;
    evidence_selected_count: number;
    window_count: number;
    status: z.infer<typeof StateStatusSchema>;
    latest_run?: {
      run_id: Id<"runs">;
      status: string;
      current_stage: z.infer<typeof RunStageSchema>;
      target_count: number;
      completed_count: number;
      pause_after: z.infer<typeof RunStageSchema> | null;
      stage_counts: {
        rubric_gen: number;
        rubric_critic: number;
        score_gen: number;
        score_critic: number;
      };
      created_at: number;
      has_failures: boolean;
    };
  }>;

  for (const experiment of experiments) {
    const experimentRuns = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();
    const links = await listEvidenceLinks(ctx, experiment.pool_id);
    const windowIds = await collectWindowIdsForLinks(ctx, links, evidenceCache);
    const latest = latestRun(experimentRuns);
    const totalCount = typeof experiment.total_count === "number"
      ? experiment.total_count
      : await getExperimentTotalCount(ctx, experiment._id);
    let latestSamples: Array<Doc<"samples">> = [];
    if (latest) {
      latestSamples = await ctx.db
        .query("samples")
        .withIndex("by_run", (q) => q.eq("run_id", latest._id))
        .collect();
    }
    const latestRunState = latest
      ? await latestRunHasFailures(ctx, latest, latestSamples)
      : { hasFailures: false, completedCount: 0 };

    results.push({
      experiment_id: experiment._id,
      experiment_tag: experiment.experiment_tag,
      bundle_plan_id: experiment.bundle_plan_id,
      rubric_config: experiment.rubric_config,
      scoring_config: experiment.scoring_config,
      total_count: totalCount,
      evidence_selected_count: links.length,
      window_count: windowIds.size,
      status: deriveExperimentStatus(experimentRuns),
      latest_run: latest
        ? {
          run_id: latest._id,
          status: latest.status,
          current_stage: latest.current_stage,
          target_count: latest.target_count,
          completed_count: latestRunState.completedCount,
          pause_after: latest.pause_after ?? null,
          stage_counts: stageCountsFromArtifacts(latestSamples),
          created_at: latest._creationTime,
          has_failures: latestRunState.hasFailures,
        }
        : undefined,
    });
  }

  return results;
}

export const listExperiments = zInternalQuery({
  args: z.object({}),
  handler: async (ctx) => {
    const experiments = await ctx.db.query("experiments").collect();
    return buildExperimentRows(ctx, experiments);
  },
});

export const listExperimentsByTags = zInternalQuery({
  args: z.object({
    experiment_tags: z.array(z.string()).min(1),
  }),
  handler: async (ctx, args) => {
    const experiments = (
      await Promise.all(
        args.experiment_tags.map((experimentTag) =>
          ctx.db
            .query("experiments")
            .withIndex("by_experiment_tag", (q) => q.eq("experiment_tag", experimentTag))
            .first()
        ),
      )
    ).filter((experiment): experiment is Doc<"experiments"> => experiment != null);

    return buildExperimentRows(ctx, experiments);
  },
});

export const getExperimentSummary = zInternalQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const runs = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();

    const links = await listEvidenceLinks(ctx, experiment.pool_id);
    const evidenceCache = new Map<Id<"evidences">, Doc<"evidences">>();
    const windowIds = await collectWindowIdsForLinks(ctx, links, evidenceCache);
    const runArtifacts = await Promise.all(
      runs.map(async (run) => {
        const samples = await ctx.db
          .query("samples")
          .withIndex("by_run", (q) => q.eq("run_id", run._id))
          .collect();
        return { run, samples };
      }),
    );

    const counts = {
      samples: runArtifacts.reduce((sum, artifact) => sum + artifact.samples.length, 0),
      rubrics: runArtifacts.reduce(
        (sum, artifact) => sum + artifact.samples.filter((sample) => sample.rubric_id != null).length,
        0,
      ),
      rubric_critics: runArtifacts.reduce(
        (sum, artifact) => sum + artifact.samples.filter((sample) => sample.rubric_critic_id != null).length,
        0,
      ),
      scores: runArtifacts.reduce(
        (sum, artifact) => sum + sumSampleScoreCount(artifact.samples, "score_count"),
        0,
      ),
      score_critics: runArtifacts.reduce(
        (sum, artifact) => sum + sumSampleScoreCount(artifact.samples, "score_critic_count"),
        0,
      ),
    };

    const latest = latestRun(runs);
    const totalCount = typeof experiment.total_count === "number"
      ? experiment.total_count
      : await getExperimentTotalCount(ctx, experiment._id);
    let latestSamples: Array<Doc<"samples">> = [];
    if (latest) {
      latestSamples = await ctx.db
        .query("samples")
        .withIndex("by_run", (q) => q.eq("run_id", latest._id))
        .collect();
    }
    const latestRunState = latest
      ? await latestRunHasFailures(ctx, latest, latestSamples)
      : { hasFailures: false, completedCount: 0 };

    return {
      experiment_id: experiment._id,
      experiment_tag: experiment.experiment_tag,
      bundle_plan_id: experiment.bundle_plan_id,
      rubric_config: experiment.rubric_config,
      scoring_config: experiment.scoring_config,
      total_count: totalCount,
      evidence_selected_count: links.length,
      window_count: windowIds.size,
      window_ids: Array.from(windowIds),
      run_count: runs.length,
      status: deriveExperimentStatus(runs),
      latest_run: latest
        ? {
          run_id: latest._id,
          status: latest.status,
          current_stage: latest.current_stage,
          target_count: latest.target_count,
          completed_count: latestRunState.completedCount,
          pause_after: latest.pause_after ?? null,
          stage_counts: stageCountsFromArtifacts(latestSamples),
          created_at: latest._creationTime,
          has_failures: latestRunState.hasFailures,
        }
        : undefined,
      counts,
    };
  },
});

export const listRunsForExperiments = zInternalQuery({
  args: z.object({
    experiment_ids: z.array(zid("experiments")),
  }),
  returns: z.array(z.object({
    run_id: zid("runs"),
    experiment_id: zid("experiments"),
    status: StateStatusSchema,
    workflow_id: z.string().nullable(),
    workflow_run_id: z.string().nullable(),
    current_stage: RunStageSchema,
    pause_after: RunStageSchema.nullable(),
    created_at: z.number(),
  })),
  handler: async (ctx, args) => {
    const runs = await Promise.all(
      args.experiment_ids.map((experiment_id) =>
        ctx.db
          .query("runs")
          .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment_id))
          .collect(),
      ),
    );

    return runs.flat().map((run) => ({
      run_id: run._id,
      experiment_id: run.experiment_id,
      status: run.status,
      workflow_id: run.workflow_id ?? null,
      workflow_run_id: run.workflow_run_id ?? null,
      current_stage: run.current_stage,
      pause_after: run.pause_after ?? null,
      created_at: run._creationTime,
    }));
  },
});

export const listExperimentEvidence = zInternalQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");
    const links = await listEvidenceLinks(ctx, experiment.pool_id);
    const evidenceRows: Array<{
      evidence_id: Id<"evidences">;
      window_id: Id<"windows">;
      title: string;
      url: string;
      created_at: number;
    }> = [];

    for (const link of links) {
      const evidence = await ctx.db.get(link.evidence_id);
      if (!evidence) continue;

      evidenceRows.push({
        evidence_id: evidence._id,
        window_id: evidence.window_id,
        title: evidence.title,
        url: evidence.url,
        created_at: evidence._creationTime,
      });
    }

    return evidenceRows.sort((a, b) => a.created_at - b.created_at);
  },
});

export const getRunSummary = zInternalQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, { run_id }) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("Run not found");
    const snapshot = await getRunProgressSnapshot(ctx, run._id);
    const completedCount = await getRunCompletedCount(ctx, run._id);
    const stageResults = RunStageSchema.options.map((stage) => {
      const progress = snapshot?.byStage[stage];
      if (!progress) {
        return {
          stage,
          status: "queued",
          total: run.target_count,
          completed: 0,
          failed: 0,
        };
      }
      if (progress.completed === 0 && progress.failed === 0 && !progress.hasPending) {
        return {
          stage,
          status: "queued",
          total: progress.total,
          completed: 0,
          failed: 0,
        };
      }
      return {
        stage,
        status: progress.hasPending ? "running" : "completed",
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
      };
    });

    const failed_stage_count = snapshot?.failedStageCount ?? 0;

    return {
      run_id: run._id,
      status: run.status,
      current_stage: run.current_stage,
      pause_after: run.pause_after ?? null,
      target_count: run.target_count,
      completed_count: completedCount,
      stage_counts: stageCountsFromSnapshot(snapshot),
      has_failures: snapshot?.hasFailures ?? false,
      failed_stage_count,
      stages: stageResults,
    };
  },
});
