import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { type RunStage } from "../../models/experiments";
import { ENGINE_SETTINGS } from "../../settings";

type RunProgressCtx = QueryCtx | MutationCtx;
type SampleDoc = Doc<"samples">;
type SampleEvidenceScoreDoc = Doc<"sample_evidence_scores">;

type RequestState = "pending" | "none" | "retryable" | "exhausted";
type RequestStateIndex = {
  pendingKeys: Set<string>;
  maxAttemptsByKey: Map<string, number>;
};

type BlockResolution = "pending" | "failed";

export type RunStageProgress = {
  completed: number;
  failed: number;
  hasPending: boolean;
  total: number;
};

const SCORE_STAGES: RunStage[] = ["score_gen", "score_critic"];

function classifyRequestState(index: RequestStateIndex, customKey: string): RequestState {
  if (index.pendingKeys.has(customKey)) return "pending";
  const maxAttempts = index.maxAttemptsByKey.get(customKey);
  if (maxAttempts == null) return "none";
  if (maxAttempts >= ENGINE_SETTINGS.run_policy.max_request_attempts) {
    return "exhausted";
  }
  return "retryable";
}

async function buildRequestStateIndex(
  ctx: RunProgressCtx,
  customKeys: Set<string>,
  stage: RunStage,
): Promise<RequestStateIndex> {
  if (customKeys.size === 0) {
    return {
      pendingKeys: new Set(),
      maxAttemptsByKey: new Map(),
    };
  }

  const stageSuffix = `:${stage}`;
  const pendingRows = await ctx.db
    .query("llm_requests")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .collect();
  const errorRows = await ctx.db
    .query("llm_requests")
    .withIndex("by_status", (q) => q.eq("status", "error"))
    .collect();

  const pendingKeys = new Set<string>();
  const maxAttemptsByKey = new Map<string, number>();

  for (const row of pendingRows) {
    if (!row.custom_key.endsWith(stageSuffix)) continue;
    if (!customKeys.has(row.custom_key)) continue;
    pendingKeys.add(row.custom_key);
    const current = maxAttemptsByKey.get(row.custom_key) ?? 0;
    const attempts = row.attempts ?? 0;
    if (attempts > current) maxAttemptsByKey.set(row.custom_key, attempts);
  }

  for (const row of errorRows) {
    if (!row.custom_key.endsWith(stageSuffix)) continue;
    if (!customKeys.has(row.custom_key)) continue;
    const current = maxAttemptsByKey.get(row.custom_key) ?? 0;
    const attempts = row.attempts ?? 0;
    if (attempts > current) maxAttemptsByKey.set(row.custom_key, attempts);
  }

  return { pendingKeys, maxAttemptsByKey };
}

async function mapSamplesByRun(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
): Promise<Map<string, SampleDoc>> {
  const samples = await ctx.db
    .query("samples")
    .withIndex("by_run", (q) => q.eq("run_id", runId))
    .collect();
  return new Map(samples.map((sample) => [String(sample._id), sample]));
}

async function listScoreUnitsForRun(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
): Promise<SampleEvidenceScoreDoc[]> {
  return ctx.db
    .query("sample_evidence_scores")
    .withIndex("by_run", (q) => q.eq("run_id", runId))
    .collect();
}

function getSampleOutputId(sample: SampleDoc, stage: RunStage) {
  if (stage === "rubric_gen") return sample.rubric_id;
  if (stage === "rubric_critic") return sample.rubric_critic_id;
  if (stage === "score_gen") return sample.score_id;
  return sample.score_critic_id;
}

function makeRequestKeyForTarget(
  targetType: "sample" | "sample_evidence",
  targetId: string,
  stage: RunStage,
) {
  return `${targetType}:${targetId}:${stage}`;
}

function makeRequestKey(targetId: string, stage: RunStage): string {
  const prefix = SCORE_STAGES.includes(stage) ? "sample_evidence" : "sample";
  return makeRequestKeyForTarget(prefix, targetId, stage);
}

function resolveBlockedFromRequestState(
  index: RequestStateIndex,
  customKey: string,
): BlockResolution {
  return classifyRequestState(index, customKey) === "exhausted" ? "failed" : "pending";
}

