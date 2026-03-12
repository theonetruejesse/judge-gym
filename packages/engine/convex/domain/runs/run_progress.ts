import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { type RunStage } from "../../models/experiments";

type RunProgressCtx = QueryCtx | MutationCtx;
type SampleDoc = Doc<"samples">;
type SampleScoreTargetDoc = Doc<"sample_score_targets">;
type RequestTargetStateDoc = Doc<"process_request_targets">;

type RequestState = "pending" | "none" | "retryable" | "exhausted";
type BlockResolution = "pending" | "failed";

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

export function countCompletedSamples(
  samples: SampleDoc[],
  scoreTargets: SampleScoreTargetDoc[],
): number {
  if (samples.length === 0) return 0;

  if (scoreTargets.length === 0) {
    return samples.filter((sample) => (sample.score_critic_count ?? 0) > 0).length;
  }

  const targetsBySampleId = new Map<string, SampleScoreTargetDoc[]>();
  for (const target of scoreTargets) {
    const sampleId = String(target.sample_id);
    const current = targetsBySampleId.get(sampleId) ?? [];
    current.push(target);
    targetsBySampleId.set(sampleId, current);
  }

  let completed = 0;
  for (const sample of samples) {
    const sampleTargets = targetsBySampleId.get(String(sample._id)) ?? [];
    if (sampleTargets.length === 0) continue;
    if (sampleTargets.every((target) => target.score_critic_id != null)) {
      completed += 1;
    }
  }

  return completed;
}

const RUN_STAGES: RunStage[] = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
];

const SCORE_STAGES: RunStage[] = ["score_gen", "score_critic"];

function classifyTargetState(
  state: RequestTargetStateDoc | null | undefined,
): RequestState {
  if (!state) return "none";
  if (state.resolution === "pending") return "pending";
  if (state.resolution === "exhausted") return "exhausted";
  if (state.resolution === "retryable") return "retryable";
  return "none";
}

function resolveBlockedFromTargetState(
  state: RequestTargetStateDoc | null | undefined,
): BlockResolution {
  return classifyTargetState(state) === "exhausted" ? "failed" : "pending";
}

function makeRequestKeyForTarget(
  targetType: "sample" | "sample_score_target",
  targetId: string,
  stage: RunStage,
) {
  return `${targetType}:${targetId}:${stage}`;
}

function buildTargetStateIndex(rows: RequestTargetStateDoc[]) {
  const index: Record<RunStage, Map<string, RequestTargetStateDoc>> = {
    rubric_gen: new Map(),
    rubric_critic: new Map(),
    score_gen: new Map(),
    score_critic: new Map(),
  };

  for (const row of rows) {
    if (!RUN_STAGES.includes(row.stage as RunStage)) continue;
    index[row.stage as RunStage].set(row.custom_key, row);
  }

  return index;
}

function buildSampleStageProgress(
  samples: SampleDoc[],
  statesByStage: Record<RunStage, Map<string, RequestTargetStateDoc>>,
  stage: Exclude<RunStage, "score_gen" | "score_critic">,
): RunStageProgress | null {
  if (samples.length === 0) return null;

  let completed = 0;
  let failed = 0;
  let hasPending = false;

  for (const sample of samples) {
    const outputId = stage === "rubric_gen" ? sample.rubric_id : sample.rubric_critic_id;
    if (outputId) {
      completed += 1;
      continue;
    }

    if (stage !== "rubric_gen" && !sample.rubric_id) {
      const blockedState = statesByStage.rubric_gen.get(
        makeRequestKeyForTarget("sample", String(sample._id), "rubric_gen"),
      );
      if (resolveBlockedFromTargetState(blockedState) === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    const currentState = statesByStage[stage].get(
      makeRequestKeyForTarget("sample", String(sample._id), stage),
    );
    if (classifyTargetState(currentState) === "exhausted") {
      failed += 1;
    } else {
      hasPending = true;
    }
  }

  return { completed, failed, hasPending, total: samples.length };
}

function buildScoreStageProgress(
  samples: SampleDoc[],
  scoreTargets: SampleScoreTargetDoc[],
  statesByStage: Record<RunStage, Map<string, RequestTargetStateDoc>>,
  stage: "score_gen" | "score_critic",
): RunStageProgress | null {
  if (scoreTargets.length === 0) return null;

  const sampleById = new Map(samples.map((sample) => [String(sample._id), sample]));
  let completed = 0;
  let failed = 0;
  let hasPending = false;

  for (const target of scoreTargets) {
    const sample = sampleById.get(String(target.sample_id));
    if (!sample) {
      failed += 1;
      continue;
    }

    const outputId = stage === "score_gen" ? target.score_id : target.score_critic_id;
    if (outputId) {
      completed += 1;
      continue;
    }

    if (!sample.rubric_id) {
      const blockedState = statesByStage.rubric_gen.get(
        makeRequestKeyForTarget("sample", String(sample._id), "rubric_gen"),
      );
      if (resolveBlockedFromTargetState(blockedState) === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    if (stage === "score_critic" && !target.score_id) {
      const blockedState = statesByStage.score_gen.get(
        makeRequestKeyForTarget("sample_score_target", String(target._id), "score_gen"),
      );
      if (resolveBlockedFromTargetState(blockedState) === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    const currentState = statesByStage[stage].get(
      makeRequestKeyForTarget("sample_score_target", String(target._id), stage),
    );
    if (classifyTargetState(currentState) === "exhausted") {
      failed += 1;
    } else {
      hasPending = true;
    }
  }

  return {
    completed,
    failed,
    hasPending,
    total: scoreTargets.length,
  };
}

export async function getRunProgressSnapshot(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
): Promise<RunProgressSnapshot | null> {
  const [samples, scoreTargets, targetStates] = await Promise.all([
    ctx.db.query("samples").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
    ctx.db.query("sample_score_targets").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
    ctx.db.query("process_request_targets").withIndex("by_process", (q) =>
      q.eq("process_type", "run").eq("process_id", runId),
    ).collect(),
  ]);

  if (samples.length === 0) return null;

  const statesByStage = buildTargetStateIndex(targetStates);
  const rubricGen = buildSampleStageProgress(samples, statesByStage, "rubric_gen");
  const rubricCritic = buildSampleStageProgress(samples, statesByStage, "rubric_critic");
  const scoreGen = buildScoreStageProgress(samples, scoreTargets, statesByStage, "score_gen");
  const scoreCritic = buildScoreStageProgress(samples, scoreTargets, statesByStage, "score_critic");

  const byStage = {
    rubric_gen: rubricGen ?? { completed: 0, failed: 0, hasPending: false, total: 0 },
    rubric_critic: rubricCritic ?? { completed: 0, failed: 0, hasPending: false, total: 0 },
    score_gen: scoreGen ?? { completed: 0, failed: 0, hasPending: false, total: 0 },
    score_critic: scoreCritic ?? { completed: 0, failed: 0, hasPending: false, total: 0 },
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
  const [samples, scoreTargets] = await Promise.all([
    ctx.db.query("samples").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
    ctx.db.query("sample_score_targets").withIndex("by_run", (q) => q.eq("run_id", runId)).collect(),
  ]);

  return countCompletedSamples(samples, scoreTargets);
}

export async function getRunStageProgress(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
  stage: RunStage,
): Promise<RunStageProgress | null> {
  const snapshot = await getRunProgressSnapshot(ctx, runId);
  if (!snapshot) return null;
  return snapshot.byStage[stage];
}

export function stageIsScoreStage(stage: RunStage) {
  return SCORE_STAGES.includes(stage);
}
