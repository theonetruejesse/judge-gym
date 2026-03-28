import path from "node:path";
import { V4_BUILDS_ROOT } from "./common";

export const NATIVE_CONCEPTS_ROOT = path.join(V4_BUILDS_ROOT, "native_concepts");
export const NATIVE_CONCEPTS_MANIFEST_PATH = path.join(
  NATIVE_CONCEPTS_ROOT,
  "gpt41_shared_manifest.json",
);

export const NATIVE_CONCEPTS_PROVIDER = "gpt-4.1" as const;
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

export function nativeConceptExperimentTag(args: {
  concept: NativeConceptKey;
  condition: "baseline_source" | "abstention_source" | "view_l2_neutralized";
}) {
  return `v4_native_${args.concept}_${args.condition}_gpt41`;
}

export type NativeConceptualManifest = {
  manifest_tag: string;
  title: string;
  provider: "gpt-4.1";
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
    model: "gpt-4.1";
    prompt_version: "semantic-transform-v1";
  };
  experiment_blueprints: Array<{
    experiment_tag: string;
    concept: NativeConceptKey;
    study_kind: "regime_check";
    compatibility_mode: "native";
    rubric_source_kind: "generate";
    rubric_config: {
      model: "gpt-4.1";
      scale_size: 4;
      concept: string;
    };
    scoring_config: {
      model: "gpt-4.1";
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
