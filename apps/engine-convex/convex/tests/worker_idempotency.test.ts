import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

function initTest() {
  return convexTest(schema, buildModules());
}

async function seedRun(t: ReturnType<typeof convexTest>) {
  const { universe_id } = await t.mutation(
    internal.domain.evidence.evidence_repo.createUniverse,
    {
      universe_tag: "worker-idempotency-universe",
      kind: "paper_audit",
      title: "worker-idempotency-universe",
    },
  );

  const imported = await t.action(
    internal.domain.evidence.evidence_service.importEvidenceItem,
    {
      universe_id,
      canonical_key: "worker-idempotency:item:1",
      title: "Run Evidence 1",
      source_url: "https://example.com/run-e1",
      raw_text: "Run evidence one raw content.",
      view_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "worker-idempotency-v4",
    },
  );

  const { evidence_set_id } = await t.mutation(
    internal.domain.evidence.evidence_repo.createEvidenceSet,
    {
      universe_id,
      evidence_set_tag: "worker-idempotency-set",
      title: "worker-idempotency-set",
      source_kind: "manual_import",
      quality_label: "high",
    },
  );

  await t.mutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, {
    evidence_set_id,
    items: [{
      evidence_item_id: imported.evidence_item_id,
      pinned_view_id: imported.evidence_view_id,
      quality_label: "high",
    }],
  });

  const { experiment_id } = await t.mutation(api.packages.lab.initExperiment, {
    evidence_set_id,
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
        evidence_view: "l0_raw",
        randomizations: [],
        evidence_bundle_size: 1,
      },
    },
  });

  const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
    experiment_id,
    target_count: 1,
  });

  const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });
  const firstTarget = scoreTargets[0]!;

  return {
    run_id,
    sample_id: firstTarget.sample_id,
    score_target_id: firstTarget.score_target_id,
  };
}

