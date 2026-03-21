import assert from "assert";
import { describe, it } from "mocha";
import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
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

describe("window stage service", function () {
  this.timeout(10_000);
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
    let seenUserPrompt = "";
    let seenTimeoutMs: number | undefined;

    const result = await runWindowStageActivityWithDeps(
      {
        settings: {
          ...DEFAULT_ENGINE_SETTINGS,
          llm: {
            ...DEFAULT_ENGINE_SETTINGS.llm,
            requestTimeoutMs: 42_000,
          },
          window: {
            ...DEFAULT_ENGINE_SETTINGS.window,
            maxStageInputChars: 12,
          },
        },
        quota: buildQuota(),
        convex: {
          getWindowExecutionContext: async () => buildWindowContext(),
          insertWindowEvidenceBatch: async () => ({ inserted: 0, total: 0 }),
          listWindowStageInputs: async () => [
            {
              evidence_id: "evidence_1",
              title: "Evidence 1",
              url: "https://example.com/1",
              input: "raw article body that should be truncated",
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
        runOpenAiChat: async (args) => {
          seenUserPrompt = args.userPrompt;
          seenTimeoutMs = args.timeoutMs;
          return {
            assistant_output: "cleaned article",
            input_tokens: 10,
            output_tokens: 4,
            total_tokens: 14,
          };
        },
      },
      "window_run_123",
      "l1_cleaned",
    );

    assert.deepEqual(calls, ["start", "apply", "finish"]);
    assert.equal(seenTimeoutMs, 42_000);
    assert.match(seenUserPrompt, /Truncated for window semantic processing/);
    assert.equal(result.haltProcess, undefined);
    assert.equal(result.summary, "window_stage:l1_cleaned:success=1:failed=0");
  });

  it("routes eligible window work through the batch executor", async () => {
    const calls: string[] = [];
    let attemptCounter = 0;

    const result = await runWindowStageActivityWithDeps(
      {
        settings: {
          ...DEFAULT_ENGINE_SETTINGS,
          llm: {
            ...DEFAULT_ENGINE_SETTINGS.llm,
            batching: {
              ...DEFAULT_ENGINE_SETTINGS.llm.batching,
              minBatchSize: 2,
              maxBatchSize: 10,
            },
          },
        },
        quota: buildQuota(),
        convex: {
          getWindowExecutionContext: async () => buildWindowContext(),
          insertWindowEvidenceBatch: async () => ({ inserted: 0, total: 0 }),
          listWindowStageInputs: async () => [
            {
              evidence_id: "evidence_1",
              title: "Evidence 1",
              url: "https://example.com/1",
              input: "raw article 1",
            },
            {
              evidence_id: "evidence_2",
              title: "Evidence 2",
              url: "https://example.com/2",
              input: "raw article 2",
            },
          ],
          recordLlmAttemptStart: async () => {
            attemptCounter += 1;
            calls.push(`start:${attemptCounter}`);
            return { attempt_id: `attempt_${attemptCounter}` };
          },
          recordLlmAttemptFinish: async ({ attempt_id, status }) => {
            calls.push(`finish:${attempt_id}:${status}`);
            return null;
          },
          applyWindowStageResult: async ({ evidence_id }) => {
            calls.push(`apply:${evidence_id}`);
            return null;
          },
          markWindowStageFailure: async () => {
            throw new Error("markWindowStageFailure should not be called");
          },
          markWindowNoEvidence: async () => null,
          markWindowProcessError: async () => null,
        },
        searchWindowEvidence: async () => [],
        runOpenAiChat: async () => {
          throw new Error("runOpenAiChat should not be called");
        },
        runOpenAiBatchChat: async <TMetadata>() => ({
          batchId: "batch_1",
          outputFileId: "file_out",
          errorFileId: null,
          succeeded: [
            {
              customId: "attempt_1",
              metadata: {
                input: {
                  evidence_id: "evidence_1",
                  title: "Evidence 1",
                  url: "https://example.com/1",
                  input: "raw article 1",
                },
                userPrompt: "unused",
                attemptId: "attempt_1",
              },
              batchId: "batch_1",
              assistant_output: "cleaned article 1",
              input_tokens: 10,
              output_tokens: 4,
              total_tokens: 14,
            },
            {
              customId: "attempt_2",
              metadata: {
                input: {
                  evidence_id: "evidence_2",
                  title: "Evidence 2",
                  url: "https://example.com/2",
                  input: "raw article 2",
                },
                userPrompt: "unused",
                attemptId: "attempt_2",
              },
              batchId: "batch_1",
              assistant_output: "cleaned article 2",
              input_tokens: 10,
              output_tokens: 4,
              total_tokens: 14,
            },
          ],
          failed: [],
        } as any),
      },
      "window_run_123",
      "l1_cleaned",
    );

    assert.equal(result.summary, "window_stage:l1_cleaned:success=2:failed=0");
    assert.deepEqual(calls, [
      "start:1",
      "start:2",
      "apply:evidence_1",
      "finish:attempt_1:succeeded",
      "apply:evidence_2",
      "finish:attempt_2:succeeded",
    ]);
  });

  it("retries collection before inserting evidence", async () => {
    const calls: string[] = [];
    let searchAttempts = 0;

    const result = await runWindowStageActivityWithDeps(
      {
        convex: {
          getWindowExecutionContext: async () => buildWindowContext(),
          insertWindowEvidenceBatch: async ({ evidences }) => {
            calls.push(`insert:${evidences.length}:${evidences[0]?.raw_content}`);
            return { inserted: evidences.length, total: evidences.length };
          },
          listWindowStageInputs: async () => [],
          recordLlmAttemptStart: async () => ({ attempt_id: "attempt_1" }),
          recordLlmAttemptFinish: async () => null,
          applyWindowStageResult: async () => null,
          markWindowStageFailure: async () => null,
          markWindowNoEvidence: async () => null,
          markWindowProcessError: async () => null,
        },
        searchWindowEvidence: async () => {
          searchAttempts += 1;
          if (searchAttempts === 1) {
            throw new Error("Firecrawl search timed out after 45000ms");
          }
          return [{
            title: "Evidence 1",
            url: "https://example.com/1",
            raw_content: "raw markdown",
          }];
        },
        runOpenAiChat: async () => {
          throw new Error("chat should not be called in collect stage");
        },
        quota: buildQuota(),
      },
      "window_run_123",
      "collect",
    );

    assert.equal(searchAttempts, 2);
    assert.equal(result.haltProcess, undefined);
    assert.equal(result.summary, "window_collect:inserted=1:total=1");
    assert.deepEqual(calls, ["insert:1:raw markdown"]);
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
