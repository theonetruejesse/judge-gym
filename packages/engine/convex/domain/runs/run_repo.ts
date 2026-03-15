import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { RunsTableSchema } from "../../models/experiments";
import type { Doc, Id } from "../../_generated/dataModel";
import { generateSeeds, shuffleWithSeed } from "../../utils/randomize";
import {
  normalizeExperimentConfig,
  resolveEvidenceStrategy,
  type ExperimentConfig,
} from "./run_strategies";

const CreateRunArgsSchema = z.object({
  experiment_id: RunsTableSchema.shape.experiment_id,
  target_count: RunsTableSchema.shape.target_count,
  pause_after: RunsTableSchema.shape.pause_after.optional(),
});

type EvidenceDoc = Doc<"evidences">;
const MAX_SCORE_TARGET_ESTIMATED_INPUT_TOKENS = 20_000;

function estimateEvidenceTokens(text: string | null | undefined) {
  return Math.ceil((text ?? "").length / 4);
}

function getEvidenceContentForConfig(
  evidence: EvidenceDoc,
  config: ExperimentConfig,
) {
  const evidenceStrategy = resolveEvidenceStrategy(config);
  return evidence[evidenceStrategy.contentField] ?? evidence.l0_raw_content;
}

function buildBundleSequenceForSample(
  evidences: EvidenceDoc[],
  seed: number,
) {
  const shuffledAll = shuffleWithSeed(evidences, seed);
  const byWindow = new Map<string, EvidenceDoc[]>();
  for (const evidence of shuffledAll) {
    const key = String(evidence.window_id);
    const current = byWindow.get(key) ?? [];
    current.push(evidence);
    byWindow.set(key, current);
  }

  const orderedWindowIds = shuffleWithSeed(Array.from(byWindow.keys()), seed ^ 0x9e3779b9);
  const sequence: EvidenceDoc[] = [];
  let appended = true;
  while (appended) {
    appended = false;
    for (const windowId of orderedWindowIds) {
      const candidates = byWindow.get(windowId) ?? [];
      const next = candidates.shift();
      if (!next) continue;
      sequence.push(next);
      appended = true;
    }
  }

  return sequence;
}

function buildBundlesForSample(
  evidences: EvidenceDoc[],
  config: ExperimentConfig,
  seed: number,
) {
  const sequence = buildBundleSequenceForSample(evidences, seed);
  const bundleSize = Math.max(1, config.scoring_config.evidence_bundle_size);
  if (bundleSize >= sequence.length) {
    return sequence.length > 0 ? [sequence] : [];
  }

  const bundles: EvidenceDoc[][] = [];
  for (let index = 0; index < sequence.length; index += bundleSize) {
    const bundle = sequence.slice(index, index + bundleSize);
    if (bundle.length > 0) {
      bundles.push(bundle);
    }
  }
  return bundles;
}

function assertBundleFitsBudget(
  evidences: EvidenceDoc[],
  config: ExperimentConfig,
) {
  const estimatedTokens = evidences.reduce((sum, evidence) => {
    return sum + estimateEvidenceTokens(getEvidenceContentForConfig(evidence, config));
  }, 0);

  if (estimatedTokens > MAX_SCORE_TARGET_ESTIMATED_INPUT_TOKENS) {
    throw new Error(
      `Score target estimated input tokens ${estimatedTokens} exceed internal cap `
      + `${MAX_SCORE_TARGET_ESTIMATED_INPUT_TOKENS}`,
    );
  }
}

export const createRun = zInternalMutation({
  args: CreateRunArgsSchema,
  returns: zid("runs"),
  handler: async (ctx, args) => {
    const { experiment_id, target_count } = args;
    const rawExperiment = await ctx.db.get(experiment_id);
    if (!rawExperiment) throw new Error("Experiment not found");
    const experiment = {
      ...rawExperiment,
      ...normalizeExperimentConfig(rawExperiment),
    };

    const run_id = await ctx.db.insert("runs", {
      experiment_id,
      target_count,
      pause_after: args.pause_after ?? null,
      completed_count: 0,
      status: "start",
      current_stage: "rubric_gen",
      rubric_gen_count: 0,
      rubric_critic_count: 0,
      score_gen_count: 0,
      score_critic_count: 0,
    });

    const baseSeed = (Math.random() * 0xffffffff) | 0;
    const seeds = generateSeeds(baseSeed, args.target_count);
    const sampleIds: Id<"samples">[] = [];
    for (let i = 0; i < args.target_count; i++) {
      const seed = seeds[i];
      const sample_id = await ctx.db.insert("samples", {
        run_id,
        experiment_id: experiment._id,
        model: rawExperiment.scoring_config.model,
        seed,
        rubric_id: null,
        rubric_critic_id: null,
        score_target_total: 0,
        score_count: 0,
        score_critic_count: 0,
      });
      sampleIds.push(sample_id);
    }

    const evidenceLinks = await ctx.db
      .query("pool_evidences")
      .withIndex("by_pool", (q) => q.eq("pool_id", experiment.pool_id))
      .collect();
    const orderedLinks = evidenceLinks
      .slice()
      .sort((a, b) => a._creationTime - b._creationTime);
    const orderedEvidences = (
      await Promise.all(orderedLinks.map((link) => ctx.db.get(link.evidence_id)))
    ).filter((value): value is EvidenceDoc => value != null);

    for (const sample_id of sampleIds) {
      const sample = await ctx.db.get(sample_id);
      if (!sample) continue;
      const bundles = buildBundlesForSample(orderedEvidences, experiment, sample.seed);
      for (const bundle of bundles) {
        assertBundleFitsBudget(bundle, experiment);

        const scoreTargetId = await ctx.db.insert("sample_score_targets", {
          run_id,
          sample_id,
          score_id: null,
          score_critic_id: null,
        });

        for (const [index, evidence] of bundle.entries()) {
          await ctx.db.insert("sample_score_target_items", {
            score_target_id: scoreTargetId,
            evidence_id: evidence._id,
            window_id: evidence.window_id,
            position: index,
          });
        }
      }
      await ctx.db.patch(sample_id, {
        score_target_total: bundles.length,
      });
    }

    return run_id;
  },
});

export const getRun = zInternalQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, args): Promise<Doc<"runs">> => {
    const run = await ctx.db.get(args.run_id);
    if (!run) throw new Error("Run not found");
    return run;
  },
});
