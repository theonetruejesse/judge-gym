import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation, zQuery } from "../../utils/custom_fns";
import { ExperimentsTableSchema } from "../../models/experiments";
import { BundleStrategySchema, SemanticLevelSchema } from "../../models/_shared";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { ModelType } from "@judge-gym/engine-settings/provider";

const DEFAULT_RANDOMIZATIONS = [
  "anonymize_stages",
  "hide_label_text",
  "shuffle_rubric_order",
] as const;

const DEFAULT_CONCEPT = "fascism";
const ALT_CONCEPT = "illiberal democracy";
const CLUSTERING_SEED = 7;

const V3MatrixExperimentSpecSchema = z.object({
  experiment_tag: z.string(),
  family_slug: z.string(),
  purpose: z.string(),
  rubric_config: ExperimentsTableSchema.shape.rubric_config,
  scoring_config: ExperimentsTableSchema.shape.scoring_config,
});

type V3MatrixExperimentSpec = z.infer<typeof V3MatrixExperimentSpecSchema>;

function buildSpec(args: {
  experiment_tag: string;
  family_slug: string;
  purpose: string;
  rubric_model: ModelType;
  scoring_model?: ModelType;
  scale_size?: number;
  concept?: string;
  abstain_enabled?: boolean;
  evidence_view?: z.infer<typeof SemanticLevelSchema>;
  evidence_bundle_size?: number;
  bundle_strategy?: z.infer<typeof BundleStrategySchema>;
  bundle_strategy_version?: string;
  clustering_seed?: number;
}): V3MatrixExperimentSpec {
  const scoringModel = args.scoring_model ?? args.rubric_model;
  return {
    experiment_tag: args.experiment_tag,
    family_slug: args.family_slug,
    purpose: args.purpose,
    rubric_config: {
      model: args.rubric_model,
      scale_size: args.scale_size ?? 4,
      concept: args.concept ?? DEFAULT_CONCEPT,
    },
    scoring_config: {
      model: scoringModel,
      method: "subset",
      abstain_enabled: args.abstain_enabled ?? true,
      evidence_view: args.evidence_view ?? "l2_neutralized",
      randomizations: [...DEFAULT_RANDOMIZATIONS],
      evidence_bundle_size: args.evidence_bundle_size ?? 1,
      bundle_strategy: args.bundle_strategy ?? "window_round_robin",
      bundle_strategy_version:
        args.bundle_strategy_version
        ?? ((args.bundle_strategy ?? "window_round_robin") === "window_round_robin"
          ? "legacy_v1"
          : "v1"),
      clustering_seed:
        (args.bundle_strategy ?? "window_round_robin") === "window_round_robin"
          ? undefined
          : (args.clustering_seed ?? CLUSTERING_SEED),
    },
  };
}

