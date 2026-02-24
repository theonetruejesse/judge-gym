import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalQuery } from "../../utils/custom_fns";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { RunStageSchema } from "../../models/experiments";
import { StateStatusSchema } from "../../models/_shared";

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

async function listEvidenceLinks(
  ctx: QueryCtx,
  experimentId: Id<"experiments">,
) {
  return ctx.db
    .query("experiment_evidence")
    .withIndex("by_experiment", (q) => q.eq("experiment_id", experimentId))
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

    const counts = {
      samples: samples.length,
      rubrics: samples.filter((s) => s.rubric_id != null).length,
      rubric_critics: samples.filter((s) => s.rubric_critic_id != null).length,
      scores: samples.filter((s) => s.score_id != null).length,
      score_critics: samples.filter((s) => s.score_critic_id != null).length,
    };

    const latest = latestRun(runs);

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
      window_tag?: string;
    }> = [];

    const windowCache = new Map<Id<"windows">, Doc<"windows">>();

    for (const link of links) {
      const evidence = await ctx.db.get(link.evidence_id);
      if (!evidence) continue;
      let window = windowCache.get(evidence.window_id);
      if (!window) {
        const fetched = await ctx.db.get(evidence.window_id);
        if (fetched) {
          window = fetched;
          windowCache.set(evidence.window_id, fetched);
        }
      }

      evidenceRows.push({
        evidence_id: evidence._id,
        window_id: evidence.window_id,
        title: evidence.title,
        url: evidence.url,
        created_at: evidence._creationTime,
        window_tag: window?.window_tag,
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

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", run._id))
      .collect();

    const stages = RunStageSchema.options.map((stage) => {
      let completed = 0;
      for (const sample of samples) {
        if (stage === "rubric_gen" && sample.rubric_id) completed += 1;
        if (stage === "rubric_critic" && sample.rubric_critic_id)
          completed += 1;
        if (stage === "score_gen" && sample.score_id) completed += 1;
        if (stage === "score_critic" && sample.score_critic_id) completed += 1;
      }
      const total = run.target_count;
      const status =
        completed === 0
          ? "queued"
          : completed >= total
            ? "completed"
            : "running";
      return {
        stage,
        status,
        total,
        completed,
        failed: 0,
      };
    });

    return {
      run_id: run._id,
      status: run.status,
      current_stage: run.current_stage,
      target_count: run.target_count,
      stages,
    };
  },
});
