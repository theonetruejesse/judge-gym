import path from "node:path";
import { ensureDir, writeJson } from "./common";
import {
  NATIVE_CONCEPTS_ROOT,
  NATIVE_CONCEPTS_PROVIDER,
  type NativeConceptualManifest,
} from "./native_concepts";

const FASCISM_BOUNDARY_MANIFEST_PATH = path.join(
  NATIVE_CONCEPTS_ROOT,
  "fascism_boundary_manifest.json",
);

function isoDateOffset(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildExperimentBlueprints(): NativeConceptualManifest["experiment_blueprints"] {
  const concepts = [
    { key: "fascism", label: "fascism" },
    { key: "illiberal_democracy", label: "illiberal democracy" },
  ] as const;

  return concepts.flatMap((concept) => [
    {
      experiment_tag: `v4_boundary_${concept.key}_baseline_source_gpt41`,
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
      experiment_tag: `v4_boundary_${concept.key}_abstention_source_gpt41`,
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
      experiment_tag: `v4_boundary_${concept.key}_view_l2_neutralized_gpt41`,
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
    manifest_tag: "v4_native_fascism_boundary_gpt41_v1",
    title: "V4 native fascism-boundary GPT-4.1 shared-universe matrix",
    provider: NATIVE_CONCEPTS_PROVIDER,
    concepts: [
      {
        key: "fascism",
        label: "fascism",
      },
      {
        key: "illiberal_democracy",
        label: "illiberal democracy",
      },
    ],
    universe: {
      universe_tag: "v4_native_fascism_boundary_universe_v1",
      kind: "news",
      title: "V4 native fascism-boundary universe",
      description: [
        "Media Cloud universe curated for a U.S. fascism-boundary diagnostic set.",
        "Emphasizes executive power, protest policing, immigration enforcement, elections, courts, and media/institutional conflict over culture-war or entertainment spillover.",
      ].join(" "),
      default_locale: "en",
    },
    acquisition: {
      spec_tag_prefix: "v4_native_fascism_boundary_v1",
      discovery_provider: "mediacloud",
      hydrator_kind: "url_fetch",
      query: [
        "(",
        "(",
        "\"fascism\" OR fascist OR authoritarian OR authoritarianism OR autocracy",
        "OR \"illiberal democracy\" OR \"democratic backsliding\" OR \"democratic erosion\"",
        "OR \"enemy within\"",
        ")",
        "AND",
        "(",
        "Trump OR \"White House\" OR administration OR president OR \"executive order\"",
        "OR Congress OR \"Supreme Court\" OR court OR judge OR DOJ OR \"Justice Department\"",
        "OR ICE OR immigration OR deportation OR protest OR demonstration OR policing",
        "OR \"National Guard\" OR election OR voting OR constitution OR \"rule of law\"",
        "OR journalist OR media OR press OR censorship OR university OR campus",
        ")",
        ")",
        "AND NOT",
        "(",
        "movie OR film OR comic OR album OR music OR song OR television OR TV OR trailer",
        "OR game OR sports OR fashion OR celebrity OR review OR festival OR starwars",
        ")",
      ].join(" "),
      start_date: isoDateOffset(240),
      end_date: isoDateOffset(0),
      collection_ids: [34412234],
      page_size: 50,
      max_pages: 5,
      hydrator_config_json: JSON.stringify({
        fetch_strategy: "direct_url_v1",
      }),
    },
    curation: {
      snapshot_evidence_set_tag_prefix: "v4_native_fascism_boundary_v1_snapshot",
      snapshot_title_prefix: "V4 native fascism boundary snapshot",
      curated_evidence_set_tag: "v4_native_fascism_boundary_v1_set",
      curated_title: "V4 native fascism boundary curated set",
      quality_label: "high",
      target_item_count: 48,
      max_items_per_source: 2,
      min_char_count: 1_200,
      max_char_count: 12_000,
      required_record_kind: "source_text",
      keyword_score_boosts: [
        {
          label: "concept-frame",
          score: 10,
          terms: [
            "fascism",
            "fascist",
            "authoritarian",
            "authoritarianism",
            "autocracy",
            "illiberal democracy",
            "democratic backsliding",
            "democratic erosion",
            "enemy within",
          ],
        },
        {
          label: "institutional-anchor",
          score: 8,
          terms: [
            "executive order",
            "white house",
            "supreme court",
            "justice department",
            "doj",
            "constitution",
            "rule of law",
            "election",
            "voting rights",
            "national guard",
            "immigration",
            "deportation",
            "ice",
          ],
        },
      ],
      keyword_score_penalties: [
        {
          label: "entertainment-spillover",
          score: 18,
          terms: [
            "movie",
            "film",
            "comic",
            "album",
            "music",
            "song",
            "television",
            "tv",
            "celebrity",
            "sports",
            "festival",
            "trailer",
            "review",
          ],
        },
      ],
      bucket_quotas: [
        {
          key: "executive_power",
          title: "Executive power and constitutional conflict",
          quota: 8,
          terms: [
            "executive order",
            "white house",
            "president",
            "administration",
            "immunity",
            "constitution",
            "unitary executive",
          ],
        },
        {
          key: "immigration_enforcement",
          title: "Immigration enforcement and enemy-within rhetoric",
          quota: 8,
          terms: [
            "ice",
            "immigration",
            "deport",
            "deportation",
            "migrant",
            "border",
            "enemy within",
          ],
        },
        {
          key: "protest_policing",
          title: "Protest policing and coercive response",
          quota: 8,
          terms: [
            "protest",
            "demonstration",
            "demonstrator",
            "police",
            "riot",
            "national guard",
            "campus",
            "arrest",
          ],
        },
        {
          key: "elections_courts",
          title: "Elections, courts, and democratic norms",
          quota: 8,
          terms: [
            "election",
            "voting",
            "ballot",
            "supreme court",
            "court",
            "judge",
            "rule of law",
            "constitutional",
          ],
        },
        {
          key: "media_institutions",
          title: "Media, universities, and institutional speech conflict",
          quota: 8,
          terms: [
            "journalist",
            "press",
            "media",
            "censorship",
            "speech",
            "university",
            "campus",
            "npr",
            "fcc",
          ],
        },
        {
          key: "explicit_frame",
          title: "Explicit fascism or authoritarian framing",
          quota: 8,
          terms: [
            "fascism",
            "fascist",
            "authoritarian",
            "authoritarianism",
            "autocracy",
            "illiberal democracy",
            "democratic erosion",
            "democratic backsliding",
          ],
        },
      ],
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
  await writeJson(FASCISM_BOUNDARY_MANIFEST_PATH, manifest);

  console.log(JSON.stringify({
    manifest_path: FASCISM_BOUNDARY_MANIFEST_PATH,
    manifest_tag: manifest.manifest_tag,
    target_item_count: manifest.curation.target_item_count,
    query: manifest.acquisition.query,
    bucket_quotas: manifest.curation.bucket_quotas,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