export const V3_MATRIX_EXPERIMENT_SPECS: V3MatrixExperimentSpec[] = [
  buildSpec({
    experiment_tag: "v3_a1_gpt_4_1_abstain_false",
    family_slug: "a1",
    purpose: "abstention toggle",
    rubric_model: "gpt-4.1",
    abstain_enabled: false,
  }),
  buildSpec({
    experiment_tag: "v3_a1_gpt_4_1_abstain_true",
    family_slug: "a1",
    purpose: "abstention toggle",
    rubric_model: "gpt-4.1",
    abstain_enabled: true,
  }),
  buildSpec({
    experiment_tag: "v3_a1_gpt_5_2_abstain_false",
    family_slug: "a1",
    purpose: "abstention toggle",
    rubric_model: "gpt-5.2",
    abstain_enabled: false,
  }),
  buildSpec({
    experiment_tag: "v3_a1_gpt_5_2_abstain_true",
    family_slug: "a1",
    purpose: "abstention toggle",
    rubric_model: "gpt-5.2",
    abstain_enabled: true,
  }),
  buildSpec({
    experiment_tag: "v3_a2_gpt_4_1_l3",
    family_slug: "a2",
    purpose: "l3 evidence view",
    rubric_model: "gpt-4.1",
    evidence_view: "l3_abstracted",
  }),
  buildSpec({
    experiment_tag: "v3_a2_gpt_5_2_l3",
    family_slug: "a2",
    purpose: "l3 evidence view",
    rubric_model: "gpt-5.2",
    evidence_view: "l3_abstracted",
  }),
  buildSpec({
    experiment_tag: "v3_a3_gpt_4_1_scale_5",
    family_slug: "a3",
    purpose: "5-point scale",
    rubric_model: "gpt-4.1",
    scale_size: 5,
  }),
  buildSpec({
    experiment_tag: "v3_a3_gpt_5_2_scale_5",
    family_slug: "a3",
    purpose: "5-point scale",
    rubric_model: "gpt-5.2",
    scale_size: 5,
  }),
  buildSpec({
    experiment_tag: "v3_a4_rubric_gpt_4_1_scoring_gpt_5_2",
    family_slug: "a4",
    purpose: "rubric/scoring role swap",
    rubric_model: "gpt-4.1",
    scoring_model: "gpt-5.2",
  }),
  buildSpec({
    experiment_tag: "v3_a4_rubric_gpt_5_2_scoring_gpt_4_1",
    family_slug: "a4",
    purpose: "rubric/scoring role swap",
    rubric_model: "gpt-5.2",
    scoring_model: "gpt-4.1",
  }),
  buildSpec({
    experiment_tag: "v3_a5_gpt_4_1_illiberal_democracy",
    family_slug: "a5",
    purpose: "concept framing",
    rubric_model: "gpt-4.1",
    concept: ALT_CONCEPT,
  }),
  buildSpec({
    experiment_tag: "v3_a5_gpt_5_2_illiberal_democracy",
    family_slug: "a5",
    purpose: "concept framing",
    rubric_model: "gpt-5.2",
    concept: ALT_CONCEPT,
  }),
  buildSpec({
    experiment_tag: "v3_b1_gpt_4_1_mini_abstain_false",
    family_slug: "b1",
    purpose: "small/chat family",
    rubric_model: "gpt-4.1-mini",
    abstain_enabled: false,
  }),
  buildSpec({
    experiment_tag: "v3_b1_gpt_4_1_mini_abstain_true",
    family_slug: "b1",
    purpose: "small/chat family",
    rubric_model: "gpt-4.1-mini",
    abstain_enabled: true,
  }),
  buildSpec({
    experiment_tag: "v3_b1_gpt_5_2_chat_abstain_false",
    family_slug: "b1",
    purpose: "small/chat family",
    rubric_model: "gpt-5.2-chat",
    abstain_enabled: false,
  }),
  buildSpec({
    experiment_tag: "v3_b1_gpt_5_2_chat_abstain_true",
    family_slug: "b1",
    purpose: "small/chat family",
    rubric_model: "gpt-5.2-chat",
    abstain_enabled: true,
  }),
  buildSpec({
    experiment_tag: "v3_d1_control_gpt_4_1",
    family_slug: "d1",
    purpose: "control",
    rubric_model: "gpt-4.1",
  }),
  buildSpec({
    experiment_tag: "v3_d1_control_gpt_5_2",
    family_slug: "d1",
    purpose: "control",
    rubric_model: "gpt-5.2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c1_gpt_4_1_bundle_5_random_l2",
    family_slug: "c1",
    purpose: "corrected random bundle l2",
    rubric_model: "gpt-4.1",
    evidence_bundle_size: 5,
    bundle_strategy: "random_bundle",
    bundle_strategy_version: "v1",
  }),
  buildSpec({
    experiment_tag: "v3_1_c1_gpt_5_2_bundle_5_random_l2",
    family_slug: "c1",
    purpose: "corrected random bundle l2",
    rubric_model: "gpt-5.2",
    evidence_bundle_size: 5,
    bundle_strategy: "random_bundle",
    bundle_strategy_version: "v1",
  }),
  buildSpec({
    experiment_tag: "v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2",
    family_slug: "c2",
    purpose: "corrected clustered l2",
    rubric_model: "gpt-4.1",
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2",
    family_slug: "c2",
    purpose: "corrected clustered l2",
    rubric_model: "gpt-5.2",
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2",
    family_slug: "c3",
    purpose: "corrected clustered l3",
    rubric_model: "gpt-4.1",
    evidence_view: "l3_abstracted",
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster_projected",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2",
    family_slug: "c3",
    purpose: "corrected clustered l3",
    rubric_model: "gpt-5.2",
    evidence_view: "l3_abstracted",
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster_projected",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c4_gpt_4_1_mini_scale_5",
    family_slug: "c4",
    purpose: "small/chat scale-5",
    rubric_model: "gpt-4.1-mini",
    scale_size: 5,
  }),
  buildSpec({
    experiment_tag: "v3_1_c4_gpt_5_2_chat_scale_5",
    family_slug: "c4",
    purpose: "small/chat scale-5",
    rubric_model: "gpt-5.2-chat",
    scale_size: 5,
  }),
  buildSpec({
    experiment_tag: "v3_1_c5_gpt_4_1_mini_bundle_5_cluster_l2",
    family_slug: "c5",
    purpose: "small/chat clustered bundle",
    rubric_model: "gpt-4.1-mini",
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c5_gpt_5_2_chat_bundle_5_cluster_l2",
    family_slug: "c5",
    purpose: "small/chat clustered bundle",
    rubric_model: "gpt-5.2-chat",
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7",
    family_slug: "c6",
    purpose: "clustered scale-7",
    rubric_model: "gpt-4.1",
    scale_size: 7,
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7",
    family_slug: "c6",
    purpose: "clustered scale-7",
    rubric_model: "gpt-5.2",
    scale_size: 7,
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9",
    family_slug: "c7",
    purpose: "clustered scale-9",
    rubric_model: "gpt-4.1",
    scale_size: 9,
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster",
    bundle_strategy_version: "v2",
  }),
  buildSpec({
    experiment_tag: "v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9",
    family_slug: "c7",
    purpose: "clustered scale-9",
    rubric_model: "gpt-5.2",
    scale_size: 9,
    evidence_bundle_size: 5,
    bundle_strategy: "semantic_cluster",
    bundle_strategy_version: "v2",
  }),
];

