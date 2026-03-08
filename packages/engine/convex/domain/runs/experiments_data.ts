import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalQuery } from "../../utils/custom_fns";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { RunStageSchema } from "../../models/experiments";
import { StateStatusSchema } from "../../models/_shared";
import { getRunStageProgress } from "./run_progress";

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

async function latestRunHasFailures(
  ctx: QueryCtx,
  runId: Id<"runs">,
): Promise<boolean> {
  const progresses = await Promise.all(
    RunStageSchema.options.map((stage) => getRunStageProgress(ctx, runId, stage)),
  );
  return progresses.some((progress) => (progress?.failed ?? 0) > 0);
}

async function listEvidenceLinks(
  ctx: QueryCtx,
  experimentId: Id<"experiments">,
) {
  const experiment = await ctx.db.get(experimentId);
  if (!experiment) throw new Error("Experiment not found");
  return ctx.db
    .query("pool_evidence")
    .withIndex("by_pool", (q) => q.eq("pool_id", experiment.pool_id))
    .collect();
}

export const listExperiments = zInternalQuery({
  args: z.object({}),
  handler: async (ctx) => {
    const experiments = await ctx.db.query("experiments").collect();
    experiments.sort((a, b) => a.experiment_tag.localeCompare(b.experiment_tag));

    const evidenceCache = new Map<Id<"evidences">, Doc<"evidences">>();
    const results = [] as Array<{
      experiment_id: Id<"experiments">;
      experiment_tag: string;
      rubric_config: Doc<"experiments">["rubric_config"];
      scoring_config: Doc<"experiments">["scoring_config"];
      evidence_selected_count: number;
      window_count: number;
      status: z.infer<typeof StateStatusSchema>;
      latest_run?: {
        run_id: Id<"runs">;
        status: string;
        current_stage: z.infer<typeof RunStageSchema>;
        target_count: number;
        created_at: number;
        has_failures: boolean;
      };
    }>;

    for (const experiment of experiments) {
      const runs = await ctx.db
        .query("runs")
        .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
        .collect();

      const links = await listEvidenceLinks(ctx, experiment._id);
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

      const latest = latestRun(runs);
      const latestHasFailures = latest ? await latestRunHasFailures(ctx, latest._id) : false;

      results.push({
        experiment_id: experiment._id,
        experiment_tag: experiment.experiment_tag,
        rubric_config: experiment.rubric_config,
        scoring_config: experiment.scoring_config,
        evidence_selected_count: links.length,
        window_count: windowIds.size,
        status: deriveExperimentStatus(runs),
        latest_run: latest
          ? {
              run_id: latest._id,
              status: latest.status,
              current_stage: latest.current_stage,
              target_count: latest.target_count,
              created_at: latest._creationTime,
              has_failures: latestHasFailures,
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

    const links = await listEvidenceLinks(ctx, experiment._id);
    const evidenceCache = new Map<Id<"evidences">, Doc<"evidences">>();
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

    const samples: Doc<"samples">[] = [];
    for (const run of runs) {
      const runSamples = await ctx.db
        .query("samples")
        .withIndex("by_run", (q) => q.eq("run_id", run._id))
        .collect();
      samples.push(...runSamples);
    }
    const runIdSet = new Set(runs.map((run) => String(run._id)));
    const scoreUnits = (await ctx.db.query("sample_evidence_scores").collect()).filter(
      (unit) => runIdSet.has(String(unit.run_id)),
    );
    const useScoreUnits = scoreUnits.length > 0;

    const counts = {
      samples: samples.length,
      rubrics: samples.filter((s) => s.rubric_id != null).length,
      rubric_critics: samples.filter((s) => s.rubric_critic_id != null).length,
      scores: useScoreUnits
        ? scoreUnits.filter((unit) => unit.score_id != null).length
        : samples.filter((s) => s.score_id != null).length,
      score_critics: useScoreUnits
        ? scoreUnits.filter((unit) => unit.score_critic_id != null).length
        : samples.filter((s) => s.score_critic_id != null).length,
    };

    const latest = latestRun(runs);
    const latestHasFailures = latest ? await latestRunHasFailures(ctx, latest._id) : false;

    return {
      experiment_id: experiment._id,
      experiment_tag: experiment.experiment_tag,
      rubric_config: experiment.rubric_config,
      scoring_config: experiment.scoring_config,
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
            created_at: latest._creationTime,
            has_failures: latestHasFailures,
          }
        : undefined,
      counts,
    };
  },
});

export const listExperimentEvidence = zInternalQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    const links = await listEvidenceLinks(ctx, experiment_id);
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

    const stageResults = await Promise.all(
      RunStageSchema.options.map(async (stage) => {
        const progress = await getRunStageProgress(ctx, run._id, stage);
        if (!progress) {
          return {
            stage,
            status: "queued",
            total: run.target_count,
            completed: 0,
            failed: 0,
          };
        }
        const status = progress.hasPending ? "running" : "completed";
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
          status,
          total: progress.total,
          completed: progress.completed,
          failed: progress.failed,
        };
      }),
    );

    const failed_stage_count = stageResults.filter((stage) => stage.failed > 0).length;

    return {
      run_id: run._id,
      status: run.status,
      current_stage: run.current_stage,
      target_count: run.target_count,
      has_failures: failed_stage_count > 0,
      failed_stage_count,
      stages: stageResults,
    };
  },
});
