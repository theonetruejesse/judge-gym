import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

type SampleProgressCtx = QueryCtx | MutationCtx;
type SampleScoreTargetDoc = Doc<"sample_score_targets">;
type ScoreDoc = Doc<"scores">;
type ScoreCriticDoc = Doc<"score_critics">;

export type SampleScoreCounts = {
  score_count: number;
  score_critic_count: number;
};

export type ScoreArtifactIndex = {
  scoreTargetIdsWithScore: Set<string>;
  scoreTargetIdsWithScoreCritic: Set<string>;
};

export function buildScoreArtifactIndex(
  scores: ScoreDoc[],
  scoreCritics: ScoreCriticDoc[],
): ScoreArtifactIndex {
  return {
    scoreTargetIdsWithScore: new Set(scores.map((score) => String(score.score_target_id))),
    scoreTargetIdsWithScoreCritic: new Set(
      scoreCritics.map((critic) => String(critic.score_target_id)),
    ),
  };
}

export function countSampleScoreCounts(
  scoreTargets: SampleScoreTargetDoc[],
  artifactIndex?: ScoreArtifactIndex,
): SampleScoreCounts {
  if (artifactIndex) {
    return {
      score_count: scoreTargets.filter((target) =>
        artifactIndex.scoreTargetIdsWithScore.has(String(target._id))
      ).length,
      score_critic_count: scoreTargets.filter((target) =>
        artifactIndex.scoreTargetIdsWithScoreCritic.has(String(target._id))
      ).length,
    };
  }

  return {
    score_count: scoreTargets.filter((target) => target.score_id != null).length,
    score_critic_count: scoreTargets.filter((target) => target.score_critic_id != null).length,
  };
}

export async function getSampleScoreCounts(
  ctx: SampleProgressCtx,
  sampleId: Id<"samples">,
): Promise<SampleScoreCounts> {
  const [scores, scoreCritics] = await Promise.all([
    ctx.db
      .query("scores")
      .withIndex("by_sample", (q) => q.eq("sample_id", sampleId))
      .collect(),
    ctx.db
      .query("score_critics")
      .withIndex("by_sample", (q) => q.eq("sample_id", sampleId))
      .collect(),
  ]);

  return {
    score_count: scores.length,
    score_critic_count: scoreCritics.length,
  };
}

export async function syncSampleScoreCounts(
  ctx: MutationCtx,
  sampleId: Id<"samples">,
) {
  const sample = await ctx.db.get(sampleId);
  if (!sample) return null;

  const counts = await getSampleScoreCounts(ctx, sampleId);
  await ctx.db.patch(sampleId, counts);
  return counts;
}

export async function incrementSampleScoreCounter(
  ctx: MutationCtx,
  sampleId: Id<"samples">,
  field: "score_count" | "score_critic_count",
) {
  const sample = await ctx.db.get(sampleId);
  if (!sample) return null;

  const nextValue = (sample[field] ?? 0) + 1;
  await ctx.db.patch(sampleId, {
    [field]: nextValue,
  });

  return {
    ...sample,
    [field]: nextValue,
  } as Doc<"samples">;
}
