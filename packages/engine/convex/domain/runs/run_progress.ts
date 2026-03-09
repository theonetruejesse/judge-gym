import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { type RunStage } from "../../models/experiments";
import { ENGINE_SETTINGS } from "../../settings";

type RunProgressCtx = QueryCtx | MutationCtx;
type SampleDoc = Doc<"samples">;
type SampleEvidenceScoreDoc = Doc<"sample_evidence_scores">;
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
  if (state.has_pending) return "pending";
  if ((state.max_attempts ?? 0) >= ENGINE_SETTINGS.run_policy.max_request_attempts) {
    return "exhausted";
  }
  if ((state.max_attempts ?? 0) > 0) return "retryable";
  return "none";
}

function resolveBlockedFromTargetState(
  state: RequestTargetStateDoc | null | undefined,
): BlockResolution {
  return classifyTargetState(state) === "exhausted" ? "failed" : "pending";
}

function makeRequestKeyForTarget(
  targetType: "sample" | "sample_evidence",
  targetId: string,
  stage: RunStage,
) {
  return `${targetType}:${targetId}:${stage}`;
}

function buildTargetStateIndex(
  rows: RequestTargetStateDoc[],
): Record<RunStage, Map<string, RequestTargetStateDoc>> {
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

function getSampleOutputId(sample: SampleDoc, stage: RunStage) {
  if (stage === "rubric_gen") return sample.rubric_id;
  if (stage === "rubric_critic") return sample.rubric_critic_id;
  if (stage === "score_gen") return sample.score_id;
  return sample.score_critic_id;
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
    const sampleId = String(sample._id);
    const outputId = getSampleOutputId(sample, stage);
    if (outputId) {
      completed += 1;
      continue;
    }

    if (stage !== "rubric_gen" && !sample.rubric_id) {
      const blockedState = statesByStage.rubric_gen.get(
        makeRequestKeyForTarget("sample", sampleId, "rubric_gen"),
      );
      if (resolveBlockedFromTargetState(blockedState) === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    const currentState = statesByStage[stage].get(
      makeRequestKeyForTarget("sample", sampleId, stage),
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
    total: samples.length,
  };
}

function buildLegacyScoreStageProgress(
  samples: SampleDoc[],
  statesByStage: Record<RunStage, Map<string, RequestTargetStateDoc>>,
  stage: "score_gen" | "score_critic",
): RunStageProgress | null {
  if (samples.length === 0) return null;

  let completed = 0;
  let failed = 0;
  let hasPending = false;

  for (const sample of samples) {
    const sampleId = String(sample._id);
    const outputId = getSampleOutputId(sample, stage);
    if (outputId) {
      completed += 1;
      continue;
    }

    if (!sample.rubric_id) {
      const blockedState = statesByStage.rubric_gen.get(
        makeRequestKeyForTarget("sample", sampleId, "rubric_gen"),
      );
      if (resolveBlockedFromTargetState(blockedState) === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    const currentState = statesByStage[stage].get(
      makeRequestKeyForTarget("sample", sampleId, stage),
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
    total: samples.length,
  };
}

function buildScoreStageProgress(
  samples: SampleDoc[],
  scoreUnits: SampleEvidenceScoreDoc[],
  statesByStage: Record<RunStage, Map<string, RequestTargetStateDoc>>,
  stage: "score_gen" | "score_critic",
): RunStageProgress | null {
  if (scoreUnits.length === 0) {
    return buildLegacyScoreStageProgress(samples, statesByStage, stage);
  }

  const sampleById = new Map(samples.map((sample) => [String(sample._id), sample]));
  let completed = 0;
  let failed = 0;
  let hasPending = false;

  for (const unit of scoreUnits) {
    const unitId = String(unit._id);
    const sample = sampleById.get(String(unit.sample_id));
    if (!sample) {
      failed += 1;
      continue;
    }

    const outputId = stage === "score_gen" ? unit.score_id : unit.score_critic_id;
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

    if (stage === "score_critic" && !unit.score_id) {
      const blockedState = statesByStage.score_gen.get(
        makeRequestKeyForTarget("sample_evidence", unitId, "score_gen"),
      );
      if (resolveBlockedFromTargetState(blockedState) === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    const currentState = statesByStage[stage].get(
      makeRequestKeyForTarget("sample_evidence", unitId, stage),
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
    total: scoreUnits.length,
  };
}

export async function getRunProgressSnapshot(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
): Promise<RunProgressSnapshot | null> {
  const [samples, scoreUnits, targetStates] = await Promise.all([
    ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect(),
    ctx.db
      .query("sample_evidence_scores")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect(),
    ctx.db
      .query("process_request_targets")
      .withIndex("by_process", (q) =>
        q.eq("process_type", "run").eq("process_id", runId),
      )
      .collect(),
  ]);

  if (samples.length === 0) return null;

  const statesByStage = buildTargetStateIndex(targetStates);
  const rubricGen = buildSampleStageProgress(samples, statesByStage, "rubric_gen");
  const rubricCritic = buildSampleStageProgress(samples, statesByStage, "rubric_critic");
  const scoreGen = buildScoreStageProgress(samples, scoreUnits, statesByStage, "score_gen");
  const scoreCritic = buildScoreStageProgress(samples, scoreUnits, statesByStage, "score_critic");

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
