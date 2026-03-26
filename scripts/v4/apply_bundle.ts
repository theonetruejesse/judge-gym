import { ConvexHttpClient } from "convex/browser";
import path from "node:path";
import { api } from "../../apps/engine-convex/convex/_generated/api";
import { readJson } from "./common";

type ImportBundle = {
  universe: {
    universe_tag: string;
    kind: "paper_audit" | "benchmark";
    title: string;
    description?: string | null;
    citation_json?: string | null;
  };
  evidence_set: {
    evidence_set_tag: string;
    title: string;
    source_kind: "literature_dataset";
    quality_label: "high" | "medium" | "low" | "unknown";
    selection_config_json?: string | null;
  };
  package: {
    package_tag: string;
    target_key: "gilardi" | "zheng_mt_bench" | "ziems" | "custom";
    title: string;
    description?: string | null;
    default_compatibility_mode: "paper_faithful" | "paper_translated" | "native" | "stress_test";
    default_evidence_view: "paper_original" | "source_text" | "l1_cleaned" | "l2_neutralized" | "l3_abstracted";
    rubric_source_kind: "generate" | "imported_rubric" | "imported_codebook" | "direct_labels";
    task_contract: any;
    output_contract: any;
    rubric_seed?: any;
    rubric_critic_seed?: any;
    score_prompt: any;
    provenance_json?: string | null;
    metadata_json?: string | null;
  };
  evidence_items: Array<{
    canonical_key: string;
    title?: string | null;
    source_url?: string | null;
    source_name?: string | null;
    publish_date?: string | null;
    raw_text: string;
    source_record_kind: "paper_original" | "source_text";
    pipeline_kind: string;
    pipeline_version: string;
    metadata_json?: string | null;
    inclusion_reason?: string | null;
    quality_label?: "high" | "medium" | "low" | "unknown";
    ordinal?: number;
  }>;
  experiment_blueprints: Array<{
    experiment_tag: string;
    package_tag?: string;
    study_kind: "paper_audit" | "benchmark";
    compatibility_mode: "paper_faithful" | "paper_translated" | "native" | "stress_test";
    rubric_source_kind: "generate" | "imported_rubric" | "imported_codebook" | "direct_labels";
    task_contract: any;
    output_contract: any;
    rubric_config: any;
    scoring_config: any;
  }>;
};

export async function applyBundle(args: {
  bundlePath: string;
  startRun?: boolean;
  targetCount?: number;
}) {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required for live bundle application");
  }
  const client = new ConvexHttpClient(convexUrl);
  const bundle = await readJson<ImportBundle>(args.bundlePath);

  const universe = await client.mutation(api.packages.evidence.createEvidenceUniverse, {
    universe_tag: bundle.universe.universe_tag,
    kind: bundle.universe.kind,
    title: bundle.universe.title,
    description: bundle.universe.description ?? null,
    citation_json: bundle.universe.citation_json ?? null,
  });
  const evidenceSet = await client.mutation(api.packages.evidence.createEvidenceSet, {
    universe_id: universe.universe_id,
    evidence_set_tag: bundle.evidence_set.evidence_set_tag,
    title: bundle.evidence_set.title,
    source_kind: bundle.evidence_set.source_kind,
    quality_label: bundle.evidence_set.quality_label,
    selection_config_json: bundle.evidence_set.selection_config_json ?? null,
  });
  const packageResult = await client.mutation(api.packages.paper_audits.upsertPaperAuditPackage, {
    ...bundle.package,
  });

  const imported = [];
  for (const item of bundle.evidence_items) {
    const result = await client.action(api.packages.evidence.importEvidenceItem, {
      universe_id: universe.universe_id,
      canonical_key: item.canonical_key,
      title: item.title ?? null,
      source_url: item.source_url ?? null,
      source_name: item.source_name ?? null,
      publish_date: item.publish_date ?? null,
      raw_text: item.raw_text,
      metadata_json: item.metadata_json ?? null,
      source_record_kind: item.source_record_kind,
      pipeline_kind: item.pipeline_kind,
      pipeline_version: item.pipeline_version,
    });
    imported.push({
      ...result,
      inclusion_reason: item.inclusion_reason ?? null,
      quality_label: item.quality_label ?? "high",
      ordinal: item.ordinal ?? imported.length,
    });
  }

  await client.mutation(api.packages.evidence.addEvidenceSetItems, {
    evidence_set_id: evidenceSet.evidence_set_id,
    items: imported.map((item) => ({
      evidence_item_id: item.evidence_item_id,
      pinned_source_record_id: item.source_record_id,
      ordinal: item.ordinal,
      inclusion_reason: item.inclusion_reason,
      quality_label: item.quality_label,
    })),
  });

  const experiments = [];
  for (const blueprint of bundle.experiment_blueprints) {
    const experimentConfig = {
      study_kind: blueprint.study_kind,
      compatibility_mode: blueprint.compatibility_mode,
      rubric_source_kind: blueprint.rubric_source_kind,
      task_contract: blueprint.task_contract,
      output_contract: blueprint.output_contract,
      rubric_config: blueprint.rubric_config,
      scoring_config: blueprint.scoring_config,
      paper_audit_package_id: packageResult.package_id,
    };
    const experiment = await client.mutation(api.packages.lab.initExperiment, {
      experiment_tag: blueprint.experiment_tag,
      evidence_set_id: evidenceSet.evidence_set_id,
      experiment_config: experimentConfig,
    });
    experiments.push(experiment);
  }

  const runs = [];
  if (args.startRun) {
    for (const experiment of experiments) {
      runs.push(
        await client.mutation(api.packages.lab.startExperimentRun, {
          experiment_id: experiment.experiment_id,
          target_count: args.targetCount ?? 1,
          pause_after: null,
        }),
      );
    }
  }

  return {
    bundlePath: path.resolve(args.bundlePath),
    universe,
    evidenceSet,
    packageResult,
    imported_count: imported.length,
    experiments,
    runs,
  };
}
