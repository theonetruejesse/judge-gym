import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zQuery } from "../../platform/utils";

// --- Read queries for analysis consumption ---

const EVIDENCE_STATUSES = [
  "scraping",
  "cleaning",
  "neutralizing",
  "abstracting",
  "ready",
] as const;
type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const getExperimentSummary = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");
    const window = await ctx.db.get(experiment.window_id);
    if (!window) throw new Error("Window not found");

    const runs = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();
    const status = deriveExperimentStatus(runs);

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();

    const experimentCritics = scores.filter(
      (s) => s.score_critic_output !== undefined,
    );

    return {
      experiment_id: experiment._id,
      experiment_tag: experiment.experiment_tag,
      window_id: experiment.window_id,
      rubric_model_id: experiment.config.rubric_stage.model_id,
      scoring_model_id: experiment.config.scoring_stage.model_id,
      concept: window.concept,
      task_type: experiment.task_type,
      status,
      config: experiment.config,
      counts: {
        samples: samples.length,
        scores: scores.length,
        abstained: scores.filter((s) => s.abstained).length,
        critics: experimentCritics.length,
      },
    };
  },
});

function deriveExperimentStatus(
  runs: Array<{ status: string }>,
): "pending" | "running" | "paused" | "complete" | "canceled" {
  if (runs.length === 0) return "pending";
  const statuses = runs.map((run) => run.status);
  if (statuses.some((status) => status === "running")) return "running";
  if (statuses.some((status) => status === "paused")) return "paused";
  if (statuses.every((status) => status === "complete")) return "complete";
  if (statuses.some((status) => status === "canceled")) return "canceled";
  return "pending";
}

export const listEvidenceWindows = zQuery({
  args: z.object({}),
  handler: async (ctx) => {
    const windows = await ctx.db.query("windows").collect();
    const evidences = await ctx.db.query("evidences").collect();
    const counts = new Map<
      string,
      { total: number; cleaned: number; neutralized: number; abstracted: number }
    >();
    for (const evidence of evidences) {
      const key = String(evidence.window_id);
      const entry = counts.get(key) ?? {
        total: 0,
        cleaned: 0,
        neutralized: 0,
        abstracted: 0,
      };
      entry.total += 1;
      if ((evidence.cleaned_content ?? "").trim().length > 0) {
        entry.cleaned += 1;
      }
      if ((evidence.neutralized_content ?? "").trim().length > 0) {
        entry.neutralized += 1;
      }
      if ((evidence.abstracted_content ?? "").trim().length > 0) {
        entry.abstracted += 1;
      }
      counts.set(key, entry);
    }
    const evidenceStatusFor = (
      entry?: { total: number; cleaned: number; neutralized: number; abstracted: number },
    ): EvidenceStatus => {
      if (!entry || entry.total === 0) return "scraping";
      if (entry.cleaned < entry.total) return "cleaning";
      if (entry.neutralized < entry.total) return "neutralizing";
      if (entry.abstracted < entry.total) return "abstracting";
      return "ready";
    };

    return windows.map((window) => ({
      window_id: window._id,
      start_date: window.start_date,
      end_date: window.end_date,
      country: window.country,
      concept: window.concept,
      model_id: window.model_id,
      window_tag: window.window_tag,
      evidence_count: counts.get(String(window._id))?.total ?? 0,
      evidence_status: evidenceStatusFor(counts.get(String(window._id))),
    }));
  },
});

export const listExperimentEvidence = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    const items = await ctx.db
      .query("experiment_evidence")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment_id))
      .collect();
    const ordered = items.slice().sort((a, b) => a.position - b.position);
    const results = [];
    for (const item of ordered) {
      const evidence = await ctx.db.get(item.evidence_id);
      if (!evidence) continue;
      results.push({
        evidence_id: evidence._id,
        position: item.position,
        title: evidence.title,
        url: evidence.url,
      });
    }
    return results;
  },
});

// Kept for internal engine use (e.g. tracker.ts).

export const listExperimentsByTaskType = zQuery({
  args: z.object({ task_type: z.string() }),
  handler: async (ctx, { task_type }) => {
    return ctx.db
      .query("experiments")
      .withIndex("by_task_type", (q) =>
        q.eq("task_type", task_type as "ecc" | "control" | "benchmark"),
      )
      .collect();
  },
});

