import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalQuery } from "../../utils/custom_fns";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { RunStageSchema } from "../../models/experiments";
import { StateStatusSchema } from "../../models/_shared";
import { getExperimentTotalCount } from "./experiment_progress";
import {
  countCompletedSamples,
  getRunCompletedCount,
  getRunProgressSnapshot,
} from "./run_progress";

function deriveExperimentStatus(
  runs: Array<Doc<"runs">>,
): z.infer<typeof StateStatusSchema> {
  if (runs.length === 0) return "start";

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
  scoreUnits: Array<Doc<"sample_evidence_scores">>,
  field: "score_count" | "score_critic_count",
  unitField: "score_id" | "score_critic_id",
) {
  if (scoreUnits.length > 0) {
    return scoreUnits.filter((unit) => unit[unitField] != null).length;
  }
  return samples.reduce((sum, sample) => sum + (sample[field] ?? 0), 0);
}

async function latestRunHasFailures(
  ctx: QueryCtx,
  run: Doc<"runs">,
  evidenceCount: number,
): Promise<{ hasFailures: boolean; completedCount: number }> {
  if (run.status === "completed" || run.status === "error" || run.status === "canceled") {
    const [samples, scoreUnits] = await Promise.all([
      ctx.db
        .query("samples")
        .withIndex("by_run", (q) => q.eq("run_id", run._id))
        .collect(),
      ctx.db
        .query("sample_evidence_scores")
        .withIndex("by_run", (q) => q.eq("run_id", run._id))
        .collect(),
    ]);
    const completedCount = typeof run.completed_count === "number"
      ? run.completed_count
      : countCompletedSamples(samples, scoreUnits);

    if (samples.length < run.target_count) {
      return { hasFailures: true, completedCount };
    }
    if (samples.some((sample) => sample.rubric_id == null || sample.rubric_critic_id == null)) {
      return { hasFailures: true, completedCount };
    }

    if (scoreUnits.length > 0) {
      const expectedScoreUnits = samples.length * evidenceCount;
      if (scoreUnits.length < expectedScoreUnits) {
        return { hasFailures: true, completedCount };
      }
      return {
        hasFailures: scoreUnits.some(
          (unit) => unit.score_id == null || unit.score_critic_id == null,
        ),
        completedCount,
      };
    }

    return {
      hasFailures: samples.some(
        (sample) => (sample.score_count ?? 0) === 0 || (sample.score_critic_count ?? 0) === 0,
      ),
      completedCount,
    };
  }

  const targetStates = await ctx.db
    .query("process_request_targets")
    .withIndex("by_process", (q) =>
      q.eq("process_type", "run").eq("process_id", run._id),
    )
    .collect();

  return {
    hasFailures: targetStates.some((state) => state.resolution === "exhausted"),
    completedCount: typeof run.completed_count === "number"
      ? run.completed_count
      : await getRunCompletedCount(ctx, run._id),
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

export const listExperiments = zInternalQuery({
  args: z.object({}),
  handler: async (ctx) => {
    const experiments = await ctx.db.query("experiments").collect();
    const runs = await ctx.db.query("runs").collect();
    experiments.sort((a, b) => a.experiment_tag.localeCompare(b.experiment_tag));

    const evidenceCache = new Map<Id<"evidences">, Doc<"evidences">>();
    const runsByExperiment = new Map<Id<"experiments">, Doc<"runs">[]>();
    for (const run of runs) {
      const current = runsByExperiment.get(run.experiment_id) ?? [];
      current.push(run);
      runsByExperiment.set(run.experiment_id, current);
    }
    const results = [] as Array<{
      experiment_id: Id<"experiments">;
      experiment_tag: string;
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
        created_at: number;
        has_failures: boolean;
      };
    }>;

    for (const experiment of experiments) {
      const experimentRuns = runsByExperiment.get(experiment._id) ?? [];
      const links = await listEvidenceLinks(ctx, experiment.pool_id);
      const windowIds = await collectWindowIdsForLinks(ctx, links, evidenceCache);
      const latest = latestRun(experimentRuns);
      const totalCount = typeof experiment.total_count === "number"
        ? experiment.total_count
        : await getExperimentTotalCount(ctx, experiment._id);
      const latestRunState = latest
        ? await latestRunHasFailures(ctx, latest, links.length)
        : { hasFailures: false, completedCount: 0 };

      results.push({
        experiment_id: experiment._id,
        experiment_tag: experiment.experiment_tag,
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
            created_at: latest._creationTime,
            has_failures: latestRunState.hasFailures,
          }
          : undefined,
      });
    }

    return results;
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
        const [samples, scoreUnits] = await Promise.all([
          ctx.db
            .query("samples")
            .withIndex("by_run", (q) => q.eq("run_id", run._id))
            .collect(),
          ctx.db
            .query("sample_evidence_scores")
            .withIndex("by_run", (q) => q.eq("run_id", run._id))
            .collect(),
        ]);
        return { run, samples, scoreUnits };
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
      scores: runArtifacts.reduce((sum, artifact) => {
        return sum + sumSampleScoreCount(
          artifact.samples,
          artifact.scoreUnits,
          "score_count",
          "score_id",
        );
      }, 0),
      score_critics: runArtifacts.reduce((sum, artifact) => {
        return sum + sumSampleScoreCount(
          artifact.samples,
          artifact.scoreUnits,
          "score_critic_count",
          "score_critic_id",
        );
      }, 0),
    };

    const latest = latestRun(runs);
    const totalCount = typeof experiment.total_count === "number"
      ? experiment.total_count
      : await getExperimentTotalCount(ctx, experiment._id);
    const latestRunState = latest
      ? await latestRunHasFailures(ctx, latest, links.length)
      : { hasFailures: false, completedCount: 0 };

    return {
      experiment_id: experiment._id,
      experiment_tag: experiment.experiment_tag,
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
          created_at: latest._creationTime,
          has_failures: latestRunState.hasFailures,
        }
        : undefined,
      counts,
    };
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
    const completedCount = typeof run.completed_count === "number"
      ? run.completed_count
      : await getRunCompletedCount(ctx, run._id);
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
      target_count: run.target_count,
      completed_count: completedCount,
      has_failures: snapshot?.hasFailures ?? false,
      failed_stage_count,
      stages: stageResults,
    };
  },
});
