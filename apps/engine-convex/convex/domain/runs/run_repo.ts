import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import {
  normalizeExperimentConfig,
  type SemanticLevel,
  type BundleStrategy,
} from "@judge-gym/engine-prompts/run";
import type { MutationCtx } from "../../_generated/server";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { RunsTableSchema } from "../../models/experiments";
import type { Doc, Id } from "../../_generated/dataModel";
import { generateSeeds } from "../../utils/randomize";

const CreateRunArgsSchema = z.object({
  experiment_id: RunsTableSchema.shape.experiment_id,
  target_count: RunsTableSchema.shape.target_count,
  pause_after: RunsTableSchema.shape.pause_after.optional(),
});

const MAX_SCORE_TARGET_ESTIMATED_INPUT_TOKENS =
  DEFAULT_ENGINE_SETTINGS.run.maxScoreTargetEstimatedInputTokens;

type ResolvedEvidenceSelection = {
  evidence_set_item_id: Id<"evidence_set_items">;
  evidence_item_id: Id<"evidence_items">;
  evidence_view_id: Id<"evidence_views"> | null;
  content_asset_id: Id<"evidence_assets">;
  estimated_tokens: number;
  ordinal: number;
};

function shuffleWithSeed<T>(items: T[], seed = 0): T[] {
  const next = items.slice();
  let state = seed | 0;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    const swapIndex = ((state >>> 0) % (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }
  return next;
}

function chunkSelections<T>(items: T[], bundleSize: number): T[][] {
  const normalizedBundleSize = Math.max(1, bundleSize);
  if (items.length === 0) {
    return [];
  }
  if (normalizedBundleSize >= items.length) {
    return [items.slice()];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += normalizedBundleSize) {
    chunks.push(items.slice(index, index + normalizedBundleSize));
  }
  return chunks;
}

function resolveSemanticViewKind(
  evidenceView: SemanticLevel,
) {
  switch (evidenceView) {
    case "l1_cleaned":
      return "l1_cleaned";
    case "l2_neutralized":
      return "l2_neutralized";
    case "l3_abstracted":
      return "l3_abstracted";
    case "l0_raw":
    default:
      return null;
  }
}

function estimateSelectionTokens(args: {
  evidenceItem: Doc<"evidence_items">;
  asset: Doc<"evidence_assets">;
}) {
  if (typeof args.evidenceItem.token_estimate === "number" && args.evidenceItem.token_estimate > 0) {
    return args.evidenceItem.token_estimate;
  }
  return Math.max(1, Math.ceil(args.asset.byte_size / 4));
}

function buildEvidenceSetBundles(args: {
  selections: ResolvedEvidenceSelection[];
  bundleSize: number;
  bundleStrategy: BundleStrategy | undefined;
  seed: number;
}) {
  const orderedSelections = args.selections
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal);

  switch (args.bundleStrategy ?? "window_round_robin") {
    case "window_round_robin":
      return chunkSelections(orderedSelections, args.bundleSize);
    case "random_bundle":
      return chunkSelections(shuffleWithSeed(orderedSelections, args.seed), args.bundleSize);
    case "semantic_cluster":
    case "semantic_cluster_projected":
      throw new Error(
        `Bundle strategy "${args.bundleStrategy}" is not yet supported for evidence-set-backed V4 runs.`,
      );
    default:
      return chunkSelections(orderedSelections, args.bundleSize);
  }
}

function assertBundleFitsBudget(
  selections: ResolvedEvidenceSelection[],
) {
  const estimatedTokens = selections.reduce((sum, selection) => {
    return sum + selection.estimated_tokens;
  }, 0);

  if (estimatedTokens > MAX_SCORE_TARGET_ESTIMATED_INPUT_TOKENS) {
    throw new Error(
      `Score target estimated input tokens ${estimatedTokens} exceed internal cap `
      + `${MAX_SCORE_TARGET_ESTIMATED_INPUT_TOKENS}`,
    );
  }
}

