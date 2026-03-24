import { z } from "zod";
import { modelTypeSchema } from "@judge-gym/engine-settings/provider";

export const SemanticLevelSchema = z.enum([
  "l0_raw",
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
]);

export type SemanticLevel = z.infer<typeof SemanticLevelSchema>;

export const BundleStrategySchema = z.enum([
  "window_round_robin",
  "random_bundle",
  "semantic_cluster",
  "semantic_cluster_projected",
]);

export type BundleStrategy = z.infer<typeof BundleStrategySchema>;

export const RandomizationModeSchema = z.enum([
  "anonymize_stages",
  "shuffle_rubric_order",
  "hide_label_text",
]);

export const StudyKindSchema = z.enum([
  "pilot",
  "paper_audit",
  "benchmark",
  "regime_check",
]);

export type StudyKind = z.infer<typeof StudyKindSchema>;

export const EvidenceSourceKindSchema = z.enum([
  "pool",
  "evidence_set",
]);

export type EvidenceSourceKind = z.infer<typeof EvidenceSourceKindSchema>;

export const RubricSourceKindSchema = z.enum([
  "generate",
  "imported_rubric",
  "imported_codebook",
  "direct_labels",
]);

export type RubricSourceKind = z.infer<typeof RubricSourceKindSchema>;

export const CompatibilityModeSchema = z.enum([
  "native",
  "paper_faithful",
  "paper_translated",
  "stress_test",
]);

export type CompatibilityMode = z.infer<typeof CompatibilityModeSchema>;

export const TaskContractSchema = z.object({
  task_kind: z.enum([
    "stage_judgment",
    "label_classification",
    "ordinal_scoring",
  ]),
  label_space_json: z.string().nullable().optional(),
  instructions_json: z.string().nullable().optional(),
  prompt_template_id: z.string().nullable().optional(),
});

export type TaskContract = z.infer<typeof TaskContractSchema>;

export const OutputContractSchema = z.object({
  kind: z.enum([
    "verdict_line",
    "structured_json",
    "label",
  ]),
  schema_version: z.string(),
  parser_key: z.string(),
});

export type OutputContract = z.infer<typeof OutputContractSchema>;

export const RubricStageConfigSchema = z.object({
  model: modelTypeSchema,
  scale_size: z.number(),
  concept: z.string(),
});

export const ScoringStageConfigSchema = z.object({
  model: modelTypeSchema,
  method: z.enum(["single", "subset"]),
  abstain_enabled: z.boolean(),
  evidence_view: SemanticLevelSchema,
  randomizations: z.array(RandomizationModeSchema),
  evidence_bundle_size: z.number().int().min(1),
  bundle_strategy: BundleStrategySchema.optional(),
  bundle_strategy_version: z.string().optional(),
  clustering_seed: z.number().int().optional(),
});

export type ExperimentConfig = {
  rubric_config: {
    scale_size: number;
    concept: string;
  };
  scoring_config: {
    method: "single" | "subset";
    abstain_enabled: boolean;
    evidence_view: SemanticLevel;
    randomizations: Array<
      "anonymize_stages" | "shuffle_rubric_order" | "hide_label_text"
    >;
    evidence_bundle_size: number;
    bundle_strategy?: "window_round_robin" | "random_bundle" | "semantic_cluster" | "semantic_cluster_projected";
    bundle_strategy_version?: string;
    clustering_seed?: number;
  };
  study_kind?: StudyKind;
  evidence_source_kind?: EvidenceSourceKind;
  rubric_source_kind?: RubricSourceKind;
  compatibility_mode?: CompatibilityMode;
  task_contract?: TaskContract;
  output_contract?: OutputContract;
};

export function normalizeExperimentConfig<T extends {
  rubric_config: {
    scale_size: number;
    concept: string;
  };
  scoring_config: {
    method: "single" | "subset";
    abstain_enabled: boolean;
    evidence_view: SemanticLevel;
    randomizations: Array<
      "anonymize_stages" | "shuffle_rubric_order" | "hide_label_text"
    >;
    evidence_bundle_size: number;
    bundle_strategy?: "window_round_robin" | "random_bundle" | "semantic_cluster" | "semantic_cluster_projected";
    bundle_strategy_version?: string;
    clustering_seed?: number;
  };
  study_kind?: StudyKind;
  evidence_source_kind?: EvidenceSourceKind;
  rubric_source_kind?: RubricSourceKind;
  compatibility_mode?: CompatibilityMode;
  task_contract?: TaskContract;
  output_contract?: OutputContract;
}>(config: T): ExperimentConfig {
  return {
    rubric_config: config.rubric_config,
    scoring_config: config.scoring_config,
    study_kind: config.study_kind ?? "pilot",
    evidence_source_kind: config.evidence_source_kind ?? "pool",
    rubric_source_kind: config.rubric_source_kind ?? "generate",
    compatibility_mode: config.compatibility_mode ?? "native",
    task_contract: config.task_contract ?? {
      task_kind: "stage_judgment",
      label_space_json: null,
      instructions_json: null,
      prompt_template_id: null,
    },
    output_contract: config.output_contract ?? {
      kind: "verdict_line",
      schema_version: "v1",
      parser_key: config.scoring_config.method === "subset"
        ? "subset_verdict"
        : "single_verdict",
    },
  };
}