async function getSampleStageProgress(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
  stage: RunStage,
): Promise<RunStageProgress | null> {
  const samples = await ctx.db
    .query("samples")
    .withIndex("by_run", (q) => q.eq("run_id", runId))
    .collect();

  if (samples.length === 0) return null;

  let completed = 0;
  let failed = 0;
  let hasPending = false;

  const currentStageKeys = new Set<string>();
  const rubricGenKeys = new Set<string>();

  for (const sample of samples) {
    const sampleId = String(sample._id);
    if (stage === "rubric_gen") {
      if (!sample.rubric_id) {
        currentStageKeys.add(makeRequestKeyForTarget("sample", sampleId, stage));
      }
      continue;
    }

    if (!sample.rubric_id) {
      rubricGenKeys.add(makeRequestKeyForTarget("sample", sampleId, "rubric_gen"));
      continue;
    }

    if (!getSampleOutputId(sample, stage)) {
      currentStageKeys.add(makeRequestKeyForTarget("sample", sampleId, stage));
    }
  }

  const currentStageIndex = await buildRequestStateIndex(ctx, currentStageKeys, stage);
  const rubricGenIndex = await buildRequestStateIndex(ctx, rubricGenKeys, "rubric_gen");

  for (const sample of samples) {
    const sampleId = String(sample._id);
    const outputId = getSampleOutputId(sample, stage);
    if (outputId) {
      completed += 1;
      continue;
    }

    if (stage !== "rubric_gen" && !sample.rubric_id) {
      const resolution = resolveBlockedFromRequestState(
        rubricGenIndex,
        makeRequestKeyForTarget("sample", sampleId, "rubric_gen"),
      );
      if (resolution === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    const customKey = makeRequestKeyForTarget("sample", sampleId, stage);
    const state = classifyRequestState(currentStageIndex, customKey);
    if (state === "exhausted") {
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

export async function getRunStageProgress(
  ctx: RunProgressCtx,
  runId: Id<"runs">,
  stage: RunStage,
): Promise<RunStageProgress | null> {
  if (!SCORE_STAGES.includes(stage)) {
    return getSampleStageProgress(ctx, runId, stage);
  }

  const scoreUnits = await listScoreUnitsForRun(ctx, runId);
  if (scoreUnits.length === 0) {
    return getSampleStageProgress(ctx, runId, stage);
  }

  const sampleById = await mapSamplesByRun(ctx, runId);
  let completed = 0;
  let failed = 0;
  let hasPending = false;

  const currentStageKeys = new Set<string>();
  const rubricGenKeys = new Set<string>();
  const scoreGenKeys = new Set<string>();

  for (const unit of scoreUnits) {
    const unitId = String(unit._id);
    const sample = sampleById.get(String(unit.sample_id));
    if (!sample) continue;

    if (stage === "score_gen") {
      if (!sample.rubric_id) {
        rubricGenKeys.add(makeRequestKeyForTarget("sample", String(sample._id), "rubric_gen"));
      } else if (!unit.score_id) {
        currentStageKeys.add(makeRequestKey(unitId, stage));
      }
      continue;
    }

    if (!sample.rubric_id) {
      rubricGenKeys.add(makeRequestKeyForTarget("sample", String(sample._id), "rubric_gen"));
      continue;
    }

    if (!unit.score_id) {
      scoreGenKeys.add(makeRequestKey(unitId, "score_gen"));
      continue;
    }

    if (!unit.score_critic_id) {
      currentStageKeys.add(makeRequestKey(unitId, stage));
    }
  }

  const currentStageIndex = await buildRequestStateIndex(ctx, currentStageKeys, stage);
  const rubricGenIndex = await buildRequestStateIndex(ctx, rubricGenKeys, "rubric_gen");
  const scoreGenIndex = await buildRequestStateIndex(ctx, scoreGenKeys, "score_gen");

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
      const resolution = resolveBlockedFromRequestState(
        rubricGenIndex,
        makeRequestKeyForTarget("sample", String(sample._id), "rubric_gen"),
      );
      if (resolution === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    if (stage === "score_critic" && !unit.score_id) {
      const resolution = resolveBlockedFromRequestState(
        scoreGenIndex,
        makeRequestKey(unitId, "score_gen"),
      );
      if (resolution === "failed") {
        failed += 1;
      } else {
        hasPending = true;
      }
      continue;
    }

    const customKey = makeRequestKey(unitId, stage);
    const state = classifyRequestState(currentStageIndex, customKey);
    if (state === "exhausted") {
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
