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

  test("reports transform coverage and universe-scoped runs", async () => {
    const t = initTest();

    const { universe_id } = await t.mutation(api.packages.evidence.createEvidenceUniverse, {
      universe_tag: "coverage-universe",
      kind: "paper_audit",
      title: "Coverage universe",
    });

    const importedOne = await t.action(api.packages.evidence.importEvidenceItem, {
      universe_id,
      canonical_key: "paper-audit:coverage:001",
      title: "Coverage item one",
      raw_text: "First source text record.",
      source_record_kind: "source_text",
      pipeline_kind: "import",
      pipeline_version: "paper-import-v1",
    });
    const importedTwo = await t.action(api.packages.evidence.importEvidenceItem, {
      universe_id,
      canonical_key: "paper-audit:coverage:002",
      title: "Coverage item two",
      raw_text: "Second source text record.",
      source_record_kind: "source_text",
      pipeline_kind: "import",
      pipeline_version: "paper-import-v1",
    });

    const { evidence_set_id } = await t.mutation(api.packages.evidence.createEvidenceSet, {
      universe_id,
      evidence_set_tag: "coverage-set",
      title: "Coverage set",
      source_kind: "manual_import",
      quality_label: "high",
    });

    await t.mutation(api.packages.evidence.addEvidenceSetItems, {
      evidence_set_id,
      items: [
        {
          evidence_item_id: importedOne.evidence_item_id,
          ordinal: 0,
        },
        {
          evidence_item_id: importedTwo.evidence_item_id,
          ordinal: 1,
        },
      ],
    });

    const initialCoverage = await t.query(
      api.packages.evidence_transform.getEvidenceSetTransformCoverage,
      {
        evidence_set_id,
      },
    );
    expect(initialCoverage.item_count).toBe(2);
    expect(
      initialCoverage.source_record_coverage.find((
        entry: { record_kind: string; available_count: number; missing_count: number; },
      ) => entry.record_kind === "source_text")
        ?.available_count,
    ).toBe(2);
    expect(
      initialCoverage.view_coverage.find((
        entry: {
          view_kind: string;
          completed_count: number;
          error_count: number;
          pending_count: number;
        },
      ) => entry.view_kind === "l1_cleaned")?.pending_count,
    ).toBe(2);

    const { evidence_transform_run_id } = await t.mutation(
      api.packages.evidence_transform.createEvidenceTransformRun,
      {
        evidence_set_id,
        source_record_kind: "source_text",
        target_view_kinds: ["l1_cleaned"],
        model: "claude-sonnet-4",
      },
    );

    const runCatalog = await t.query(api.packages.evidence_transform.listEvidenceTransformRuns, {
      universe_id,
    });
    expect(runCatalog).toHaveLength(1);
    expect(runCatalog[0]?.evidence_set_tag).toBe("coverage-set");

    await t.action(api.packages.evidence_transform.applyEvidenceTransformStageResult, {
      evidence_transform_run_id,
      evidence_item_id: importedOne.evidence_item_id,
      stage: "l1_cleaned",
      output: "VIEW_TEXT:\nCleaned first item.",
    });
    await t.mutation(api.packages.evidence_transform.markEvidenceTransformStageFailure, {
      evidence_transform_run_id,
      evidence_item_id: importedTwo.evidence_item_id,
      stage: "l1_cleaned",
      error_message: "transform failed",
    });

    const finalized = await t.mutation(api.packages.evidence_transform.finalizeEvidenceTransformStage, {
      evidence_transform_run_id,
      stage: "l1_cleaned",
    });
    expect(finalized.completed).toBe(1);
    expect(finalized.failed).toBe(1);

    const finalCoverage = await t.query(
      api.packages.evidence_transform.getEvidenceSetTransformCoverage,
      {
        evidence_set_id,
      },
    );
    const l1Coverage = finalCoverage.view_coverage.find((
      entry: {
        view_kind: string;
        completed_count: number;
        error_count: number;
        pending_count: number;
      },
    ) => entry.view_kind === "l1_cleaned");
    expect(l1Coverage?.completed_count).toBe(1);
    expect(l1Coverage?.error_count).toBe(1);
    expect(l1Coverage?.pending_count).toBe(0);
  });
});
