import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { internal } from "../_generated/api";

function initTest() {
  return convexTest(schema, buildModules());
}

describe("experiment contract", () => {
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
});
