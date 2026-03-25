import path from "node:path";
import {
  V4_BUILDS_ROOT,
  V4_SOURCES_ROOT,
  ensureDir,
  parseDelimited,
  readJson,
  readText,
  writeJson,
} from "./common";

type DownloadManifest = {
  downloads: Array<{
    file_id: number;
    filename: string;
    destination: string;
  }>;
};

function findDownloadedFile(
  manifest: DownloadManifest,
  filename: string,
) {
  const match = manifest.downloads.find((entry) => entry.filename === filename);
  if (!match) {
    throw new Error(`Required Gilardi source file is missing: ${filename}`);
  }
  return match.destination;
}

function extractPromptText(pythonTemplate: string) {
  const match = pythonTemplate.match(/content="([\s\S]*?)"\s*\n\s*\n\s*for text/);
  if (!match?.[1]) {
    throw new Error("Failed to extract Gilardi prompt text from template script");
  }
  return match[1]
    .replaceAll("\\n", "\n")
    .replaceAll("\\'", "'")
    .trim();
}

async function main() {
  const sourceRoot = path.join(V4_SOURCES_ROOT, "gilardi", "dataverse");
  const buildRoot = path.join(V4_BUILDS_ROOT, "gilardi");
  await ensureDir(buildRoot);

  const manifest = await readJson<DownloadManifest>(
    path.join(sourceRoot, "download_manifest.json"),
  );
  const promptScriptPath = findDownloadedFile(
    manifest,
    "03-01-chatgpt-Zeroshot-Task-template.py",
  );
  const relevancePath = findDownloadedFile(
    manifest,
    "training_data_relevance_final.tab",
  );

  const promptScript = await readText(promptScriptPath);
  const promptText = extractPromptText(promptScript);
  const relevanceRows = parseDelimited({
    text: await readText(relevancePath),
    delimiter: "\t",
  })
    .filter((row) => row.text?.trim())
    .slice(0, 24);

  const packageTag = "gilardi_relevance_v1";
  const packagePayload = {
    package_tag: packageTag,
    target_key: "gilardi" as const,
    title: "Gilardi content-moderation relevance audit package",
    description: "Faithful relevance coding package built from the Gilardi replication bundle.",
    default_compatibility_mode: "paper_faithful" as const,
    default_evidence_view: "paper_original" as const,
    rubric_source_kind: "direct_labels" as const,
    task_contract: {
      task_kind: "label_classification" as const,
      label_space_json: JSON.stringify(["relevant", "irrelevant"]),
      instructions_json: JSON.stringify({
        source: "Gilardi Dataverse zero-shot template",
        task: "content moderation relevance",
      }),
      prompt_template_id: packageTag,
    },
    output_contract: {
      kind: "label" as const,
      schema_version: "v1",
      parser_key: "freeform_label_choice",
    },
    rubric_seed: {
      concept: "content moderation relevance",
      scale_size: 2,
      justification: "Direct-label package derived from the Gilardi relevance task.",
      stages: [
        {
          stage_number: 1,
          label: "Relevant",
          criteria: [
            "Directly discusses content moderation",
            "Mentions moderation rules or practices",
            "Addresses government regulation of moderation",
          ],
        },
        {
          stage_number: 2,
          label: "Irrelevant",
          criteria: [
            "Does not discuss content moderation",
            "Only contains moderated content examples",
            "Lacks a clear moderation link",
          ],
        },
      ],
      label_mapping: {
        relevant: 1,
        Relevant: 1,
        irrelevant: 2,
        Irrelevant: 2,
      },
    },
    rubric_critic_seed: {
      justification: "Imported direct-label codebook for a faithful paper audit.",
      observability_score: 1,
      discriminability_score: 1,
    },
    score_prompt: {
      template_kind: "simple_v1" as const,
      system_prompt_template: promptText,
      user_prompt_template:
        "here's the tweet I picked, please label it as 'Relevant' or 'Irrelevant':\n{{evidence}}",
      required_variables: ["evidence"],
    },
    provenance_json: JSON.stringify({
      dataset_doi: "doi:10.7910/DVN/PQYF6M",
      source_files: [
        "03-01-chatgpt-Zeroshot-Task-template.py",
        "training_data_relevance_final.tab",
      ],
    }),
    metadata_json: JSON.stringify({
      source_root: sourceRoot,
      build_kind: "paper_audit_package",
    }),
  };

  const evidenceItems = relevanceRows.map((row, index) => {
    const statusId = row.status_id?.trim() || `gilardi-${index + 1}`;
    return {
      canonical_key: `gilardi:relevance:${statusId}`,
      title: `Gilardi relevance tweet ${statusId}`,
      source_url: row.status_id
        ? `https://twitter.com/i/web/status/${row.status_id.trim()}`
        : null,
      source_name: "Gilardi replication bundle",
      publish_date: row.Date?.trim() || null,
      raw_text: row.text.trim(),
      source_record_kind: "paper_original" as const,
      pipeline_kind: "gilardi_import",
      pipeline_version: "v1",
      metadata_json: JSON.stringify({
        relevant_paula: row.relevant_paula || null,
        relevant_fabio: row.relevant_fabio || null,
        relevant_ra: row.relevant_ra || null,
        relevance_agreement_check: row.relevance_agreement_check || null,
      }),
      inclusion_reason: "V4 Gilardi local import build",
      quality_label: "high" as const,
      ordinal: index,
    };
  });

  const importBundle = {
    target: "gilardi",
    universe: {
      universe_tag: "gilardi_relevance_v1",
      kind: "paper_audit",
      title: "Gilardi relevance universe",
      description: "Local Gilardi relevance import bundle.",
      citation_json: JSON.stringify({
        doi: "10.7910/DVN/PQYF6M",
        title: "Replication Data for: ChatGPT outperforms crowd-workers for text-annotation tasks",
      }),
    },
    evidence_set: {
      evidence_set_tag: "gilardi_relevance_v1_set",
      title: "Gilardi relevance canary set",
      source_kind: "literature_dataset",
      quality_label: "high",
      selection_config_json: JSON.stringify({
        source_file: "training_data_relevance_final.tab",
        row_count: evidenceItems.length,
      }),
    },
    package: packagePayload,
    evidence_items: evidenceItems,
    experiment_blueprints: [
      {
        experiment_tag: "gilardi_relevance_v1_baseline_gpt41",
        package_tag: packageTag,
        study_kind: "paper_audit",
        compatibility_mode: "paper_faithful",
        rubric_source_kind: "direct_labels",
        task_contract: packagePayload.task_contract,
        output_contract: packagePayload.output_contract,
        rubric_config: {
          model: "gpt-4.1",
          scale_size: 2,
          concept: "content moderation relevance",
        },
        scoring_config: {
          model: "gpt-4.1",
          method: "single",
          abstain_enabled: false,
          evidence_view: "paper_original",
          randomizations: [],
          evidence_bundle_size: 1,
        },
      },
    ],
  };

  const canaryBundle = {
    ...importBundle,
    evidence_items: importBundle.evidence_items.slice(0, 6),
    evidence_set: {
      ...importBundle.evidence_set,
      evidence_set_tag: "gilardi_relevance_v1_canary_set",
      title: "Gilardi relevance canary set",
    },
    experiment_blueprints: [
      {
        ...importBundle.experiment_blueprints[0],
        experiment_tag: "gilardi_relevance_v1_canary_gpt41",
      },
    ],
  };

  await writeJson(path.join(buildRoot, "paper_audit_package.json"), packagePayload);
  await writeJson(path.join(buildRoot, "import_bundle.json"), importBundle);
  await writeJson(path.join(buildRoot, "canary_bundle.json"), canaryBundle);

  console.log(JSON.stringify({
    target: "gilardi",
    build_root: buildRoot,
    item_count: evidenceItems.length,
    canary_count: canaryBundle.evidence_items.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

