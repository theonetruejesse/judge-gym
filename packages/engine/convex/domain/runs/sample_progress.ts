import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

type SampleProgressCtx = QueryCtx | MutationCtx;
type SampleEvidenceScoreDoc = Doc<"sample_evidence_scores">;

export type SampleScoreCounts = {
  score_count: number;
  score_critic_count: number;
};

export function countSampleScoreCounts(
  scoreUnits: SampleEvidenceScoreDoc[],
): SampleScoreCounts {
  return {
    score_count: scoreUnits.filter((unit) => unit.score_id != null).length,
    score_critic_count: scoreUnits.filter((unit) => unit.score_critic_id != null).length,
  };
}

export async function getSampleScoreCounts(
  ctx: SampleProgressCtx,
  sampleId: Id<"samples">,
): Promise<SampleScoreCounts> {
  const scoreUnits = await ctx.db
    .query("sample_evidence_scores")
    .withIndex("by_sample", (q) => q.eq("sample_id", sampleId))
    .collect();

  if (scoreUnits.length > 0) {
    return countSampleScoreCounts(scoreUnits);
  }

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
