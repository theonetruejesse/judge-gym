import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

type ConvexTestInstance = ReturnType<typeof convexTest>;

function initTest(): ConvexTestInstance {
  return convexTest(schema, buildModules());
}

async function seedRun(
  t: ConvexTestInstance,
): Promise<{
  run_id: Id<"runs">;
  sample_ids: Id<"samples">[];
  score_targets_by_sample: Map<string, string[]>;
}> {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: "gpt-4.1-mini",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "partial-failure-cleanup",
      target_count: 2,
    },
  );

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id,
    evidences: [
      {
        title: "Evidence 1",
        url: "https://example.com/e1",
        raw_content: "Evidence one raw content.",
      },
      {
        title: "Evidence 2",
        url: "https://example.com/e2",
        raw_content: "Evidence two raw content.",
      },
    ],
  });

  const evidenceRows = await t.query(api.packages.lab.listEvidenceByWindow, { window_id });
  const pool = await t.mutation(api.packages.lab.createPool, {
    evidence_ids: evidenceRows.map((row: { evidence_id: Id<"evidences"> }) => row.evidence_id),
    pool_tag: "partial_failure_pool",
  });

  const { experiment_id } = await t.mutation(api.packages.lab.initExperiment, {
    pool_id: pool.pool_id,
    experiment_config: {
      rubric_config: {
        model: "gpt-4.1",
        scale_size: 4,
        concept: "fascism",
      },
      scoring_config: {
        model: "gpt-4.1",
        method: "subset",
        abstain_enabled: true,
        evidence_view: "l2_neutralized",
        randomizations: [],
        evidence_bundle_size: 1,
      },
    },
  });

  const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
    experiment_id,
    target_count: 2,
  });

  const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });
  const sample_ids = Array.from(
    new Set(
      scoreTargets.map(
        (target: {
          sample_id: Id<"samples">;
          score_target_id: Id<"sample_score_targets">;
        }) => String(target.sample_id),
      ),
    ),
  ) as unknown as Id<"samples">[];
  const score_targets_by_sample = new Map<string, string[]>();
  for (const target of scoreTargets as {
    sample_id: Id<"samples">;
    score_target_id: Id<"sample_score_targets">;
  }[]) {
    const current = score_targets_by_sample.get(String(target.sample_id)) ?? [];
    current.push(String(target.score_target_id));
    score_targets_by_sample.set(String(target.sample_id), current);
  }

  return {
    run_id,
    sample_ids,
    score_targets_by_sample,
  };
}

async function startAttempt(
  t: ConvexTestInstance,
  args: {
    run_id: Id<"runs">;
    target_type: "sample" | "sample_score_target";
    target_id: string;
    stage: "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic";
  },
) {
  return t.mutation(api.packages.worker.recordLlmAttemptStart, {
    process_kind: "run",
    process_id: String(args.run_id),
    target_type: args.target_type,
    target_id: args.target_id,
    stage: args.stage,
    provider: "openai",
    model: "gpt-4.1",
    operation_type: "chat",
    workflow_id: `run:${args.run_id}`,
    system_prompt: "system",
    user_prompt: "user",
    metadata_json: null,
  });
}

describe("run partial failure progression", () => {
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

  test("partial rubric failures continue with surviving samples and close blocked downstream targets", async () => {
    const t = initTest();
    const { run_id, sample_ids, score_targets_by_sample } = await seedRun(t);
    expect(sample_ids).toHaveLength(2);

    const failedSampleId = sample_ids[0]!;
    const succeededSampleId = sample_ids[1]!;

    const failedAttempt = await startAttempt(t, {
      run_id,
      target_type: "sample",
      target_id: String(failedSampleId),
      stage: "rubric_gen",
    });
    await t.mutation(api.packages.worker.markRunStageFailure, {
      run_id,
      target_id: String(failedSampleId),
      stage: "rubric_gen",
      attempt_id: failedAttempt.attempt_id,
      error_message: "rubric generation failed",
    });

    const successAttempt = await startAttempt(t, {
      run_id,
      target_type: "sample",
      target_id: String(succeededSampleId),
      stage: "rubric_gen",
    });
    await t.mutation(api.packages.worker.applyRunStageResult, {
      run_id,
      target_id: String(succeededSampleId),
      stage: "rubric_gen",
      attempt_id: successAttempt.attempt_id,
      output: [
        "Step 1: Use only observable signals.",
        "RUBRIC:",
        "1) Minimal or Indirect Signal :: One; Two; Three",
        "2) Weak or Isolated Features :: Four; Five; Six",
        "3) Clear but Limited Pattern :: Seven; Eight; Nine",
        "4) Extensive or Overt Signal :: Ten; Eleven; Twelve",
      ].join("\n"),
    });

    const finalized = await t.mutation(api.packages.worker.finalizeRunStage, {
      run_id,
      stage: "rubric_gen",
    });
    expect(finalized.completed).toBe(1);
    expect(finalized.failed).toBe(1);
    expect(finalized.has_pending).toBe(false);
    expect(finalized.halt_process).toBe(false);

    const rubricCriticInputs = await t.query(api.packages.worker.listRunStageInputs, {
      run_id,
      stage: "rubric_critic",
    });
    expect(rubricCriticInputs).toHaveLength(1);
    expect(rubricCriticInputs[0]?.target_id).toBe(String(succeededSampleId));

    const runSummary = await t.query(api.packages.lab.getRunSummary, { run_id });
    expect(runSummary.has_failures).toBe(true);
    expect(runSummary.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "rubric_gen",
          completed: 1,
          failed: 1,
          status: "completed",
        }),
        expect.objectContaining({
          stage: "rubric_critic",
          completed: 0,
          failed: 1,
          status: "running",
        }),
        expect.objectContaining({
          stage: "score_gen",
          completed: 0,
          failed: score_targets_by_sample.get(String(failedSampleId))?.length ?? 0,
          status: "running",
        }),
        expect.objectContaining({
          stage: "score_critic",
          completed: 0,
          failed: score_targets_by_sample.get(String(failedSampleId))?.length ?? 0,
          status: "running",
        }),
      ]),
    );

    const diagnostics = await t.query(api.packages.lab.getRunDiagnostics, { run_id });
    expect(diagnostics.terminal_failed_target_summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "rubric_gen",
          count: 1,
        }),
        expect.objectContaining({
          stage: "rubric_critic",
          count: 1,
        }),
      ]),
    );
  });
});
