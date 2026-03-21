import assert from "assert";
import { describe, it } from "mocha";
import { runWindowStageActivityWithDeps } from "../window/service";

function buildQuota() {
  return {
    reserve: async () => ({
      allowed: true,
      reservationId: "reservation_1",
      bucketKeys: ["quota:test"],
      dimensions: { requests: 1 },
    }),
    settle: async () => undefined,
  };
}

function buildWindowContext() {
  return {
    window_run_id: "window_run_123",
    window_id: "window_123",
    workflow_id: "window:window_run_123",
    workflow_run_id: "run_abc",
    status: "running",
    current_stage: "l0_raw",
    pause_after: null,
    target_stage: "l3_abstracted",
    target_count: 2,
    completed_count: 0,
    model: "gpt-4.1-mini",
    start_date: "2026-03-01",
    end_date: "2026-03-02",
    country: "USA",
    query: "window workflow test",
  };
}

describe("window stage service", () => {
  it("halts the workflow when collection finds no evidence", async () => {
    let markedNoEvidence = 0;

    const result = await runWindowStageActivityWithDeps(
      {
        convex: {
          getWindowExecutionContext: async () => buildWindowContext(),
          insertWindowEvidenceBatch: async () => {
            throw new Error("insert should not be called");
          },
          listWindowStageInputs: async () => [],
          recordLlmAttemptStart: async () => ({ attempt_id: "attempt_1" }),
          recordLlmAttemptFinish: async () => null,
          applyWindowStageResult: async () => null,
          markWindowStageFailure: async () => null,
          markWindowNoEvidence: async () => {
            markedNoEvidence += 1;
            return null;
          },
          markWindowProcessError: async () => null,
        },
        searchWindowEvidence: async () => [],
        runOpenAiChat: async () => {
          throw new Error("chat should not be called in collect stage");
        },
        quota: buildQuota(),
      },
      "window_run_123",
      "collect",
    );

    assert.equal(markedNoEvidence, 1);
    assert.equal(result.haltProcess, true);
    assert.equal(result.terminalExecutionStatus, "completed");
  });

  it("records successful stage attempts and applies results", async () => {
    const calls: string[] = [];

    const result = await runWindowStageActivityWithDeps(
      {
        quota: buildQuota(),
        convex: {
          getWindowExecutionContext: async () => buildWindowContext(),
          insertWindowEvidenceBatch: async () => ({ inserted: 0, total: 0 }),
          listWindowStageInputs: async () => [
            {
              evidence_id: "evidence_1",
              title: "Evidence 1",
              url: "https://example.com/1",
              input: "raw article",
            },
          ],
          recordLlmAttemptStart: async () => {
            calls.push("start");
            return { attempt_id: "attempt_1" };
          },
          recordLlmAttemptFinish: async () => {
            calls.push("finish");
            return null;
          },
          applyWindowStageResult: async () => {
            calls.push("apply");
            return null;
          },
          markWindowStageFailure: async () => {
            calls.push("fail");
            return null;
          },
          markWindowNoEvidence: async () => null,
          markWindowProcessError: async () => null,
        },
        searchWindowEvidence: async () => [],
        runOpenAiChat: async () => ({
          assistant_output: "cleaned article",
          input_tokens: 10,
          output_tokens: 4,
          total_tokens: 14,
        }),
      },
      "window_run_123",
      "l1_cleaned",
    );

    assert.deepEqual(calls, ["start", "finish", "apply"]);
    assert.equal(result.haltProcess, undefined);
    assert.equal(result.summary, "window_stage:l1_cleaned:success=1:failed=0");
  });

  it("halts the workflow when every attempt in a stage fails", async () => {
    let processError: string | null = null;

    const result = await runWindowStageActivityWithDeps(
      {
        quota: buildQuota(),
        convex: {
          getWindowExecutionContext: async () => buildWindowContext(),
          insertWindowEvidenceBatch: async () => ({ inserted: 0, total: 0 }),
          listWindowStageInputs: async () => [
            {
              evidence_id: "evidence_1",
              title: "Evidence 1",
              url: "https://example.com/1",
              input: "raw article",
            },
          ],
          recordLlmAttemptStart: async () => ({ attempt_id: "attempt_1" }),
          recordLlmAttemptFinish: async () => null,
          applyWindowStageResult: async () => null,
          markWindowStageFailure: async () => null,
          markWindowNoEvidence: async () => null,
          markWindowProcessError: async ({ error_message }) => {
            processError = error_message;
            return null;
          },
        },
        searchWindowEvidence: async () => [],
        runOpenAiChat: async () => {
          throw new Error("synthetic failure");
        },
      },
      "window_run_123",
      "l2_neutralized",
    );

    assert.equal(processError, "All l2_neutralized attempts failed for window run window_run_123");
    assert.equal(result.haltProcess, true);
    assert.equal(result.terminalExecutionStatus, "failed");
  });

  it("marks the stage failure when quota reservation is denied", async () => {
    let stageFailureMessage: string | null = null;
    let processErrorMessage: string | null = null;

    const result = await runWindowStageActivityWithDeps(
      {
        quota: {
          reserve: async () => ({
            allowed: false,
            reservationId: "reservation_1",
            bucketKeys: ["quota:test"],
            dimensions: { requests: 1 },
            reason: "quota_denied:1000",
          }),
          settle: async () => undefined,
        },
        convex: {
          getWindowExecutionContext: async () => buildWindowContext(),
          insertWindowEvidenceBatch: async () => ({ inserted: 0, total: 0 }),
          listWindowStageInputs: async () => [
            {
              evidence_id: "evidence_1",
              title: "Evidence 1",
              url: "https://example.com/1",
              input: "raw article",
            },
          ],
          recordLlmAttemptStart: async () => ({ attempt_id: "attempt_1" }),
          recordLlmAttemptFinish: async () => null,
          applyWindowStageResult: async () => {
            throw new Error("applyWindowStageResult should not be called");
          },
          markWindowStageFailure: async ({ error_message }) => {
            stageFailureMessage = error_message;
            return null;
          },
          markWindowNoEvidence: async () => null,
          markWindowProcessError: async ({ error_message }) => {
            processErrorMessage = error_message;
            return null;
          },
        },
        searchWindowEvidence: async () => [],
        runOpenAiChat: async () => {
          throw new Error("runOpenAiChat should not be called");
        },
      },
      "window_run_123",
      "l1_cleaned",
    );

    assert.match(stageFailureMessage ?? "", /Quota reservation denied/);
    assert.equal(processErrorMessage, "All l1_cleaned attempts failed for window run window_run_123");
    assert.equal(result.haltProcess, true);
    assert.equal(result.terminalExecutionStatus, "failed");
  });
});
