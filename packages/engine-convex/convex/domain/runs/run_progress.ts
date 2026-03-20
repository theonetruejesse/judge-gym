import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { type RunStage } from "../../models/experiments";
import { buildScoreArtifactIndex } from "./sample_progress";
import { countCompletedSamples } from "./sample_progress";

type RunProgressCtx = QueryCtx | MutationCtx;

export type RunStageProgress = {
  completed: number;
  failed: number;
  hasPending: boolean;
  total: number;
};

export type RunProgressSnapshot = {
  byStage: Record<RunStage, RunStageProgress>;
  hasFailures: boolean;
  failedStageCount: number;
};

const RUN_STAGES: RunStage[] = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
];

export async function getRunProgressSnapshot(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
): Promise<RunProgressSnapshot | null> {
  const [samples, scoreTargets] = await Promise.all([
    ctx.db.query("samples").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
    ctx.db.query("sample_score_targets").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
  ]);

  if (samples.length === 0) return null;

  const byStage = {
    rubric_gen: {
      total: samples.length,
      completed: samples.filter((sample) => sample.rubric_id != null).length,
      failed: samples.filter((sample) =>
        sample.rubric_id == null && sample.rubric_gen_error_message != null
      ).length,
      hasPending: samples.some((sample) =>
        sample.rubric_id == null && sample.rubric_gen_error_message == null
      ),
    },
    rubric_critic: {
      total: samples.length,
      completed: samples.filter((sample) => sample.rubric_critic_id != null).length,
      failed: samples.filter((sample) =>
        sample.rubric_critic_id == null && sample.rubric_critic_error_message != null
      ).length,
      hasPending: samples.some((sample) =>
        sample.rubric_critic_id == null && sample.rubric_critic_error_message == null
      ),
    },
    score_gen: {
      total: scoreTargets.length,
      completed: scoreTargets.filter((target) => target.score_id != null).length,
      failed: scoreTargets.filter((target) =>
        target.score_id == null && target.score_gen_error_message != null
      ).length,
      hasPending: scoreTargets.some((target) =>
        target.score_id == null && target.score_gen_error_message == null
      ),
    },
    score_critic: {
      total: scoreTargets.length,
      completed: scoreTargets.filter((target) => target.score_critic_id != null).length,
      failed: scoreTargets.filter((target) =>
        target.score_critic_id == null && target.score_critic_error_message != null
      ).length,
      hasPending: scoreTargets.some((target) =>
        target.score_critic_id == null && target.score_critic_error_message == null
      ),
    },
  } satisfies Record<RunStage, RunStageProgress>;

  const failedStageCount = RUN_STAGES.filter((stage) => byStage[stage].failed > 0).length;
  return {
    byStage,
    hasFailures: failedStageCount > 0,
    failedStageCount,
  };
}

export async function getRunCompletedCount(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
): Promise<number> {
  const [samples, scoreTargets, scores, scoreCritics] = await Promise.all([
    ctx.db.query("samples").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
    ctx.db.query("sample_score_targets").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
    ctx.db.query("scores").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
    ctx.db.query("score_critics").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
  ]);

  return countCompletedSamples(
    samples,
    scoreTargets,
    buildScoreArtifactIndex(scores, scoreCritics),
  );
}

export async function getRunStageProgress(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
  stage: RunStage,
): Promise<RunStageProgress | null> {
  const snapshot = await getRunProgressSnapshot(ctx, runId);
  return snapshot?.byStage[stage] ?? null;
}

export function stageIsScoreStage(stage: RunStage) {
  return stage === "score_gen" || stage === "score_critic";
}