async function startRunAttempt(
  t: ReturnType<typeof convexTest>,
  args: {
    run_id: Id<"runs">;
    target_type: "sample" | "sample_score_target";
    target_id: string;
    stage: "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic";
    attempt_key: string;
  },
) {
  return t.mutation(api.packages.worker.recordLlmAttemptStart, {
    attempt_key: args.attempt_key,
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

describe("worker mutation idempotency", () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("reuses attempt rows for the same attempt key and finish is idempotent", async () => {
    const t = initTest();
    const { run_id, sample_id } = await seedRun(t);

    const first = await startRunAttempt(t, {
      run_id,
      target_type: "sample",
      target_id: String(sample_id),
      stage: "rubric_gen",
      attempt_key: "run:test:rubric_gen:sample_1:attempt:1",
    });
    const second = await startRunAttempt(t, {
      run_id,
      target_type: "sample",
      target_id: String(sample_id),
      stage: "rubric_gen",
      attempt_key: "run:test:rubric_gen:sample_1:attempt:1",
    });

    expect(second.attempt_id).toBe(first.attempt_id);

    await t.mutation(api.packages.worker.recordLlmAttemptFinish, {
      attempt_id: first.attempt_id,
      status: "succeeded",
      assistant_output: "ok",
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
    });
    await t.mutation(api.packages.worker.recordLlmAttemptFinish, {
      attempt_id: first.attempt_id,
      status: "succeeded",
      assistant_output: "ok",
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
    });

    expect(second.attempt_id).toBe(first.attempt_id);
  }, 15_000);

  test("drops late attempt finish callbacks after reset cleanup removes the attempt row", async () => {
    const t = initTest();
    const { run_id, sample_id } = await seedRun(t);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const attempt = await startRunAttempt(t, {
      run_id,
      target_type: "sample",
      target_id: String(sample_id),
      stage: "rubric_gen",
      attempt_key: "run:test:rubric_gen:sample_1:late_finish",
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(attempt.attempt_id);
    });

    await expect(t.mutation(api.packages.worker.recordLlmAttemptFinish, {
      attempt_id: attempt.attempt_id,
      status: "succeeded",
      assistant_output: "ok",
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
    })).resolves.toBeNull();

    expect(warnSpy).toHaveBeenCalledWith(
      "worker_record_llm_attempt_finish_missing_attempt",
      expect.stringContaining(String(attempt.attempt_id)),
    );
    warnSpy.mockRestore();
  });

  test("reuses batch execution rows for the same batch key", async () => {
    const t = initTest();
    const first = await t.mutation(api.packages.worker.ensureBatchExecution, {
      batch_key: "batch:key:1",
      process_kind: "run",
      process_id: "run_1",
      stage: "rubric_gen",
      provider: "openai",
      model: "gpt-4.1",
      workflow_id: "run:run_1",
      item_count: 10,
    });
    const second = await t.mutation(api.packages.worker.ensureBatchExecution, {
      batch_key: "batch:key:1",
      process_kind: "run",
      process_id: "run_1",
      stage: "rubric_gen",
      provider: "openai",
      model: "gpt-4.1",
      workflow_id: "run:run_1",
      item_count: 10,
    });

    expect(second.batch_execution_id).toBe(first.batch_execution_id);
  });

  test("persists batch preparation checkpoints on the existing batch execution row", async () => {
    const t = initTest();
    const created = await t.mutation(api.packages.worker.ensureBatchExecution, {
      batch_key: "batch:key:checkpoint",
      process_kind: "run",
      process_id: "run_checkpoint",
      stage: "score_gen",
      provider: "openai",
      model: "gpt-4.1",
      workflow_id: "run:run_checkpoint",
      item_count: 17,
    });

    await t.mutation(api.packages.worker.recordBatchExecutionPreparationProgress, {
      batch_execution_id: created.batch_execution_id,
      attempt_recorded_count: 16,
      attempt_records_json: JSON.stringify([
        ["target_1", "attempt_target_1"],
        ["target_2", "attempt_target_2"],
      ]),
    });

    const existing = await t.mutation(api.packages.worker.ensureBatchExecution, {
      batch_key: "batch:key:checkpoint",
      process_kind: "run",
      process_id: "run_checkpoint",
      stage: "score_gen",
      provider: "openai",
      model: "gpt-4.1",
      workflow_id: "run:run_checkpoint",
      item_count: 17,
    });
    const queried = await t.query(api.packages.worker.getBatchExecution, {
      batch_key: "batch:key:checkpoint",
    });

    expect(existing.batch_execution_id).toBe(created.batch_execution_id);
    expect(existing.attempt_recorded_count).toBe(16);
    expect(existing.attempt_records_json).toBe(JSON.stringify([
      ["target_1", "attempt_target_1"],
      ["target_2", "attempt_target_2"],
    ]));
    expect(queried).toMatchObject({
      batch_execution_id: created.batch_execution_id,
      attempt_recorded_count: 16,
      attempt_records_json: JSON.stringify([
        ["target_1", "attempt_target_1"],
        ["target_2", "attempt_target_2"],
      ]),
    });
  });

  test("persists provider-specific batch artifacts on the batch execution row", async () => {
    const t = initTest();
    const created = await t.mutation(api.packages.worker.ensureBatchExecution, {
      batch_key: "batch:key:artifacts",
      process_kind: "run",
      process_id: "run_artifacts",
      stage: "score_gen",
      provider: "anthropic",
      model: "claude-sonnet-4",
      workflow_id: "run:run_artifacts",
      item_count: 3,
    });

    await t.mutation(api.packages.worker.bindBatchExecutionSubmitted, {
      batch_execution_id: created.batch_execution_id,
      provider_batch_id: "msgbatch_artifacts",
      provider_status: "in_progress",
    });
    await t.mutation(api.packages.worker.finalizeBatchExecution, {
      batch_execution_id: created.batch_execution_id,
      status: "completed",
      provider_status: "ended",
      provider_artifacts_json: JSON.stringify({
        results_url: "https://api.anthropic.com/v1/messages/batches/msgbatch_artifacts/results",
      }),
    });

    const queried = await t.query(api.packages.worker.getBatchExecution, {
      batch_key: "batch:key:artifacts",
    });

    expect(queried).toMatchObject({
      batch_execution_id: created.batch_execution_id,
      provider_batch_id: "msgbatch_artifacts",
      status: "completed",
      provider_artifacts_json: JSON.stringify({
        results_url: "https://api.anthropic.com/v1/messages/batches/msgbatch_artifacts/results",
      }),
    });
  });

  test("infers run ids from workflow ids when snapshots omit processId", async () => {
    const t = initTest();
    const { run_id } = await seedRun(t);

    await expect(t.mutation(api.packages.worker.projectProcessState, {
      processKind: "run",
      workflowId: `run:${run_id}`,
      workflowRunId: "inferred-process-id-test",
      workflowType: "RunWorkflow",
      executionStatus: "running",
      stage: "rubric_gen",
      stageStatus: "running",
      pauseAfter: null,
      stageHistory: ["rubric_gen"],
      lastControlCommandId: null,
      lastErrorMessage: null,
    })).resolves.toBeNull();

    const run = await t.query(internal.domain.runs.run_repo.getRun, { run_id });
    expect(run.status).toBe("running");
    expect(run.current_stage).toBe("rubric_gen");
  });

  test("drops late process projection callbacks after reset cleanup removes the run row", async () => {
    const t = initTest();
    const { run_id } = await seedRun(t);

    await t.run(async (ctx) => {
      await ctx.db.delete(run_id);
    });

    await expect(t.mutation(api.packages.worker.projectProcessState, {
      processKind: "run",
      workflowId: `run:${run_id}`,
      workflowRunId: "late-callback-test",
      workflowType: "RunWorkflow",
      executionStatus: "running",
      stage: "rubric_gen",
      stageStatus: "running",
      pauseAfter: null,
      stageHistory: ["rubric_gen"],
      lastControlCommandId: null,
      lastErrorMessage: null,
    })).resolves.toBeNull();

    const observability = await t.query(
      internal.domain.telemetry.events.getProcessObservability,
      {
        process_type: "run",
        process_id: String(run_id),
      },
    );

    expect(observability?.last_event_name).toBe("process_projection_skipped_missing_target");
    expect(observability?.last_status).toBe("error");
    expect(observability?.recent_events.at(-1)?.payload_json).toContain("\"reason\":\"run_missing\"");
  });

  test("drops late run-stage apply callbacks after reset cleanup removes the run row", async () => {
    const t = initTest();
    const { run_id, sample_id } = await seedRun(t);

    const attempt = await startRunAttempt(t, {
      run_id,
      target_type: "sample",
      target_id: String(sample_id),
      stage: "rubric_gen",
      attempt_key: "run:test:rubric_gen:late_apply",
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(run_id);
    });

    await expect(t.mutation(api.packages.worker.applyRunStageResult, {
      run_id,
      target_id: String(sample_id),
      stage: "rubric_gen",
      attempt_id: attempt.attempt_id,
      output: [
        "REASONING: signal",
        "1) Weak or Isolated Features :: criterion one; criterion two",
        "2) Coordinated Authoritarian Moves :: criterion three; criterion four",
        "3) Systemic Democratic Erosion :: criterion five; criterion six",
        "4) Consolidated Fascist Control :: criterion seven; criterion eight",
      ].join("\n"),
    })).resolves.toBeNull();

    const observability = await t.query(
      internal.domain.telemetry.events.getProcessObservability,
      {
        process_type: "run",
        process_id: String(run_id),
      },
    );

    expect(observability?.last_event_name).toBe("run_stage_result_skipped_missing_target");
    expect(observability?.last_status).toBe("error");
    expect(observability?.recent_events.at(-1)?.payload_json).toContain("\"reason\":\"run_missing\"");
  });

  test("drops late run-stage failure callbacks after reset cleanup removes the score target row", async () => {
    const t = initTest();
    const { run_id, score_target_id } = await seedRun(t);

    const attempt = await startRunAttempt(t, {
      run_id,
      target_type: "sample_score_target",
      target_id: String(score_target_id),
      stage: "score_gen",
      attempt_key: "run:test:score_gen:late_failure",
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(score_target_id);
    });

    await expect(t.mutation(api.packages.worker.markRunStageFailure, {
      run_id,
      target_id: String(score_target_id),
      stage: "score_gen",
      attempt_id: attempt.attempt_id,
      error_message: "late callback after reset cleanup",
    })).resolves.toBeNull();

    const observability = await t.query(
      internal.domain.telemetry.events.getProcessObservability,
      {
        process_type: "run",
        process_id: String(run_id),
      },
    );

    expect(observability?.last_event_name).toBe("run_stage_failure_skipped_missing_target");
    expect(observability?.last_status).toBe("error");
    expect(observability?.recent_events.at(-1)?.payload_json)
      .toContain("\"reason\":\"score_target_missing\"");
  });
});
