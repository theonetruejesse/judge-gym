import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildModules } from "./test.setup";

type ConvexTestInstance = ReturnType<typeof convexTest>;

function initTest(): ConvexTestInstance {
  return convexTest(schema, buildModules());
}

async function seedEvidenceSet(
  t: ConvexTestInstance,
  args: {
    universe_tag: string;
    evidence_set_tag: string;
    itemCount: number;
  },
) {
  const { universe_id } = await t.mutation(internal.domain.evidence.evidence_repo.createUniverse, {
    universe_tag: args.universe_tag,
    kind: "paper_audit",
    title: args.universe_tag,
  });

  const importedItems = [] as Array<Awaited<ReturnType<ConvexTestInstance["action"]>>>;
  for (let index = 0; index < args.itemCount; index += 1) {
    const imported = await t.action(
      internal.domain.evidence.evidence_service.importEvidenceItem,
      {
        universe_id,
        canonical_key: `${args.universe_tag}:item:${index + 1}`,
        title: `Imported item ${index + 1}`,
        source_url: `https://example.com/imported/${index + 1}`,
        raw_text: `Imported evidence text ${index + 1}.`,
        source_record_kind: "paper_original",
        pipeline_kind: "import",
        pipeline_version: "v4-test",
      },
    );
    importedItems.push(imported);
  }

  const { evidence_set_id } = await t.mutation(
    internal.domain.evidence.evidence_repo.createEvidenceSet,
    {
      universe_id,
      evidence_set_tag: args.evidence_set_tag,
      title: args.evidence_set_tag,
      source_kind: "literature_dataset",
      quality_label: "high",
    },
  );

  await t.mutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, {
    evidence_set_id,
    items: importedItems.map((item, index) => ({
      evidence_item_id: item.evidence_item_id,
      pinned_source_record_id: item.source_record_id,
      ordinal: index,
      quality_label: "high" as const,
    })),
  });

  return {
    universe_id,
    evidence_set_id,
    importedItems,
  };
}

async function createV4Experiment(
  t: ConvexTestInstance,
  evidence_set_id: Id<"evidence_sets">,
  evidence_bundle_size: number,
) {
  return t.mutation(internal.domain.runs.experiments_repo.createExperiment, {
    experiment_tag: `v4_run_${evidence_bundle_size}_${Math.random().toString(16).slice(2)}`,
    evidence_set_id,
    study_kind: "paper_audit",
    evidence_source_kind: "evidence_set",
    rubric_source_kind: "imported_codebook",
    compatibility_mode: "paper_faithful",
    task_contract: {
      task_kind: "label_classification",
      label_space_json: JSON.stringify(["relevant", "irrelevant"]),
      instructions_json: JSON.stringify({
        source: "test",
      }),
      prompt_template_id: "v4_test_prompt",
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
      evidence_view: "paper_original",
      randomizations: [],
      evidence_bundle_size,
    },
  });
}

describe("v4 run substrate", () => {
  const originalDataset = process.env.AXIOM_DATASET;
  const originalToken = process.env.AXIOM_TOKEN;
  const originalSkipExport = process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT;

  beforeEach(() => {
    process.env.AXIOM_DATASET = "judge-gym-test";
    process.env.AXIOM_TOKEN = "test-token";
    process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT = "1";
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

  test("createRun materializes evidence-set-backed score targets with item and source refs", async () => {
    const t = initTest();
    const seeded = await seedEvidenceSet(t, {
      universe_tag: "v4-run-bundles",
      evidence_set_tag: "v4-run-bundles-set",
      itemCount: 3,
    });
    const experiment_id = await createV4Experiment(t, seeded.evidence_set_id, 2);

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 2,
    });

    const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });
    expect(scoreTargets).toHaveLength(4);

    const groupedBySample = new Map<string, typeof scoreTargets>();
    for (const target of scoreTargets) {
      const current = groupedBySample.get(String(target.sample_id)) ?? [];
      current.push(target);
      groupedBySample.set(String(target.sample_id), current);
    }

    expect(groupedBySample.size).toBe(2);
    for (const targets of groupedBySample.values()) {
      expect(targets).toHaveLength(2);
      expect(targets[0]?.items).toHaveLength(2);
      expect(targets[1]?.items).toHaveLength(1);
      for (const item of targets.flatMap((target: typeof targets[number]) => target.items)) {
        expect(item.evidence_item_id).toBeDefined();
        expect(item.evidence_source_record_id).toBeDefined();
        expect(item.title).toMatch(/Imported item/);
        expect(item.url).toMatch(/^https:\/\/example\.com\/imported\//);
      }
    }
  });

  test("score stage inputs load evidence text from storage-backed assets", async () => {
    const t = initTest();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Storage-backed evidence text.", {
      status: 200,
    })));

    const seeded = await seedEvidenceSet(t, {
      universe_tag: "v4-stage-inputs",
      evidence_set_tag: "v4-stage-inputs-set",
      itemCount: 1,
    });
    const experiment_id = await createV4Experiment(t, seeded.evidence_set_id, 1);
    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 1,
    });

    const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });
    const sample_id = scoreTargets[0]?.sample_id;
    expect(sample_id).toBeDefined();

    const attempt = await t.mutation(api.packages.worker.recordLlmAttemptStart, {
      process_kind: "run",
      process_id: String(run_id),
      target_type: "sample",
      target_id: String(sample_id),
      stage: "rubric_gen",
      provider: "openai",
      model: "gpt-4.1-mini",
      operation_type: "chat",
      workflow_id: `run:${run_id}`,
      system_prompt: "system",
      user_prompt: "user",
      metadata_json: null,
    });

    await t.mutation(api.packages.worker.applyRunStageResult, {
      run_id,
      target_id: String(sample_id),
      stage: "rubric_gen",
      attempt_id: attempt.attempt_id,
      output: [
        "Step 1: stay within provided evidence.",
        "RUBRIC:",
        "1) Irrelevant :: Not relevant; Not relevant; Not relevant",
        "2) Relevant :: Relevant; Relevant; Relevant",
      ].join("\n"),
    });

    const inputs = await t.action(api.packages.worker.listRunStageInputs, {
      run_id,
      stage: "score_gen",
    });

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.target_type).toBe("sample_score_target");
    expect(`${inputs[0]?.system_prompt}\n${inputs[0]?.user_prompt}`).toContain("Storage-backed evidence text.");
    expect(inputs[0]?.metadata_json).toContain("score_target_id");
  });
});
