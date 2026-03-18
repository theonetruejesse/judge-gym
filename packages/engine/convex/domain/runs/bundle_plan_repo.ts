import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import {
  BundlePlansTableSchema,
} from "../../models/bundles";
import {
  materializeBundleRows,
  type BundlePlanConfig,
} from "./bundle_plan_logic";

const BundlePlanArgsSchema = z.object({
  bundle_plan_tag: BundlePlansTableSchema.shape.bundle_plan_tag.optional(),
  pool_id: BundlePlansTableSchema.shape.pool_id,
  strategy: BundlePlansTableSchema.shape.strategy,
  strategy_version: BundlePlansTableSchema.shape.strategy_version.optional(),
  source_view: BundlePlansTableSchema.shape.source_view.optional(),
  bundle_size: BundlePlansTableSchema.shape.bundle_size,
  seed: BundlePlansTableSchema.shape.seed.optional(),
});

function normalizeBundlePlanConfig(
  args: z.infer<typeof BundlePlanArgsSchema>,
): BundlePlanConfig & {
  pool_id: Id<"pools">;
  bundle_plan_tag?: string;
  strategy_version: string;
} {
  return {
    bundle_plan_tag: args.bundle_plan_tag,
    pool_id: args.pool_id,
    strategy: args.strategy,
    strategy_version: args.strategy_version ?? "v1",
    source_view: args.source_view ?? null,
    bundle_size: args.bundle_size,
    seed: args.seed ?? null,
  };
}

function resolveBundlePlanTag(
  config: ReturnType<typeof normalizeBundlePlanConfig>,
) {
  if (config.bundle_plan_tag) return config.bundle_plan_tag;
  const sourceView = config.source_view ?? "none";
  const seed = config.seed ?? "none";
  return [
    "bundle_plan",
    String(config.pool_id),
    config.strategy,
    config.strategy_version,
    `view_${sourceView}`,
    `size_${config.bundle_size}`,
    `seed_${seed}`,
  ].join("__");
}

async function getPoolEvidenceDocs(
  ctx: MutationCtx | QueryCtx,
  poolId: Id<"pools">,
) {
  const links = await ctx.db
    .query("pool_evidences")
    .withIndex("by_pool", (q) => q.eq("pool_id", poolId))
    .collect();
  const sortedLinks = links
    .slice()
    .sort((left, right) => String(left.evidence_id).localeCompare(String(right.evidence_id)));
  const evidences = await Promise.all(
    sortedLinks.map((link) => ctx.db.get(link.evidence_id)),
  );
  return evidences.filter((evidence): evidence is Doc<"evidences"> => evidence != null);
}

export async function findMatchingBundlePlan(
  ctx: MutationCtx | QueryCtx,
  config: ReturnType<typeof normalizeBundlePlanConfig>,
) {
  const candidates = await ctx.db
    .query("bundle_plans")
    .withIndex("by_pool", (q) => q.eq("pool_id", config.pool_id))
    .collect();
  return candidates.find((plan) =>
    plan.strategy === config.strategy
    && plan.strategy_version === config.strategy_version
    && plan.bundle_size === config.bundle_size
    && (plan.seed ?? null) === config.seed
    && (plan.source_view ?? null) === config.source_view,
  ) ?? null;
}

async function insertBundlePlanItems(
  ctx: MutationCtx,
  bundlePlanId: Id<"bundle_plans">,
  evidences: Doc<"evidences">[],
  config: BundlePlanConfig,
) {
  const evidenceById = new Map(
    evidences.map((evidence) => [String(evidence._id), evidence] as const),
  );
  const bundleRows = materializeBundleRows(evidences, config);
  for (const bundle of bundleRows) {
    for (const [position, evidenceId] of bundle.evidence_ids.entries()) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        throw new Error(`Missing evidence ${evidenceId} for bundle plan materialization`);
      }
      await ctx.db.insert("bundle_plan_items", {
        bundle_plan_id: bundlePlanId,
        bundle_index: bundle.bundle_index,
        evidence_id: evidence._id,
        window_id: evidence.window_id,
        position,
        cluster_id: bundle.cluster_id,
        bundle_signature: bundle.bundle_signature,
      });
    }
  }
  return bundleRows.length;
}

