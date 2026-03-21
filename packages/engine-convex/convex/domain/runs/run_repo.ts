import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import type { MutationCtx } from "../../_generated/server";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { RunsTableSchema } from "../../models/experiments";
import type { Doc, Id } from "../../_generated/dataModel";
import { generateSeeds } from "../../utils/randomize";
import {
  normalizeExperimentConfig,
  resolveEvidenceStrategy,
  type ExperimentConfig,
} from "./run_strategies";
import {
  buildWindowRoundRobinBundlesForSample,
  materializeBundlesForPlan,
} from "./bundle_plan_materializer";

const CreateRunArgsSchema = z.object({
  experiment_id: RunsTableSchema.shape.experiment_id,
  target_count: RunsTableSchema.shape.target_count,
  pause_after: RunsTableSchema.shape.pause_after.optional(),
});

type EvidenceDoc = Doc<"evidences">;
const MAX_SCORE_TARGET_ESTIMATED_INPUT_TOKENS =
  DEFAULT_ENGINE_SETTINGS.run.maxScoreTargetEstimatedInputTokens;

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

function buildBundlesForSample(
  evidences: EvidenceDoc[],
  config: ExperimentConfig,
  seed: number,
) {
  return buildWindowRoundRobinBundlesForSample(
    evidences,
    Math.max(1, config.scoring_config.evidence_bundle_size),
    seed,
  );
}

type SampleBundleResolution = {
  resolveForSample: (seed: number) => EvidenceDoc[][];
};

async function resolveSampleBundleSource(
  ctx: MutationCtx,
  experiment: Doc<"experiments"> & ExperimentConfig,
  orderedEvidences: EvidenceDoc[],
): Promise<SampleBundleResolution> {
  if (!experiment.bundle_plan_id) {
    const strategy = experiment.scoring_config.bundle_strategy ?? "window_round_robin";
    if (strategy !== "window_round_robin") {
      const sharedBundles = materializeBundlesForPlan(orderedEvidences, {
        strategy,
        bundle_size: Math.max(1, experiment.scoring_config.evidence_bundle_size),
        seed: experiment.scoring_config.clustering_seed ?? 0,
        source_view: strategy === "semantic_cluster_projected"
          ? "l2_neutralized"
          : strategy === "semantic_cluster"
            ? experiment.scoring_config.evidence_view
            : null,
      });
      return {
        resolveForSample: () => sharedBundles,
      };
    }
    return {
      resolveForSample: (seed) => buildBundlesForSample(orderedEvidences, experiment, seed),
    };
  }

  const bundlePlan = await ctx.db.get(experiment.bundle_plan_id);
  if (!bundlePlan) {
    throw new Error("Bundle plan not found for experiment");
  }
  if (bundlePlan.pool_id !== experiment.pool_id) {
    throw new Error("Bundle plan pool does not match experiment pool");
  }

  if (bundlePlan.strategy === "window_round_robin") {
    return {
      resolveForSample: (seed) => buildWindowRoundRobinBundlesForSample(
        orderedEvidences,
        Math.max(1, bundlePlan.bundle_size),
        seed,
      ),
    };
  }

  const bundlePlanItems = await ctx.db
    .query("bundle_plan_items")
    .withIndex("by_bundle_plan", (q) => q.eq("bundle_plan_id", bundlePlan._id))
    .collect();
  const evidenceById = new Map(
    orderedEvidences.map((evidence) => [String(evidence._id), evidence] as const),
  );
  const bundlesByIndex = new Map<number, EvidenceDoc[]>();
  const orderedItems = bundlePlanItems
    .slice()
    .sort((left, right) => {
      if (left.bundle_index !== right.bundle_index) {
        return left.bundle_index - right.bundle_index;
      }
      if (left.position !== right.position) {
        return left.position - right.position;
      }
      return String(left.evidence_id).localeCompare(String(right.evidence_id));
    });
  for (const item of orderedItems) {
    const evidence = evidenceById.get(String(item.evidence_id));
    if (!evidence) {
      throw new Error(`Bundle plan item references evidence outside pool: ${item.evidence_id}`);
    }
    const current = bundlesByIndex.get(item.bundle_index) ?? [];
    current.push(evidence);
    bundlesByIndex.set(item.bundle_index, current);
  }
  const sharedBundles = Array.from(bundlesByIndex.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, bundle]) => bundle);

  return {
    resolveForSample: () => sharedBundles,
  };
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
    const experiment = rawExperiment;
    const experimentConfig = normalizeExperimentConfig(rawExperiment);

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
    const bundleSource = await resolveSampleBundleSource(ctx, experiment, orderedEvidences);

    for (const sample_id of sampleIds) {
      const sample = await ctx.db.get(sample_id);
      if (!sample) continue;
      const bundles = bundleSource.resolveForSample(sample.seed);
      for (const bundle of bundles) {
        assertBundleFitsBudget(bundle, experimentConfig);

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