export const getRunSummary = zQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, { run_id }) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("Run not found");

    const experiment = await ctx.db.get(run.experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const window = await ctx.db.get(experiment.window_id);
    if (!window) throw new Error("Window not found");

    const stages = await ctx.db
      .query("run_stages")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", run._id))
      .collect();

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_run", (q) => q.eq("run_id", run._id))
      .collect();

    const critics = scores.filter((s) => s.score_critic_output !== undefined);

    return {
      run_id: run._id,
      experiment_id: experiment._id,
      experiment_tag: experiment.experiment_tag,
      rubric_model_id: experiment.config.rubric_stage.model_id,
      scoring_model_id: experiment.config.scoring_stage.model_id,
      concept: window.concept,
      task_type: experiment.task_type,
      status: run.status,
      desired_state: run.desired_state,
      current_stage: run.current_stage,
      stop_at_stage: run.stop_at_stage,
      config: experiment.config,
      run_counts: run.run_counts,
      counts: {
        samples: samples.length,
        scores: scores.length,
        abstained: scores.filter((s) => s.abstained).length,
        critics: critics.length,
      },
      stages: stages.map((stage) => ({
        stage: stage.stage,
        status: stage.status,
        total_requests: stage.total_requests,
        completed_requests: stage.completed_requests,
        failed_requests: stage.failed_requests,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Bulk export consumed by the Python analysis package (judge_gym.collect).
//
// One HTTP call per experiment — returns everything needed to build DataFrames:
//   - experiment: id, tag, rubric/scoring models, concept, config, status
//   - evidence:   id + title for each evidence article
//   - scores:     flat rows (score fields + sample display fields)
// ---------------------------------------------------------------------------

export const exportExperimentBundle = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    // --- Experiment + window ---
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");
    const window = await ctx.db.get(experiment.window_id);
    if (!window) throw new Error("Window not found");

    // --- Samples (for display_seed / label_mapping) ---
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) =>
        q.eq("experiment_id", experiment._id),
      )
      .collect();
    const sampleById = new Map(samples.map((s) => [s._id, s]));

    // --- Scores ---
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) =>
        q.eq("experiment_id", experiment._id),
      )
      .collect();

    const rubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q.eq("experiment_id", experiment._id),
      )
      .collect();

    // --- Evidence (unique IDs from scores → fetch titles) ---
    const evidenceIds = [...new Set(scores.map((s) => s.evidence_id))];
    const evidences = await Promise.all(
      evidenceIds.map(async (eid) => {
        const doc = await ctx.db.get(eid);
        return {
          evidence_id: eid,
          title: doc?.title ?? eid,
          url: doc?.url ?? "",
        };
      }),
    );

    // --- Flat score rows (analysis-ready) ---
    const scoreRows = scores.map((score) => {
      const sample = sampleById.get(score.sample_id);
      return {
        evidence_id: score.evidence_id,
        rubric_id: score.rubric_id,
        sample_id: score.sample_id,
        abstained: score.abstained,
        decoded_scores: score.decoded_scores,
        expert_agreement_prob: score.expert_agreement_prob,
        raw_verdict: score.raw_verdict,
        display_seed: sample?.display_seed,
        label_mapping: sample?.label_mapping,
      };
    });

    return {
      experiment: {
        experiment_id: experiment._id,
        experiment_tag: experiment.experiment_tag,
        rubric_model_id: experiment.config.rubric_stage.model_id,
        scoring_model_id: experiment.config.scoring_stage.model_id,
        concept: window.concept,
        task_type: experiment.task_type,
        status: experiment.status,
        config: experiment.config,
        window_id: window._id,
        window_tag: window.window_tag,
      },
      evidences,
      rubrics: rubrics.map((rubric) => ({
        rubric_id: rubric._id,
        model_id: rubric.model_id,
        concept: rubric.concept,
        scale_size: rubric.scale_size,
        stages: rubric.stages,
        quality_stats: rubric.quality_stats,
      })),
      scores: scoreRows,
    };
  },
});
