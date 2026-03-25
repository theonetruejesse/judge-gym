import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api } from "../_generated/api";

function initTest() {
  return convexTest(schema, buildModules());
}

describe("evidence transform package", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("builds semantic views from source records in stage order", async () => {
    const t = initTest();

    const { universe_id } = await t.mutation(api.packages.evidence.createEvidenceUniverse, {
      universe_tag: "semantic-transform-universe",
      kind: "paper_audit",
      title: "Semantic transform universe",
    });

    const imported = await t.action(api.packages.evidence.importEvidenceItem, {
      universe_id,
      canonical_key: "paper-audit:001",
      title: "Imported paper excerpt",
      source_url: "https://example.com/paper-audit/001",
      source_name: "Replication archive",
      publish_date: "2026-03-24",
      language: "en",
      raw_text: "The original article used rhetorical framing while describing a concrete executive action.",
      source_record_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "paper-import-v1",
    });

    const { evidence_set_id } = await t.mutation(api.packages.evidence.createEvidenceSet, {
      universe_id,
      evidence_set_tag: "paper-audit-set",
      title: "Paper audit set",
      source_kind: "manual_import",
    });

    await t.mutation(api.packages.evidence.addEvidenceSetItems, {
      evidence_set_id,
      items: [
        {
          evidence_item_id: imported.evidence_item_id,
          ordinal: 0,
        },
      ],
    });

    const { evidence_transform_run_id } = await t.mutation(
      api.packages.evidence_transform.createEvidenceTransformRun,
      {
        evidence_set_id,
        source_record_kind: "paper_original",
        target_view_kinds: ["l1_cleaned", "l2_neutralized"],
        model: "claude-sonnet-4",
      },
    );

    const run = await t.query(api.packages.evidence_transform.getEvidenceTransformRun, {
      evidence_transform_run_id,
    });
    expect(run.total_count).toBe(1);
    expect(run.status).toBe("start");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      "The original article used rhetorical framing while describing a concrete executive action.",
      { status: 200 },
    )));

    const l1Inputs = await t.action(api.packages.evidence_transform.listEvidenceTransformStageInputs, {
      evidence_transform_run_id,
      stage: "l1_cleaned",
    });
    expect(l1Inputs).toHaveLength(1);
    expect(l1Inputs[0]?.user_prompt).toContain("The original article used rhetorical framing");

    await t.action(api.packages.evidence_transform.applyEvidenceTransformStageResult, {
      evidence_transform_run_id,
      evidence_item_id: imported.evidence_item_id,
      stage: "l1_cleaned",
      output: "VIEW_TEXT:\nA cleaned version of the article excerpt.",
    });

    const l1Finalized = await t.mutation(api.packages.evidence_transform.finalizeEvidenceTransformStage, {
      evidence_transform_run_id,
      stage: "l1_cleaned",
    });
    expect(l1Finalized.completed).toBe(1);
    expect(l1Finalized.halt_process).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      "A cleaned version of the article excerpt.",
      { status: 200 },
    )));

    const l2Inputs = await t.action(api.packages.evidence_transform.listEvidenceTransformStageInputs, {
      evidence_transform_run_id,
      stage: "l2_neutralized",
    });
    expect(l2Inputs).toHaveLength(1);
    expect(l2Inputs[0]?.user_prompt).toContain("A cleaned version of the article excerpt.");

    await t.action(api.packages.evidence_transform.applyEvidenceTransformStageResult, {
      evidence_transform_run_id,
      evidence_item_id: imported.evidence_item_id,
      stage: "l2_neutralized",
      output: "VIEW_TEXT:\nA neutral summary of the executive action.",
    });

    const l2Finalized = await t.mutation(api.packages.evidence_transform.finalizeEvidenceTransformStage, {
      evidence_transform_run_id,
      stage: "l2_neutralized",
    });
    expect(l2Finalized.completed).toBe(1);
    expect(l2Finalized.halt_process).toBe(true);

    const finalRun = await t.query(api.packages.evidence_transform.getEvidenceTransformRun, {
      evidence_transform_run_id,
    });
    expect(finalRun.status).toBe("completed");
  });
});
