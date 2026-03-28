import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";

function initTest() {
  return convexTest(schema, buildModules());
}

describe("evidence catalog cleanup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("patches duplicate evidence-set references onto the canonical universe and set", async () => {
    const t = initTest();

    const canonicalUniverse = await t.mutation(
      internal.domain.evidence.evidence_repo.createUniverse,
      {
        universe_tag: "gilardi_relevance_v1",
        kind: "paper_audit",
        title: "Canonical universe",
      },
    );
    const duplicateUniverse = await t.mutation(
      internal.domain.evidence.evidence_repo.createUniverse,
      {
        universe_tag: "gilardi_relevance_v1",
        kind: "paper_audit",
        title: "Duplicate universe",
      },
    );

    const imported = await t.action(api.packages.evidence.importEvidenceItem, {
      universe_id: canonicalUniverse.universe_id,
      canonical_key: "gilardi:item:001",
      title: "Canonical Gilardi row",
      raw_text: "Canonical Gilardi row text.",
      source_record_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "test-v1",
    });

    const canonicalSet = await t.mutation(
      internal.domain.evidence.evidence_repo.createEvidenceSet,
      {
        universe_id: canonicalUniverse.universe_id,
        evidence_set_tag: "gilardi_relevance_v1_canary_set",
        title: "Canonical canary set",
        source_kind: "literature_dataset",
        quality_label: "high",
      },
    );
    await t.mutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, {
      evidence_set_id: canonicalSet.evidence_set_id,
      items: [
        {
          evidence_item_id: imported.evidence_item_id,
          pinned_source_record_id: imported.source_record_id,
          ordinal: 0,
          quality_label: "high",
        },
      ],
    });

    const duplicateSet = await t.mutation(
      internal.domain.evidence.evidence_repo.createEvidenceSet,
      {
        universe_id: duplicateUniverse.universe_id,
        evidence_set_tag: "gilardi_relevance_v1_canary_set",
        title: "Duplicate canary set",
        source_kind: "literature_dataset",
        quality_label: "high",
      },
    );
    await t.mutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, {
      evidence_set_id: duplicateSet.evidence_set_id,
      items: [
        {
          evidence_item_id: imported.evidence_item_id,
          pinned_source_record_id: imported.source_record_id,
          ordinal: 0,
          quality_label: "high",
        },
      ],
    });

    const experimentId = await t.mutation(
      internal.domain.runs.experiments_repo.createExperiment,
      {
        experiment_tag: "gilardi_relevance_v1_canary_gpt41",
        evidence_set_id: duplicateSet.evidence_set_id,
        study_kind: "paper_audit",
        evidence_source_kind: "evidence_set",
        compatibility_mode: "paper_faithful",
        rubric_source_kind: "direct_labels",
        task_contract: {
          task_kind: "label_classification",
          label_space_json: JSON.stringify(["relevant", "irrelevant"]),
          instructions_json: JSON.stringify({ source: "test" }),
          prompt_template_id: "gilardi_relevance_v1",
        },
        output_contract: {
          kind: "label",
          schema_version: "v1",
          parser_key: "freeform_label_choice",
        },
        rubric_config: {
          model: "gpt-4.1",
          scale_size: 2,
          concept: "policy relevance",
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
    );

    const dryRun = await t.action(api.packages.codex.cleanupDuplicateEvidenceCatalogRows, {
      universe_tag: "gilardi_relevance_v1",
      evidence_set_tag: "gilardi_relevance_v1_canary_set",
      dry_run: true,
    });

    expect(dryRun.kept_universe_id).toBe(canonicalUniverse.universe_id);
    expect(dryRun.kept_evidence_set_id).toBe(canonicalSet.evidence_set_id);
    expect(dryRun.patched_experiment_ids).toEqual([experimentId]);
    expect(dryRun.deleted_evidence_set_ids).toEqual([duplicateSet.evidence_set_id]);
    expect(dryRun.deleted_universe_ids).toEqual([duplicateUniverse.universe_id]);
    expect(dryRun.deleted_evidence_set_item_count).toBe(1);

    const applied = await t.action(api.packages.codex.cleanupDuplicateEvidenceCatalogRows, {
      universe_tag: "gilardi_relevance_v1",
      evidence_set_tag: "gilardi_relevance_v1_canary_set",
      dry_run: false,
    });

    expect(applied.kept_universe_id).toBe(canonicalUniverse.universe_id);
    expect(applied.kept_evidence_set_id).toBe(canonicalSet.evidence_set_id);

    const experiment = await t.query(internal.domain.runs.experiments_service.getExperimentSummary, {
      experiment_id: experimentId,
    });
    expect(experiment.evidence_set_id).toBe(canonicalSet.evidence_set_id);

    const remainingSets = await t.query(api.packages.evidence.listEvidenceSets, {});
    expect(remainingSets.map((row: (typeof remainingSets)[number]) => row.evidence_set_id)).toEqual([
      canonicalSet.evidence_set_id,
    ]);

    const remainingUniverses = await t.query(api.packages.evidence.listEvidenceUniverses, {});
    expect(
      remainingUniverses.map((row: (typeof remainingUniverses)[number]) => row.universe_id),
    ).toEqual([canonicalUniverse.universe_id]);
  });
});
