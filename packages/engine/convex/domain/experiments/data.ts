import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zQuery } from "../../platform/utils";

// --- Read queries for analysis consumption ---

export const getExperimentSummary = zQuery({
  args: z.object({ experiment_tag: z.string() }),
  handler: async (ctx, { experiment_tag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment)
      throw new Error(`Experiment not found: ${experiment_tag}`);
    const window = await ctx.db.get(experiment.window_id);
    if (!window) throw new Error("Window not found");

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
      experiment_tag: experiment.experiment_tag,
      window_id: experiment.window_id,
      rubric_model_id: experiment.config.rubric_stage.model_id,
      scoring_model_id: experiment.config.scoring_stage.model_id,
      concept: window.concept,
      task_type: experiment.task_type,
      status: experiment.status,
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

    const runConfig = run.run_config_id
      ? await ctx.db.get(run.run_config_id)
      : null;

    const window = await ctx.db.get(experiment.window_id);
    if (!window) throw new Error("Window not found");

    const stages = await ctx.db
      .query("run_stages")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();

    const critics = scores.filter((s) => s.score_critic_output !== undefined);

    return {
      run_id: run._id,
      experiment_tag: experiment.experiment_tag,
      rubric_model_id:
        runConfig?.config_body.experiment.config.rubric_stage.model_id ??
        experiment.config.rubric_stage.model_id,
      scoring_model_id:
        runConfig?.config_body.experiment.config.scoring_stage.model_id ??
        experiment.config.scoring_stage.model_id,
      concept: window.concept,
      task_type: experiment.task_type,
      status: run.status,
      desired_state: run.desired_state,
      current_stage: run.current_stage,
      stop_at_stage: run.stop_at_stage,
      config: runConfig?.config_body.experiment.config ?? experiment.config,
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
//   - experiment: tag, rubric/scoring models, concept, config, status
//   - evidence:   id + title for each evidence article
//   - scores:     flat rows (score fields + sample display fields)
// ---------------------------------------------------------------------------

export const exportExperimentBundle = zQuery({
  args: z.object({ experiment_tag: z.string() }),
  handler: async (ctx, { experiment_tag }) => {
    // --- Experiment + window ---
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment)
      throw new Error(`Experiment not found: ${experiment_tag}`);
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
        experiment_tag: experiment.experiment_tag,
        rubric_model_id: experiment.config.rubric_stage.model_id,
        scoring_model_id: experiment.config.scoring_stage.model_id,
        concept: window.concept,
        task_type: experiment.task_type,
        status: experiment.status,
        config: experiment.config,
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