async function resolveEvidenceSetSelections(
  ctx: MutationCtx,
  experiment: Doc<"experiments">,
): Promise<ResolvedEvidenceSelection[]> {
  if (!experiment.evidence_set_id) {
    throw new Error("Evidence-set-backed run requires experiment.evidence_set_id");
  }

  const setItems = await ctx.db
    .query("evidence_set_items")
    .withIndex("by_set", (q) => q.eq("evidence_set_id", experiment.evidence_set_id!))
    .collect();
  const orderedSetItems = setItems
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal || left._creationTime - right._creationTime);

  const evidenceItemIds = Array.from(new Set(
    orderedSetItems.map((item) => String(item.evidence_item_id)),
  )) as Array<string>;
  const evidenceItems = await Promise.all(
    evidenceItemIds.map((evidenceItemId) => ctx.db.get(evidenceItemId as Id<"evidence_items">)),
  );
  const evidenceItemById = new Map(
    evidenceItems
      .filter((item): item is Doc<"evidence_items"> => item != null)
      .map((item) => [String(item._id), item] as const),
  );

  const requestedViewKind = resolveSemanticViewKind(
    normalizeExperimentConfig(experiment).scoring_config.evidence_view,
  );
  const explicitViewIds = Array.from(new Set(
    orderedSetItems
      .map((item) => item.pinned_view_id)
      .filter((value): value is Id<"evidence_views"> => value != null)
      .map((value) => String(value)),
  ));
  const explicitViews = await Promise.all(
    explicitViewIds.map((viewId) => ctx.db.get(viewId as Id<"evidence_views">)),
  );
  const viewById = new Map(
    explicitViews
      .filter((view): view is Doc<"evidence_views"> => view != null)
      .map((view) => [String(view._id), view] as const),
  );

  const viewsByItemAndKind = new Map<string, Doc<"evidence_views">>();
  if (requestedViewKind) {
    const uniqueItemIds = Array.from(new Set(
      orderedSetItems.map((item) => String(item.evidence_item_id)),
    ));
    for (const evidenceItemId of uniqueItemIds) {
      const views = await ctx.db
        .query("evidence_views")
        .withIndex("by_item", (q) => q.eq("evidence_item_id", evidenceItemId as Id<"evidence_items">))
        .collect();
      for (const view of views) {
        viewsByItemAndKind.set(`${view.evidence_item_id}:${view.view_kind}`, view);
      }
    }
  }

  const requiredAssetIds = new Set<string>();
  const resolvedViewsBySetItemId = new Map<
    string,
    { evidence_view_id: Id<"evidence_views"> | null; content_asset_id: Id<"evidence_assets"> }
  >();

  for (const setItem of orderedSetItems) {
    const evidenceItem = evidenceItemById.get(String(setItem.evidence_item_id));
    if (!evidenceItem) {
      throw new Error(`Evidence set item references missing evidence item: ${setItem.evidence_item_id}`);
    }

    const selectedView = setItem.pinned_view_id
      ? viewById.get(String(setItem.pinned_view_id)) ?? null
      : requestedViewKind
        ? viewsByItemAndKind.get(`${setItem.evidence_item_id}:${requestedViewKind}`) ?? null
        : null;
    const contentAssetId = selectedView?.asset_id ?? evidenceItem.raw_text_asset_id;
    if (!contentAssetId) {
      throw new Error(
        `Evidence item ${evidenceItem._id} does not have a resolved content asset for V4 scoring.`,
      );
    }

    requiredAssetIds.add(String(contentAssetId));
    resolvedViewsBySetItemId.set(String(setItem._id), {
      evidence_view_id: selectedView?._id ?? null,
      content_asset_id: contentAssetId,
    });
  }

  const assets = await Promise.all(
    Array.from(requiredAssetIds).map((assetId) => ctx.db.get(assetId as Id<"evidence_assets">)),
  );
  const assetById = new Map(
    assets
      .filter((asset): asset is Doc<"evidence_assets"> => asset != null)
      .map((asset) => [String(asset._id), asset] as const),
  );

  return orderedSetItems.map((setItem) => {
    const evidenceItem = evidenceItemById.get(String(setItem.evidence_item_id));
    const resolved = resolvedViewsBySetItemId.get(String(setItem._id));
    if (!evidenceItem || !resolved) {
      throw new Error(`Failed to resolve evidence set item ${setItem._id} for run materialization.`);
    }
    const asset = assetById.get(String(resolved.content_asset_id));
    if (!asset) {
      throw new Error(`Missing content asset ${resolved.content_asset_id} for evidence set item ${setItem._id}.`);
    }
    return {
      evidence_set_item_id: setItem._id,
      evidence_item_id: evidenceItem._id,
      evidence_view_id: resolved.evidence_view_id,
      content_asset_id: resolved.content_asset_id,
      estimated_tokens: estimateSelectionTokens({
        evidenceItem,
        asset,
      }),
      ordinal: setItem.ordinal,
    };
  });
}

export const createRun = zInternalMutation({
  args: CreateRunArgsSchema,
  returns: zid("runs"),
  handler: async (ctx, args) => {
    const { experiment_id, target_count } = args;
    const rawExperiment = await ctx.db.get(experiment_id);
    if (!rawExperiment) throw new Error("Experiment not found");
    if (rawExperiment.evidence_source_kind !== "evidence_set" || !rawExperiment.evidence_set_id) {
      throw new Error(
        "Greenfield V4 run materialization now requires evidence-set-backed experiments.",
      );
    }

    const experimentConfig = normalizeExperimentConfig(rawExperiment);
    const resolvedSelections = await resolveEvidenceSetSelections(ctx, rawExperiment);

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
    for (let index = 0; index < args.target_count; index += 1) {
      const seed = seeds[index]!;
      const sample_id = await ctx.db.insert("samples", {
        run_id,
        experiment_id: rawExperiment._id,
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

    for (const sample_id of sampleIds) {
      const sample = await ctx.db.get(sample_id);
      if (!sample) continue;
      const bundles = buildEvidenceSetBundles({
        selections: resolvedSelections,
        bundleSize: experimentConfig.scoring_config.evidence_bundle_size,
        bundleStrategy: experimentConfig.scoring_config.bundle_strategy,
        seed: sample.seed,
      });
      for (const bundle of bundles) {
        assertBundleFitsBudget(bundle);

        const scoreTargetId = await ctx.db.insert("sample_score_targets", {
          run_id,
          sample_id,
          score_id: null,
          score_critic_id: null,
        });

        for (const [position, selection] of bundle.entries()) {
          await ctx.db.insert("sample_score_target_items", {
            run_id,
            score_target_id: scoreTargetId,
            evidence_set_item_id: selection.evidence_set_item_id,
            evidence_item_id: selection.evidence_item_id,
            evidence_view_id: selection.evidence_view_id,
            content_asset_id: selection.content_asset_id,
            position,
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
