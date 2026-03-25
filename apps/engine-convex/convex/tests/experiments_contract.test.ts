import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";

function initTest() {
  return convexTest(schema, buildModules());
}

describe("experiment contract", () => {
  const originalDataset = process.env.AXIOM_DATASET;
  const originalToken = process.env.AXIOM_TOKEN;
  const originalSkipExport = process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT;

  beforeEach(() => {
    process.env.AXIOM_DATASET = "judge-gym-test";
    process.env.AXIOM_TOKEN = "test-token";
    process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT = "1";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
  });

  afterEach(() => {
    if (originalDataset === undefined) {
      delete process.env.AXIOM_DATASET;
    } else {
      process.env.AXIOM_DATASET = originalDataset;
    }
    if (originalToken === undefined) {
      delete process.env.AXIOM_TOKEN;
    } else {
      process.env.AXIOM_TOKEN = originalToken;
    }
    if (originalSkipExport === undefined) {
      delete process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT;
    } else {
      process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT = originalSkipExport;
    }
    vi.unstubAllGlobals();
  });

  async function seedGilardiPackage(t: ReturnType<typeof initTest>) {
    return t.mutation(api.packages.paper_audits.upsertPaperAuditPackage, {
      package_tag: "gilardi_relevance_v1",
      target_key: "gilardi",
      title: "Gilardi relevance package",
      description: "Test package",
      default_compatibility_mode: "paper_faithful",
      default_evidence_view: "paper_original",
      rubric_source_kind: "direct_labels",
      task_contract: {
        task_kind: "label_classification",
        label_space_json: JSON.stringify(["relevant", "irrelevant"]),
        instructions_json: JSON.stringify({ source: "package" }),
        prompt_template_id: "gilardi_relevance_v1",
      },
      output_contract: {
        kind: "label",
        schema_version: "v1",
        parser_key: "freeform_label_choice",
      },
      rubric_seed: {
        concept: "policy relevance",
        scale_size: 2,
        justification: "Imported direct labels",
        stages: [
          { stage_number: 1, label: "Relevant", criteria: ["a"] },
          { stage_number: 2, label: "Irrelevant", criteria: ["b"] },
        ],
        label_mapping: {
          relevant: 1,
          Relevant: 1,
          irrelevant: 2,
          Irrelevant: 2,
        },
      },
      rubric_critic_seed: {
        justification: "Imported package critic seed",
        observability_score: 1,
        discriminability_score: 1,
      },
      score_prompt: {
        template_kind: "simple_v1",
        system_prompt_template: "Classify the evidence.",
        user_prompt_template: "{{evidence}}",
        required_variables: ["evidence"],
      },
      provenance_json: JSON.stringify({ test: true }),
      metadata_json: JSON.stringify({ test: true }),
    });
  }

  test("stores evidence-set-backed experiment metadata with V4 defaults", async () => {
    const t = initTest();
    const paperAuditPackage = await seedGilardiPackage(t);

    const { universe_id } = await t.mutation(internal.domain.evidence.evidence_repo.createUniverse, {
      universe_tag: "v4-contract-universe",
      kind: "paper_audit",
      title: "V4 contract universe",
    });

    const imported = await t.action(internal.domain.evidence.evidence_service.importEvidenceItem, {
      universe_id,
      canonical_key: "contract:item:001",
      title: "Imported audit row",
      raw_text: "Imported audit row text.",
      source_record_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "contract-v1",
    });

    const { evidence_set_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createEvidenceSet,
      {
        universe_id,
        evidence_set_tag: "contract-set",
        title: "Contract set",
        source_kind: "literature_dataset",
        quality_label: "high",
      },
    );

    await t.mutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, {
      evidence_set_id,
      items: [
        {
          evidence_item_id: imported.evidence_item_id,
          pinned_source_record_id: imported.source_record_id,
          quality_label: "high",
        },
      ],
    });

    const experiment_id = await t.mutation(internal.domain.runs.experiments_repo.createExperiment, {
      experiment_tag: "v4_contract_experiment",
      evidence_set_id,
      paper_audit_package_id: paperAuditPackage.package_id,
      study_kind: "paper_audit",
      evidence_source_kind: "evidence_set",
      rubric_config: {
        model: "gpt-4.1-mini",
        scale_size: 2,
        concept: "policy relevance",
      },
      scoring_config: {
        model: "claude-sonnet-4",
        method: "single",
        abstain_enabled: false,
        evidence_view: "paper_original",
        randomizations: [],
        evidence_bundle_size: 1,
      },
    });

    const summary = await t.query(internal.domain.runs.experiments_service.getExperimentSummary, {
      experiment_id,
    });

    expect(summary.experiment_tag).toBe("v4_contract_experiment");
    expect(summary.evidence_source_kind).toBe("evidence_set");
    expect(summary.evidence_set_id).toBe(evidence_set_id);
    expect(summary.evidence_set_tag).toBe("contract-set");
    expect(summary.evidence_set_quality_label).toBe("high");
    expect(summary.evidence_selected_count).toBe(1);
    expect(summary.paper_audit_package_tag).toBe("gilardi_relevance_v1");
    expect(summary.paper_audit_target_key).toBe("gilardi");
    expect(summary.rubric_source_kind).toBe("direct_labels");
    expect(summary.compatibility_mode).toBe("paper_faithful");
    expect(summary.output_contract.parser_key).toBe("freeform_label_choice");
  });

  test("lab experiment surfaces expose evidence-set-backed experiment evidence", async () => {
    const t = initTest();
    const paperAuditPackage = await seedGilardiPackage(t);

    const { universe_id } = await t.mutation(internal.domain.evidence.evidence_repo.createUniverse, {
      universe_tag: "v4-lab-universe",
      kind: "paper_audit",
      title: "V4 lab universe",
    });

    const imported = await t.action(internal.domain.evidence.evidence_service.importEvidenceItem, {
      universe_id,
      canonical_key: "lab:item:001",
      title: "Lab imported row",
      source_url: "https://example.com/lab-row",
      source_name: "Example Source",
      publish_date: "2026-03-01",
      raw_text: "Lab imported row text.",
      source_record_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "lab-v1",
    });

    const { evidence_set_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createEvidenceSet,
      {
        universe_id,
        evidence_set_tag: "lab-set",
        title: "Lab set",
        source_kind: "literature_dataset",
        quality_label: "high",
      },
    );

    await t.mutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, {
      evidence_set_id,
      items: [
        {
          evidence_item_id: imported.evidence_item_id,
          pinned_source_record_id: imported.source_record_id,
          ordinal: 0,
          quality_label: "high",
        },
      ],
    });

    const { experiment_id } = await t.mutation(api.packages.lab.initExperiment, {
      evidence_set_id,
      experiment_tag: "v4_lab_experiment",
      experiment_config: {
        study_kind: "paper_audit",
        evidence_source_kind: "evidence_set",
        paper_audit_package_id: paperAuditPackage.package_id,
        rubric_config: {
          model: "gpt-4.1-mini",
          scale_size: 2,
          concept: "policy relevance",
        },
        scoring_config: {
          model: "claude-sonnet-4",
          method: "single",
          abstain_enabled: false,
          evidence_view: "paper_original",
          randomizations: [],
          evidence_bundle_size: 1,
        },
      },
    });

    const evidenceRows = await t.query(api.packages.lab.listExperimentEvidence, {
      experiment_id,
    });

    expect(evidenceRows).toHaveLength(1);
    expect(evidenceRows[0]?.evidence_item_id).toBe(imported.evidence_item_id);
    expect(evidenceRows[0]?.evidence_source_record_id).toBe(imported.source_record_id);
    expect(evidenceRows[0]?.title).toBe("Lab imported row");
    expect(evidenceRows[0]?.url).toBe("https://example.com/lab-row");
    expect(evidenceRows[0]?.source_name).toBe("Example Source");
  });
});
