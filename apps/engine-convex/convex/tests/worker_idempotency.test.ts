import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

function initTest() {
  return convexTest(schema, buildModules());
}

async function seedWindow(t: ReturnType<typeof convexTest>) {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      window_tag: "idempotency_window",
      country: "USA",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "idempotency",
      default_target_count: 1,
      default_target_stage: "l3_abstracted",
    },
  );

  const { window_run_id } = await t.mutation(
    internal.domain.window.window_repo.createWindowRun,
    {
      window_id,
      model: "gpt-4.1-mini",
      target_count: 1,
      target_stage: "l3_abstracted",
    },
  );

  return { window_id, window_run_id };
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
    vi.unstubAllGlobals();
  });

  test("reuses attempt rows for the same attempt key and finish is idempotent", async () => {
    const t = initTest();
    const { window_run_id } = await seedWindow(t);

    const first = await t.mutation(api.packages.worker.recordLlmAttemptStart, {
      attempt_key: "window:test:l1:evidence_1:attempt:1",
      process_kind: "window",
      process_id: String(window_run_id),
      target_type: "evidence",
      target_id: "evidence_1",
      stage: "l1_cleaned",
      provider: "openai",
      model: "gpt-4.1-mini",
      operation_type: "chat",
      workflow_id: `window:${window_run_id}`,
      system_prompt: "system",
      user_prompt: "user",
      metadata_json: null,
    });
    const second = await t.mutation(api.packages.worker.recordLlmAttemptStart, {
      attempt_key: "window:test:l1:evidence_1:attempt:1",
      process_kind: "window",
      process_id: String(window_run_id),
      target_type: "evidence",
      target_id: "evidence_1",
      stage: "l1_cleaned",
      provider: "openai",
      model: "gpt-4.1-mini",
      operation_type: "chat",
      workflow_id: `window:${window_run_id}`,
      system_prompt: "system",
      user_prompt: "user",
      metadata_json: null,
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
  });

  test("dedupes repeated evidence inserts for the same window run", async () => {
    const t = initTest();
    const { window_run_id } = await seedWindow(t);

    const first = await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_run_id,
      evidences: [{
        title: "Story 1",
        url: "https://example.com/story-1",
        raw_content: "raw 1",
      }],
    });
    const second = await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_run_id,
      evidences: [{
        title: "Story 1",
        url: "https://example.com/story-1",
        raw_content: "raw 1",
      }],
    });

    expect(first.inserted).toBe(1);
    expect(second.inserted).toBe(0);
    expect(second.total).toBe(1);
  });

  test("applying l3 twice is a no-op and does not double-increment completed_count", async () => {
    const t = initTest();
    const { window_run_id } = await seedWindow(t);
    await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_run_id,
      evidences: [{
        title: "Story 1",
        url: "https://example.com/story-1",
        raw_content: "raw 1",
      }],
    });

    const evidenceRows = await t.query(api.packages.lab.listEvidenceByWindowRun, {
      window_run_id,
    });
    const evidence_id = evidenceRows[0]!.evidence_id as Id<"evidences">;
    const attempt = await t.mutation(api.packages.worker.recordLlmAttemptStart, {
      attempt_key: "window:test:l3:evidence_1:attempt:1",
      process_kind: "window",
      process_id: String(window_run_id),
      target_type: "evidence",
      target_id: String(evidence_id),
      stage: "l3_abstracted",
      provider: "openai",
      model: "gpt-4.1-mini",
      operation_type: "chat",
      workflow_id: `window:${window_run_id}`,
      system_prompt: "system",
      user_prompt: "user",
      metadata_json: null,
    });

    await t.mutation(api.packages.worker.applyWindowStageResult, {
      window_run_id,
      evidence_id,
      stage: "l3_abstracted",
      attempt_id: attempt.attempt_id,
      output: "abstracted",
    });
    await t.mutation(api.packages.worker.applyWindowStageResult, {
      window_run_id,
      evidence_id,
      stage: "l3_abstracted",
      attempt_id: attempt.attempt_id,
      output: "abstracted",
    });

    const windowRun = await t.query(internal.domain.window.window_repo.getWindowRun, {
      window_run_id,
    });
    expect(windowRun.completed_count).toBe(1);
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
});