export async function ensureBundlePlan(
  ctx: MutationCtx,
  args: z.infer<typeof BundlePlanArgsSchema>,
) {
  const config = normalizeBundlePlanConfig(args);
  const existing = await findMatchingBundlePlan(ctx, config);
  if (existing) {
    return {
      bundle_plan_id: existing._id,
      bundle_plan_tag: existing.bundle_plan_tag,
      created: false,
    };
  }

  if (!(await ctx.db.get(config.pool_id))) throw new Error("Pool not found");
  const evidenceDocs = await getPoolEvidenceDocs(ctx, config.pool_id);
  const bundlePlanTag = resolveBundlePlanTag(config);
  const tagCollision = await ctx.db
    .query("bundle_plans")
    .withIndex("by_bundle_plan_tag", (q) => q.eq("bundle_plan_tag", bundlePlanTag))
    .first();
  if (tagCollision) {
    if (
      tagCollision.pool_id === config.pool_id
      && tagCollision.strategy === config.strategy
      && tagCollision.strategy_version === config.strategy_version
      && tagCollision.bundle_size === config.bundle_size
      && (tagCollision.seed ?? null) === config.seed
      && (tagCollision.source_view ?? null) === config.source_view
    ) {
      return {
        bundle_plan_id: tagCollision._id,
        bundle_plan_tag: tagCollision.bundle_plan_tag,
        created: false,
      };
    }
    throw new Error(`Bundle plan tag already exists: ${bundlePlanTag}`);
  }

  const bundlePlanId = await ctx.db.insert("bundle_plans", {
    bundle_plan_tag: bundlePlanTag,
    pool_id: config.pool_id,
    strategy: config.strategy,
    strategy_version: config.strategy_version,
    source_view: config.source_view,
    bundle_size: config.bundle_size,
    seed: config.seed,
    evidence_count: evidenceDocs.length,
    bundle_count: Math.ceil(evidenceDocs.length / Math.max(1, config.bundle_size)),
    status: "ready",
  });

  if (config.strategy !== "window_round_robin") {
    const bundleCount = await insertBundlePlanItems(ctx, bundlePlanId, evidenceDocs, config);
    await ctx.db.patch(bundlePlanId, {
      bundle_count: bundleCount,
    });
  }

  return {
    bundle_plan_id: bundlePlanId,
    bundle_plan_tag: bundlePlanTag,
    created: true,
  };
}

export function deriveBundlePlanArgsForExperiment(
  experiment: Doc<"experiments">,
) {
  const strategy = experiment.scoring_config.bundle_strategy ?? "window_round_robin";
  const strategyVersion = experiment.scoring_config.bundle_strategy_version
    ?? (strategy === "window_round_robin" ? "legacy_v1" : "v1");
  const bundleSize = Math.max(1, experiment.scoring_config.evidence_bundle_size);
  const sourceView = strategy === "semantic_cluster_projected"
    ? "l2_neutralized"
    : strategy === "semantic_cluster"
      ? experiment.scoring_config.evidence_view
      : null;
  const seed = strategy === "window_round_robin"
    ? null
    : experiment.scoring_config.clustering_seed ?? 0;
  return {
    pool_id: experiment.pool_id,
    strategy,
    strategy_version: strategyVersion,
    source_view: sourceView,
    bundle_size: bundleSize,
    seed,
    bundle_plan_tag: [
      experiment.experiment_tag,
      "plan",
      strategy,
      strategyVersion,
      `size_${bundleSize}`,
      `view_${sourceView ?? "none"}`,
      `seed_${seed ?? "none"}`,
    ].join("__"),
  };
}

export const createBundlePlan = zInternalMutation({
  args: BundlePlanArgsSchema,
  returns: z.object({
    bundle_plan_id: zid("bundle_plans"),
    bundle_plan_tag: z.string(),
    created: z.boolean(),
  }),
  handler: async (ctx, args) => {
    return ensureBundlePlan(ctx, args);
  },
});

export const getBundlePlan = zInternalQuery({
  args: z.object({
    bundle_plan_id: zid("bundle_plans"),
  }),
  returns: BundlePlansTableSchema.extend({
    _id: zid("bundle_plans"),
    _creationTime: z.number(),
  }),
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.bundle_plan_id);
    if (!plan) throw new Error("Bundle plan not found");
    return plan;
  },
});

export const listBundlePlans = zInternalQuery({
  args: z.object({
    pool_id: zid("pools").optional(),
  }),
  returns: z.array(
    BundlePlansTableSchema.extend({
      _id: zid("bundle_plans"),
      _creationTime: z.number(),
      materialized_item_count: z.number().int().nonnegative(),
    }),
  ),
  handler: async (ctx, args) => {
    const plans = args.pool_id
      ? await ctx.db
        .query("bundle_plans")
        .withIndex("by_pool", (q) => q.eq("pool_id", args.pool_id!))
        .collect()
      : await ctx.db.query("bundle_plans").collect();
    const orderedPlans = plans
      .slice()
      .sort((left, right) => left.bundle_plan_tag.localeCompare(right.bundle_plan_tag));
    const results = [];
    for (const plan of orderedPlans) {
      const items = await ctx.db
        .query("bundle_plan_items")
        .withIndex("by_bundle_plan", (q) => q.eq("bundle_plan_id", plan._id))
        .collect();
      results.push({
        ...plan,
        materialized_item_count: items.length,
      });
    }
    return results;
  },
});