export type RandomizationMode =
  z.infer<typeof RandomizationModeSchema>;

export interface RandomizationStrategy {
  anonLabel: boolean;
  rubricOrderShuffle: boolean;
  hideLabelName: boolean;
}

export function resolveRandomizationStrategy(
  config: ExperimentConfig,
): RandomizationStrategy {
  const modes = new Set<RandomizationMode>(config.scoring_config.randomizations);
  return {
    anonLabel: modes.has("anonymize_stages"),
    rubricOrderShuffle: modes.has("shuffle_rubric_order"),
    hideLabelName: modes.has("hide_label_text"),
  };
}

export interface ScaleStrategy {
  stageCount: number;
  hasMidpoint: boolean;
  midpointLabel: string | null;
  letterLabels: string[];
}

export function resolveScaleStrategy(config: ExperimentConfig): ScaleStrategy {
  const n = config.rubric_config.scale_size;
  const isOdd = n % 2 === 1;
  const letters = Array.from({ length: n }, (_, i) =>
    String.fromCharCode(65 + i),
  );
  return {
    stageCount: n,
    hasMidpoint: isOdd,
    midpointLabel: isOdd ? letters[Math.floor(n / 2)] : null,
    letterLabels: letters,
  };
}

export interface EvidenceStrategy {
  contentField:
    | "l0_raw_content"
    | "l1_cleaned_content"
    | "l2_neutralized_content"
    | "l3_abstracted_content";
}

export function resolveEvidenceStrategy(
  config: ExperimentConfig,
): EvidenceStrategy {
  const contentField = (() => {
    switch (config.scoring_config.evidence_view) {
      case "l1_cleaned":
        return "l1_cleaned_content";
      case "l2_neutralized":
        return "l2_neutralized_content";
      case "l3_abstracted":
        return "l3_abstracted_content";
      default:
        return "l0_raw_content";
    }
  })();
  return {
    contentField,
  };
}

export interface ScoringPromptStrategy {
  buildRequirements: () => string[];
  buildOutputContract: () => string[];
}

export function resolveScoringStrategy(
  config: ExperimentConfig,
): ScoringPromptStrategy {
  const abstainEnabled = config.scoring_config.abstain_enabled;
  const strategies: Record<string, ScoringPromptStrategy> = {
    single: {
      buildRequirements: () => [
        "Select exactly one rubric stage identifier from the rubric provided by the user.",
        abstainEnabled
          ? "If no stage is sufficiently supported, output `ABSTAIN`."
          : "Do not abstain. You must always select exactly one displayed rubric stage identifier, even if the evidence is weak or ambiguous.",
      ],
      buildOutputContract: () => abstainEnabled
        ? [
          "End with exactly one final line using one of these forms:",
          "`VERDICT: <one rubric stage identifier from the user prompt>`",
          "`VERDICT: ABSTAIN`",
          "The final line must begin exactly with `VERDICT:` and must not start with a bullet, dash, or numbering.",
        ]
        : [
          "End with exactly one final line in this form:",
          "`VERDICT: <one rubric stage identifier from the user prompt>`",
          "The final line must begin exactly with `VERDICT:` and must not start with a bullet, dash, or numbering.",
          "Never output `ABSTAIN`, `None`, an empty verdict, or any other text in the final line.",
        ],
    },
    subset: {
      buildRequirements: () => [
        "Select every rubric stage identifier from the user-provided rubric whose criteria are affirmatively supported by the evidence.",
        "If multiple stages are supported, include all of them.",
        "Do not collapse to a single stage if more than one applies.",
        abstainEnabled
          ? "If no stage is sufficiently supported, output `ABSTAIN`."
          : "Do not abstain. If no higher-signal stage is affirmatively supported, select the weakest displayed rubric stage identifier instead.",
      ],
      buildOutputContract: () => {
        return abstainEnabled
          ? [
            "End with exactly one final line in one of these forms:",
            "`VERDICT: <comma-separated rubric stage identifiers from the user prompt>`",
            "`VERDICT: ABSTAIN`",
            "The final line must begin exactly with `VERDICT:` and must not start with a bullet, dash, or numbering.",
          ]
          : [
            "End with exactly one final line in this form:",
            "`VERDICT: <comma-separated rubric stage identifiers from the user prompt>`",
            "The final line must begin exactly with `VERDICT:` and must not start with a bullet, dash, or numbering.",
            "The final line must contain at least one displayed rubric stage identifier.",
            "Never output `ABSTAIN`, `None`, an empty verdict, or any other text in the final line.",
          ];
      },
    },
  };
  const strategy = strategies[config.scoring_config.method];
  if (!strategy) {
    const allowed = Object.keys(strategies).join(", ");
    throw new Error(
      `Unknown scoring method "${config.scoring_config.method}". Allowed: ${allowed}`,
    );
  }
  return strategy;
}