function deriveBundlePlanArgs(
  poolId: Id<"pools">,
  spec: V3MatrixExperimentSpec,
) {
  const strategy = spec.scoring_config.bundle_strategy ?? "window_round_robin";
  return {
    pool_id: poolId,
    bundle_plan_tag: `${spec.experiment_tag}__plan`,
    strategy,
    strategy_version: spec.scoring_config.bundle_strategy_version
      ?? (strategy === "window_round_robin" ? "legacy_v1" : "v1"),
    source_view: strategy === "semantic_cluster_projected"
      ? "l2_neutralized"
      : strategy === "semantic_cluster"
        ? spec.scoring_config.evidence_view
        : null,
    bundle_size: spec.scoring_config.evidence_bundle_size,
    seed: strategy === "window_round_robin"
      ? null
      : spec.scoring_config.clustering_seed ?? CLUSTERING_SEED,
  };
}

export const getV3MatrixContract = zQuery({
  args: z.object({}),
  returns: z.object({
    version: z.number(),
    experiment_count: z.number(),
    experiments: z.array(V3MatrixExperimentSpecSchema),
  }),
  handler: async () => ({
    version: 1,
    experiment_count: V3_MATRIX_EXPERIMENT_SPECS.length,
    experiments: V3_MATRIX_EXPERIMENT_SPECS,
  }),
});

export const initV3MatrixFromPool = zMutation({
  args: z.object({
    pool_id: zid("pools"),
    force_reconfigure: z.boolean().default(false),
    experiment_tags: z.array(z.string()).optional(),
  }),
  returns: z.object({
    pool_id: zid("pools"),
    experiment_count: z.number(),
    missing_experiment_tags: z.array(z.string()),
    rows: z.array(z.object({
      experiment_tag: z.string(),
      family_slug: z.string(),
      experiment_id: zid("experiments"),
      bundle_plan_id: zid("bundle_plans"),
      bundle_plan_tag: z.string(),
      action: z.enum(["created", "updated", "unchanged", "conflict"]),
    })),
  }),
  handler: async (ctx, args) => {
    const selectedSpecs = args.experiment_tags?.length
      ? V3_MATRIX_EXPERIMENT_SPECS.filter((spec) =>
          args.experiment_tags?.includes(spec.experiment_tag),
        )
      : V3_MATRIX_EXPERIMENT_SPECS;
    const foundTags = new Set(selectedSpecs.map((spec) => spec.experiment_tag));
    const missingExperimentTags = (args.experiment_tags ?? []).filter(
      (tag) => !foundTags.has(tag),
    );
    const rows = [] as Array<{
      experiment_tag: string;
      family_slug: string;
      experiment_id: Id<"experiments">;
      bundle_plan_id: Id<"bundle_plans">;
      bundle_plan_tag: string;
      action: "created" | "updated" | "unchanged" | "conflict";
    }>;

    for (const spec of selectedSpecs) {
      const bundlePlan = await ctx.runMutation(
        internal.domain.runs.bundle_plan_repo.createBundlePlan,
        deriveBundlePlanArgs(args.pool_id, spec),
      );
      const upserted = await ctx.runMutation(
        internal.domain.runs.experiments_repo.upsertExperimentByTag,
        {
          experiment_tag: spec.experiment_tag,
          pool_id: args.pool_id,
          bundle_plan_id: bundlePlan.bundle_plan_id,
          rubric_config: spec.rubric_config,
          scoring_config: spec.scoring_config,
          force_reconfigure: args.force_reconfigure,
        },
      );
      rows.push({
        experiment_tag: spec.experiment_tag,
        family_slug: spec.family_slug,
        experiment_id: upserted.experiment_id,
        bundle_plan_id: bundlePlan.bundle_plan_id,
        bundle_plan_tag: bundlePlan.bundle_plan_tag,
        action: upserted.action,
      });
    }

    return {
      pool_id: args.pool_id,
      experiment_count: rows.length,
      missing_experiment_tags: missingExperimentTags,
      rows,
    };
  },
});
