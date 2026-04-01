import path from "node:path";
import { V4_BUILDS_ROOT } from "./common";

export const NATIVE_CONCEPTS_ROOT = path.join(V4_BUILDS_ROOT, "native_concepts");
export const NATIVE_CONCEPTS_MANIFEST_PATH = path.join(
  NATIVE_CONCEPTS_ROOT,
  "gpt41_shared_manifest.json",
);

export const NATIVE_CONCEPTS_PROVIDER = "gpt-4.1" as const;
export const NATIVE_OPENAI_PROVIDERS = [
  "gpt-4.1",
  "gpt-5.2",
  "gpt-4.1-mini",
  "gpt-5.2-chat",
] as const;
export const NATIVE_OPENROUTER_PROVIDERS = [
  "qwen-current-text-flagship",
  "kimi-current-text-flagship",
] as const;
export const NATIVE_CONCEPTS = [
  {
    key: "fascism",
    label: "fascism",
  },
  {
    key: "illiberal_democracy",
    label: "illiberal democracy",
  },
] as const;

export type NativeConceptKey = (typeof NATIVE_CONCEPTS)[number]["key"];
export type NativeConceptCondition =
  | "baseline_source"
  | "abstention_source"
  | "view_l2_neutralized";
export type NativeOpenAIProvider = (typeof NATIVE_OPENAI_PROVIDERS)[number];
export type NativeOpenRouterProvider = (typeof NATIVE_OPENROUTER_PROVIDERS)[number];
export type NativeScaledProvider = NativeOpenAIProvider | NativeOpenRouterProvider;

const NATIVE_MODEL_TAG_SUFFIX: Record<NativeScaledProvider, string> = {
  "gpt-4.1": "gpt41",
  "gpt-5.2": "gpt52",
  "gpt-4.1-mini": "gpt41mini",
  "gpt-5.2-chat": "gpt52chat",
  "qwen-current-text-flagship": "qwen",
  "kimi-current-text-flagship": "kimi",
};

export const PROMOTED_NATIVE_LANES: ReadonlyArray<{
  concept: NativeConceptKey;
  condition: NativeConceptCondition;
}> = [
  { concept: "fascism", condition: "baseline_source" },
  { concept: "fascism", condition: "abstention_source" },
  { concept: "fascism", condition: "view_l2_neutralized" },
  { concept: "illiberal_democracy", condition: "baseline_source" },
  { concept: "illiberal_democracy", condition: "view_l2_neutralized" },
] as const;

export function nativeModelTagSuffix(model: NativeScaledProvider) {
  return NATIVE_MODEL_TAG_SUFFIX[model];
}

export function nativeConceptExperimentTag(args: {
  concept: NativeConceptKey;
  condition: NativeConceptCondition;
  model?: NativeScaledProvider;
}) {
  return `v4_native_${args.concept}_${args.condition}_${nativeModelTagSuffix(args.model ?? "gpt-4.1")}`;
}

export type NativeConceptualManifest = {
  manifest_tag: string;
  title: string;
  provider: NativeScaledProvider;
  concepts: Array<{
    key: NativeConceptKey;
    label: string;
  }>;
  universe: {
    universe_tag: string;
    kind: "news";
    title: string;
    description: string;
    default_locale: "en";
  };
  acquisition: {
    spec_tag_prefix: string;
    discovery_provider: "mediacloud";
    hydrator_kind: "url_fetch";
    query: string;
    start_date: string;
    end_date: string;
    collection_ids: number[];
    page_size: number;
    max_pages: number;
    hydrator_config_json: string;
  };
  curation: {
    snapshot_evidence_set_tag_prefix: string;
    snapshot_title_prefix: string;
    curated_evidence_set_tag: string;
    curated_title: string;
    quality_label: "high";
    target_item_count: number;
    max_items_per_source: number;
    min_char_count: number;
    max_char_count: number;
    required_record_kind: "source_text";
  };
  transform: {
    source_record_kind: "source_text";
    target_view_kinds: ["l2_neutralized"];
    model: NativeScaledProvider;
    prompt_version: "semantic-transform-v1";
  };
  experiment_blueprints: Array<{
    experiment_tag: string;
    concept: NativeConceptKey;
    study_kind: "regime_check";
    compatibility_mode: "native";
    rubric_source_kind: "generate";
    rubric_config: {
      model: NativeScaledProvider;
      scale_size: 4;
      concept: string;
    };
    scoring_config: {
      model: NativeScaledProvider;
      method: "subset";
      abstain_enabled: boolean;
      evidence_view: "source_text" | "l2_neutralized";
      randomizations: Array<
        "anonymize_stages" | "shuffle_rubric_order" | "hide_label_text"
      >;
      evidence_bundle_size: 1;
      bundle_strategy: "window_round_robin";
      bundle_strategy_version: string;
    };
  }>;
};
