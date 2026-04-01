import path from "node:path";
import {
  ensureDir,
  readJson,
  writeJson,
} from "./common";
import {
  NATIVE_CONCEPTS_MANIFEST_PATH,
  NATIVE_CONCEPTS_ROOT,
  NATIVE_OPENROUTER_PROVIDERS,
  PROMOTED_NATIVE_LANES,
  nativeConceptExperimentTag,
  nativeModelTagSuffix,
  type NativeConceptCondition,
  type NativeConceptKey,
  type NativeConceptualManifest,
  type NativeOpenRouterProvider,
} from "./native_concepts";

const OPENROUTER_SCALE_ROOT = path.join(NATIVE_CONCEPTS_ROOT, "openrouter_scale");
const OPENROUTER_SCALE_INDEX_PATH = path.join(OPENROUTER_SCALE_ROOT, "index.json");
const CONFIRMATION_TARGET_COUNT = 10;

function scoringConditionConfig(condition: NativeConceptCondition) {
  switch (condition) {
    case "baseline_source":
      return {
        abstain_enabled: false,
        evidence_view: "source_text" as const,
      };
    case "abstention_source":
      return {
        abstain_enabled: true,
        evidence_view: "source_text" as const,
      };
    case "view_l2_neutralized":
      return {
        abstain_enabled: false,
        evidence_view: "l2_neutralized" as const,
      };
  }
}

function providerTitle(model: NativeOpenRouterProvider) {
  switch (model) {
    case "qwen-current-text-flagship":
      return "Qwen current text flagship";
    case "kimi-current-text-flagship":
      return "Kimi current text flagship";
  }
}

function conceptLabel(concept: NativeConceptKey) {
  return concept === "illiberal_democracy" ? "illiberal democracy" : concept;
}

function buildBlueprints(model: NativeOpenRouterProvider): NativeConceptualManifest["experiment_blueprints"] {
  return PROMOTED_NATIVE_LANES.map((lane) => ({
    experiment_tag: nativeConceptExperimentTag({
      concept: lane.concept,
      condition: lane.condition,
      model,
    }),
    concept: lane.concept,
    study_kind: "regime_check" as const,
    compatibility_mode: "native" as const,
    rubric_source_kind: "generate" as const,
    rubric_config: {
      model,
      scale_size: 4,
      concept: conceptLabel(lane.concept),
    },
    scoring_config: {
      model,
      method: "subset" as const,
      ...scoringConditionConfig(lane.condition),
      randomizations: [
        "anonymize_stages",
        "hide_label_text",
        "shuffle_rubric_order",
      ],
      evidence_bundle_size: 1 as const,
      bundle_strategy: "window_round_robin" as const,
      bundle_strategy_version: "v1",
    },
  }));
}

async function main() {
  const baseManifest = await readJson<NativeConceptualManifest>(NATIVE_CONCEPTS_MANIFEST_PATH);
  await ensureDir(OPENROUTER_SCALE_ROOT);

  const manifests = [];
  for (const model of NATIVE_OPENROUTER_PROVIDERS) {
    const manifest: NativeConceptualManifest = {
      ...baseManifest,
      manifest_tag: `v4_native_concepts_${nativeModelTagSuffix(model)}_confirm_v1`,
      title: `V4 native conceptual ${providerTitle(model)} confirmation matrix`,
      provider: model,
      transform: {
        ...baseManifest.transform,
        model: "gpt-4.1",
      },
      experiment_blueprints: buildBlueprints(model),
    };
    const manifestPath = path.join(OPENROUTER_SCALE_ROOT, `${nativeModelTagSuffix(model)}.json`);
    await writeJson(manifestPath, manifest);
    manifests.push({
      model,
      manifest_path: manifestPath,
      experiment_tags: manifest.experiment_blueprints.map((blueprint) => blueprint.experiment_tag),
    });
  }

  const index = {
    root: OPENROUTER_SCALE_ROOT,
    target_count: CONFIRMATION_TARGET_COUNT,
    evidence_set_tag: baseManifest.curation.curated_evidence_set_tag,
    promoted_lanes: PROMOTED_NATIVE_LANES,
    manifests,
  };
  await writeJson(OPENROUTER_SCALE_INDEX_PATH, index);

  console.log(JSON.stringify(index, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
