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

  test("stores evidence-set-backed experiment metadata with V4 defaults", async () => {
    const t = initTest();

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
      view_kind: "paper_original",
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
          pinned_view_id: imported.evidence_view_id,
          quality_label: "high",
        },
      ],
    });

    const experiment_id = await t.mutation(internal.domain.runs.experiments_repo.createExperiment, {
      experiment_tag: "v4_contract_experiment",
      evidence_set_id,
      study_kind: "paper_audit",
      evidence_source_kind: "evidence_set",
      rubric_source_kind: "imported_codebook",
      compatibility_mode: "paper_faithful",
      task_contract: {
        task_kind: "label_classification",
        label_space_json: JSON.stringify(["relevant", "irrelevant"]),
        instructions_json: JSON.stringify({
          source: "paper",
        }),
        prompt_template_id: "gilardi_v1",
      },
      output_contract: {
        kind: "label",
        schema_version: "v1",
        parser_key: "label_choice",
      },
      rubric_config: {
        model: "gpt-4.1-mini",
        scale_size: 2,
        concept: "policy relevance",
      },
      scoring_config: {
        model: "claude-sonnet-4",
        method: "single",
        abstain_enabled: false,
        evidence_view: "l0_raw",
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
    expect(summary.pool_id).toBeUndefined();
    expect(summary.evidence_selected_count).toBe(1);
    expect(summary.window_count).toBe(0);
    expect(summary.rubric_source_kind).toBe("imported_codebook");
    expect(summary.compatibility_mode).toBe("paper_faithful");
    expect(summary.output_contract.parser_key).toBe("label_choice");
  });

  test("lab experiment surfaces expose evidence-set-backed experiment evidence", async () => {
    const t = initTest();

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
      view_kind: "paper_original",
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
          pinned_view_id: imported.evidence_view_id,
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
        rubric_source_kind: "imported_codebook",
        compatibility_mode: "paper_faithful",
        task_contract: {
          task_kind: "label_classification",
          label_space_json: JSON.stringify(["relevant", "irrelevant"]),
          instructions_json: JSON.stringify({
            source: "paper",
          }),
          prompt_template_id: "gilardi_v1",
        },
        output_contract: {
          kind: "label",
          schema_version: "v1",
          parser_key: "label_choice",
        },
        rubric_config: {
          model: "gpt-4.1-mini",
          scale_size: 2,
          concept: "policy relevance",
        },
        scoring_config: {
          model: "claude-sonnet-4",
          method: "single",
          abstain_enabled: false,
          evidence_view: "l0_raw",
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
    expect(evidenceRows[0]?.evidence_view_id).toBe(imported.evidence_view_id);
    expect(evidenceRows[0]?.title).toBe("Lab imported row");
    expect(evidenceRows[0]?.url).toBe("https://example.com/lab-row");
    expect(evidenceRows[0]?.source_name).toBe("Example Source");
  });
});
