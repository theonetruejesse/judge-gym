import { ensureDir, writeJson } from "./common";
import {
  NATIVE_CONCEPTS,
  NATIVE_CONCEPTS_MANIFEST_PATH,
  NATIVE_CONCEPTS_PROVIDER,
  NATIVE_CONCEPTS_ROOT,
  nativeConceptExperimentTag,
  type NativeConceptualManifest,
} from "./native_concepts";

function isoDateOffset(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildExperimentBlueprints(): NativeConceptualManifest["experiment_blueprints"] {
  return NATIVE_CONCEPTS.flatMap((concept) => [
    {
      experiment_tag: nativeConceptExperimentTag({
        concept: concept.key,
        condition: "baseline_source",
      }),
      concept: concept.key,
      study_kind: "regime_check",
      compatibility_mode: "native",
      rubric_source_kind: "generate",
      rubric_config: {
        model: NATIVE_CONCEPTS_PROVIDER,
        scale_size: 4,
        concept: concept.label,
      },
      scoring_config: {
        model: NATIVE_CONCEPTS_PROVIDER,
        method: "subset",
        abstain_enabled: false,
        evidence_view: "source_text",
        randomizations: [
          "anonymize_stages",
          "hide_label_text",
          "shuffle_rubric_order",
        ],
        evidence_bundle_size: 1,
        bundle_strategy: "window_round_robin",
        bundle_strategy_version: "v1",
      },
    },
    {
      experiment_tag: nativeConceptExperimentTag({
        concept: concept.key,
        condition: "abstention_source",
      }),
      concept: concept.key,
      study_kind: "regime_check",
      compatibility_mode: "native",
      rubric_source_kind: "generate",
      rubric_config: {
        model: NATIVE_CONCEPTS_PROVIDER,
        scale_size: 4,
        concept: concept.label,
      },
      scoring_config: {
        model: NATIVE_CONCEPTS_PROVIDER,
        method: "subset",
        abstain_enabled: true,
        evidence_view: "source_text",
        randomizations: [
          "anonymize_stages",
          "hide_label_text",
          "shuffle_rubric_order",
        ],
        evidence_bundle_size: 1,
        bundle_strategy: "window_round_robin",
        bundle_strategy_version: "v1",
      },
    },
    {
      experiment_tag: nativeConceptExperimentTag({
        concept: concept.key,
        condition: "view_l2_neutralized",
      }),
      concept: concept.key,
      study_kind: "regime_check",
      compatibility_mode: "native",
      rubric_source_kind: "generate",
      rubric_config: {
        model: NATIVE_CONCEPTS_PROVIDER,
        scale_size: 4,
        concept: concept.label,
      },
      scoring_config: {
        model: NATIVE_CONCEPTS_PROVIDER,
        method: "subset",
        abstain_enabled: false,
        evidence_view: "l2_neutralized",
        randomizations: [
          "anonymize_stages",
          "hide_label_text",
          "shuffle_rubric_order",
        ],
        evidence_bundle_size: 1,
        bundle_strategy: "window_round_robin",
        bundle_strategy_version: "v1",
      },
    },
  ]);
}

async function main() {
  const manifest: NativeConceptualManifest = {
    manifest_tag: "v4_native_concepts_gpt41_v1",
    title: "V4 native conceptual GPT-4.1 shared-universe matrix",
    provider: NATIVE_CONCEPTS_PROVIDER,
    concepts: NATIVE_CONCEPTS.map((concept) => ({
      key: concept.key,
      label: concept.label,
    })),
    universe: {
      universe_tag: "v4_native_concepts_shared_universe_v1",
      kind: "news",
      title: "V4 native conceptual shared universe",
      description: [
        "Shared Media Cloud evidence universe for the first native V4 conceptual matrix.",
        "Designed to compare fascism and illiberal democracy under a matched GPT-4.1 regime.",
      ].join(" "),
      default_locale: "en",
    },
    acquisition: {
      spec_tag_prefix: "v4_native_concepts_shared_v1",
      discovery_provider: "mediacloud",
      hydrator_kind: "url_fetch",
      query: "\"fascism\" OR \"illiberal democracy\"",
      start_date: isoDateOffset(180),
      end_date: isoDateOffset(0),
      collection_ids: [34412234],
      page_size: 50,
      max_pages: 3,
      hydrator_config_json: JSON.stringify({
        fetch_strategy: "direct_url_v1",
      }),
    },
    curation: {
      snapshot_evidence_set_tag_prefix: "v4_native_concepts_shared_v1_snapshot",
      snapshot_title_prefix: "V4 native conceptual snapshot",
      curated_evidence_set_tag: "v4_native_concepts_shared_v1_set",
      curated_title: "V4 native conceptual curated set",
      quality_label: "high",
      target_item_count: 48,
      max_items_per_source: 2,
      min_char_count: 1_200,
      max_char_count: 12_000,
      required_record_kind: "source_text",
    },
    transform: {
      source_record_kind: "source_text",
      target_view_kinds: ["l2_neutralized"],
      model: NATIVE_CONCEPTS_PROVIDER,
      prompt_version: "semantic-transform-v1",
    },
    experiment_blueprints: buildExperimentBlueprints(),
  };

  await ensureDir(NATIVE_CONCEPTS_ROOT);
  await writeJson(NATIVE_CONCEPTS_MANIFEST_PATH, manifest);

  console.log(JSON.stringify({
    manifest_path: NATIVE_CONCEPTS_MANIFEST_PATH,
    experiment_count: manifest.experiment_blueprints.length,
    concepts: manifest.concepts,
    target_item_count: manifest.curation.target_item_count,
    query: manifest.acquisition.query,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
