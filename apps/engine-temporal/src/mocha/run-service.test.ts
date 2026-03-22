import assert from "assert";
import { describe, it } from "mocha";
import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import { runRunStageActivityWithDeps } from "../run/service";

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

describe("run stage service", function () {
  this.timeout(10_000);
  it("records successful rubric generation attempts and finalizes the stage", async () => {
    const calls: string[] = [];
    let seenTimeoutMs: number | undefined;

    const result = await runRunStageActivityWithDeps(
      {
        settings: {
          ...DEFAULT_ENGINE_SETTINGS,
          llm: {
            ...DEFAULT_ENGINE_SETTINGS.llm,
            direct: {
              ...DEFAULT_ENGINE_SETTINGS.llm.direct,
              requestTimeoutMs: 37_000,
            },
          },
        },
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_123",
              experiment_id: "exp_123",
              workflow_id: "run:run_123",
              workflow_run_id: "workflow-run-1",
              status: "running",
              current_stage: "rubric_gen",
              target_count: 1,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [{
              target_type: "sample" as const,
              target_id: "sample_1",
              model: "gpt-4.1",
              system_prompt: "system",
              user_prompt: "user",
              metadata_json: "{\"sample_id\":\"sample_1\"}",
            }];
          },
          async recordLlmAttemptStart() {
            calls.push("start");
            return {
              attempt_id: "attempt_1",
            };
          },
          async recordLlmAttemptFinish() {
            calls.push("finish");
            return null;
          },
          async applyRunStageResult() {
            calls.push("apply");
            return null;
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            calls.push("finalize");
            return {
              total: 1,
              completed: 1,
              failed: 0,
              has_pending: false,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat(args) {
          seenTimeoutMs = args.timeoutMs;
          return {
            assistant_output: "RUBRIC:\n1) A :: one; two; three",
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          };
        },
      },
      "run_123",
      "rubric_gen",
    );

    assert.equal(result.haltProcess, undefined);
    assert.equal(seenTimeoutMs, 37_000);
    assert.equal(result.summary, "run_stage:rubric_gen:success=1:failed=0:completed=1");
    assert.deepEqual(calls, ["start", "apply", "finish", "finalize"]);
  });

  it("halts the workflow when run stage finalization reports terminal failure", async () => {
    const calls: string[] = [];

    const result = await runRunStageActivityWithDeps(
      {
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_456",
              experiment_id: "exp_456",
              workflow_id: "run:run_456",
              workflow_run_id: "workflow-run-2",
              status: "running",
              current_stage: "score_gen",
              target_count: 1,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [{
              target_type: "sample_score_target" as const,
              target_id: "target_1",
              model: "gpt-4.1",
              system_prompt: "system",
              user_prompt: "user",
              metadata_json: null,
            }];
          },
          async recordLlmAttemptStart() {
            calls.push("start");
            return {
              attempt_id: "attempt_2",
            };
          },
          async recordLlmAttemptFinish() {
            calls.push("finish");
            return null;
          },
          async applyRunStageResult() {
            throw new Error("applyRunStageResult should not be called");
          },
          async markRunStageFailure() {
            calls.push("mark-failure");
            return null;
          },
          async finalizeRunStage() {
            calls.push("finalize");
            return {
              total: 1,
              completed: 0,
              failed: 1,
              has_pending: false,
              halt_process: true,
              terminal_execution_status: "failed" as const,
              error_message: "score stage failed",
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          throw new Error("provider failed");
        },
      },
      "run_456",
      "score_gen",
    );

    assert.equal(result.haltProcess, true);
    assert.equal(result.terminalExecutionStatus, "failed");
    assert.equal(result.errorMessage, "score stage failed");
    assert.deepEqual(calls, [
      "start",
      "finish",
      "start",
      "finish",
      "start",
      "finish",
      "mark-failure",
      "finalize",
    ]);
  });

  it("routes eligible run work through the batch executor", async () => {
    const calls: string[] = [];
    let attemptCounter = 0;
    let seenBatchTimeoutMs: number | undefined;

    const result = await runRunStageActivityWithDeps(
      {
        settings: {
          ...DEFAULT_ENGINE_SETTINGS,
          llm: {
            ...DEFAULT_ENGINE_SETTINGS.llm,
            batching: {
              ...DEFAULT_ENGINE_SETTINGS.llm.batching,
              minBatchSize: 2,
              maxBatchSize: 10,
              requestTimeoutMs: 91_000,
            },
          },
        },
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_batch",
              experiment_id: "exp_batch",
              workflow_id: "run:run_batch",
              workflow_run_id: "workflow-run-batch",
              status: "running",
              current_stage: "score_gen",
              target_count: 2,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [
              {
                target_type: "sample_score_target" as const,
                target_id: "target_1",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "user-1",
                metadata_json: null,
              },
              {
                target_type: "sample_score_target" as const,
                target_id: "target_2",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "user-2",
                metadata_json: null,
              },
            ];
          },
          async recordLlmAttemptStart() {
            attemptCounter += 1;
            calls.push(`start:${attemptCounter}`);
            return {
              attempt_id: `attempt_${attemptCounter}`,
            };
          },
          async recordLlmAttemptFinish({ attempt_id, status }) {
            calls.push(`finish:${attempt_id}:${status}`);
            return null;
          },
          async applyRunStageResult({ target_id }) {
            calls.push(`apply:${target_id}`);
            return null;
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            return {
              total: 2,
              completed: 2,
              failed: 0,
              has_pending: false,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          throw new Error("runOpenAiChat should not be called");
        },
        async runOpenAiBatchChat<TMetadata>(args: { timeoutMs?: number }) {
          calls.push("batch");
          seenBatchTimeoutMs = args.timeoutMs;
          return {
            batchId: "batch_1",
            outputFileId: "file_out",
            errorFileId: null,
            succeeded: [
              {
                customId: "attempt_1",
                metadata: {
                  input: {
                    target_type: "sample_score_target" as const,
                    target_id: "target_1",
                    model: "gpt-4.1",
                    system_prompt: "system",
                    user_prompt: "user-1",
                    metadata_json: null,
                  },
                  attemptId: "attempt_1",
                },
                batchId: "batch_1",
                assistant_output: "ok-1",
                input_tokens: 10,
                output_tokens: 5,
                total_tokens: 15,
              },
              {
                customId: "attempt_2",
                metadata: {
                  input: {
                    target_type: "sample_score_target" as const,
                    target_id: "target_2",
                    model: "gpt-4.1",
                    system_prompt: "system",
                    user_prompt: "user-2",
                    metadata_json: null,
                  },
                  attemptId: "attempt_2",
                },
                batchId: "batch_1",
                assistant_output: "ok-2",
                input_tokens: 11,
                output_tokens: 6,
                total_tokens: 17,
              },
            ],
            failed: [],
          } as any;
        },
      },
      "run_batch",
      "score_gen",
    );

    assert.equal(result.summary, "run_stage:score_gen:success=2:failed=0:completed=2");
    assert.equal(seenBatchTimeoutMs, 91_000);
    assert.deepEqual(calls, [
      "start:1",
      "start:2",
      "batch",
      "apply:target_1",
      "finish:attempt_1:succeeded",
      "apply:target_2",
      "finish:attempt_2:succeeded",
    ]);
  });

  it("reuses an existing provider batch instead of resubmitting batch work", async () => {
    let seenExistingBatchId: string | undefined;
    let bindSubmittedCalls = 0;

    const result = await runRunStageActivityWithDeps(
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
          async getRunExecutionContext() {
            return {
              run_id: "run_reuse_batch",
              experiment_id: "exp_reuse_batch",
              workflow_id: "run:run_reuse_batch",
              workflow_run_id: "workflow-run-reuse-batch",
              status: "running",
              current_stage: "score_gen",
              target_count: 2,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [
              {
                target_type: "sample_score_target" as const,
                target_id: "target_1",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "user-1",
                metadata_json: null,
              },
              {
                target_type: "sample_score_target" as const,
                target_id: "target_2",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "user-2",
                metadata_json: null,
              },
            ];
          },
          async recordLlmAttemptStart({ target_id }) {
            return {
              attempt_id: `attempt_${target_id}`,
            };
          },
          async recordLlmAttemptFinish() {
            return null;
          },
          async applyRunStageResult() {
            return null;
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            return {
              total: 2,
              completed: 2,
              failed: 0,
              has_pending: false,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
          async ensureBatchExecution() {
            return {
              batch_execution_id: "batch_execution_1",
              provider_batch_id: "batch_existing",
              status: "submitted",
              output_file_id: null,
              error_file_id: null,
            };
          },
          async bindBatchExecutionSubmitted() {
            bindSubmittedCalls += 1;
            return null;
          },
          async finalizeBatchExecution() {
            return null;
          },
        },
        async runOpenAiChat() {
          throw new Error("runOpenAiChat should not be called");
        },
        async runOpenAiBatchChat(args: { existingBatchId?: string }) {
          seenExistingBatchId = args.existingBatchId;
          return {
            batchId: "batch_existing",
            outputFileId: "file_out",
            errorFileId: null,
            succeeded: [
              {
                customId: "attempt_target_1",
                metadata: {
                  input: {
                    target_type: "sample_score_target" as const,
                    target_id: "target_1",
                    model: "gpt-4.1",
                    system_prompt: "system",
                    user_prompt: "user-1",
                    metadata_json: null,
                  },
                  attemptId: "attempt_target_1",
                },
                batchId: "batch_existing",
                assistant_output: "ok-1",
                input_tokens: 10,
                output_tokens: 5,
                total_tokens: 15,
              },
              {
                customId: "attempt_target_2",
                metadata: {
                  input: {
                    target_type: "sample_score_target" as const,
                    target_id: "target_2",
                    model: "gpt-4.1",
                    system_prompt: "system",
                    user_prompt: "user-2",
                    metadata_json: null,
                  },
                  attemptId: "attempt_target_2",
                },
                batchId: "batch_existing",
                assistant_output: "ok-2",
                input_tokens: 11,
                output_tokens: 6,
                total_tokens: 17,
              },
            ],
            failed: [],
          } as any;
        },
      },
      "run_reuse_batch",
      "score_gen",
    );

    assert.equal(result.summary, "run_stage:score_gen:success=2:failed=0:completed=2");
    assert.equal(seenExistingBatchId, "batch_existing");
    assert.equal(bindSubmittedCalls, 0);
  });

  it("splits batch work by serialized request budget, not just item count", async () => {
    let batchCallCount = 0;

    const result = await runRunStageActivityWithDeps(
      {
        settings: {
          ...DEFAULT_ENGINE_SETTINGS,
          llm: {
            ...DEFAULT_ENGINE_SETTINGS.llm,
            batching: {
              ...DEFAULT_ENGINE_SETTINGS.llm.batching,
              minBatchSize: 2,
              maxBatchSize: 10,
              maxBatchRequestBytes: 500,
            },
          },
        },
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_batch_budget",
              experiment_id: "exp_batch_budget",
              workflow_id: "run:run_batch_budget",
              workflow_run_id: "workflow-run-batch-budget",
              status: "running",
              current_stage: "score_gen",
              target_count: 2,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [
              {
                target_type: "sample_score_target" as const,
                target_id: "target_1",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "x".repeat(800),
                metadata_json: null,
              },
              {
                target_type: "sample_score_target" as const,
                target_id: "target_2",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "y".repeat(800),
                metadata_json: null,
              },
            ];
          },
          async recordLlmAttemptStart({ target_id }) {
            return {
              attempt_id: `attempt_${target_id}`,
            };
          },
          async recordLlmAttemptFinish() {
            return null;
          },
          async applyRunStageResult() {
            return null;
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            return {
              total: 2,
              completed: 2,
              failed: 0,
              has_pending: false,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          throw new Error("runOpenAiChat should not be called");
        },
        async runOpenAiBatchChat(args: any) {
          batchCallCount += 1;
          return {
            batchId: `batch_${batchCallCount}`,
            outputFileId: `file_out_${batchCallCount}`,
            errorFileId: null,
            succeeded: args.items.map((item: any) => ({
              customId: `attempt_${item.metadata.input.target_id}`,
              metadata: {
                input: item.metadata.input,
                attemptId: `attempt_${item.metadata.input.target_id}`,
              },
              batchId: `batch_${batchCallCount}`,
              assistant_output: `ok-${item.metadata.input.target_id}`,
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
            })),
            failed: [],
          } as any;
        },
      },
      "run_batch_budget",
      "score_gen",
    );

    assert.equal(result.summary, "run_stage:score_gen:success=2:failed=0:completed=2");
    assert.equal(batchCallCount, 2);
  });

  it("continues when stage finalization reports partial failure but surviving work completed", async () => {
    const calls: string[] = [];

    const result = await runRunStageActivityWithDeps(
      {
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_partial",
              experiment_id: "exp_partial",
              workflow_id: "run:run_partial",
              workflow_run_id: "workflow-run-partial",
              status: "running",
              current_stage: "rubric_critic",
              target_count: 2,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [{
              target_type: "sample" as const,
              target_id: "sample_survivor",
              model: "gpt-4.1",
              system_prompt: "system",
              user_prompt: "user",
              metadata_json: null,
            }];
          },
          async recordLlmAttemptStart() {
            calls.push("start");
            return {
              attempt_id: "attempt_partial",
            };
          },
          async recordLlmAttemptFinish() {
            calls.push("finish");
            return null;
          },
          async applyRunStageResult() {
            calls.push("apply");
            return null;
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            calls.push("finalize");
            return {
              total: 2,
              completed: 1,
              failed: 1,
              has_pending: false,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          return {
            assistant_output: "observability 0.8\ndiscriminability 0.7",
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          };
        },
      },
      "run_partial",
      "rubric_critic",
    );

    assert.equal(result.haltProcess, undefined);
    assert.equal(
      result.summary,
      "run_stage:rubric_critic:success=1:failed=0:completed=1",
    );
    assert.deepEqual(calls, ["start", "apply", "finish", "finalize"]);
  });

  it("retries retryable parse failures before marking the target dead", async () => {
    const calls: string[] = [];
    let applyAttempts = 0;

    const result = await runRunStageActivityWithDeps(
      {
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_retry",
              experiment_id: "exp_retry",
              workflow_id: "run:run_retry",
              workflow_run_id: "workflow-run-retry",
              status: "running",
              current_stage: "score_gen",
              target_count: 1,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [{
              target_type: "sample_score_target" as const,
              target_id: "target_retry",
              model: "gpt-4.1",
              system_prompt: "system",
              user_prompt: "user",
              metadata_json: null,
            }];
          },
          async recordLlmAttemptStart() {
            calls.push("start");
            return {
              attempt_id: `attempt_${applyAttempts + 1}`,
            };
          },
          async recordLlmAttemptFinish() {
            calls.push("finish");
            return null;
          },
          async applyRunStageResult() {
            applyAttempts += 1;
            calls.push(`apply:${applyAttempts}`);
            if (applyAttempts < 3) {
              throw new Error("Failed to parse verdict token: malformed");
            }
            return null;
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            calls.push("finalize");
            return {
              total: 1,
              completed: 1,
              failed: 0,
              has_pending: false,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          return {
            assistant_output: "VERDICT: A",
            input_tokens: 10,
            output_tokens: 10,
            total_tokens: 20,
          };
        },
      },
      "run_retry",
      "score_gen",
    );

    assert.equal(result.haltProcess, undefined);
    assert.equal(
      result.summary,
      "run_stage:score_gen:success=1:failed=0:completed=1",
    );
    assert.deepEqual(calls, [
      "start",
      "apply:1",
      "finish",
      "start",
      "apply:2",
      "finish",
      "start",
      "apply:3",
      "finish",
      "finalize",
    ]);
  });

  it("marks the run failed when stage finalization still reports pending work", async () => {
    const calls: string[] = [];

    const result = await runRunStageActivityWithDeps(
      {
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_789",
              experiment_id: "exp_789",
              workflow_id: "run:run_789",
              workflow_run_id: "workflow-run-3",
              status: "running",
              current_stage: "score_critic",
              target_count: 1,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [];
          },
          async recordLlmAttemptStart() {
            throw new Error("recordLlmAttemptStart should not be called");
          },
          async recordLlmAttemptFinish() {
            throw new Error("recordLlmAttemptFinish should not be called");
          },
          async applyRunStageResult() {
            throw new Error("applyRunStageResult should not be called");
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            calls.push("finalize");
            return {
              total: 1,
              completed: 0,
              failed: 0,
              has_pending: true,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            calls.push("mark-process-error");
            return null;
          },
        },
        async runOpenAiChat() {
          throw new Error("runOpenAiChat should not be called");
        },
      },
      "run_789",
      "score_critic",
    );

    assert.equal(result.haltProcess, true);
    assert.equal(result.terminalExecutionStatus, "failed");
    assert.match(result.errorMessage ?? "", /still has pending targets/);
    assert.deepEqual(calls, ["finalize", "mark-process-error"]);
  });

  it("marks the run stage failure when quota reservation is denied", async () => {
    const calls: string[] = [];

    const result = await runRunStageActivityWithDeps(
      {
        quota: {
          reserve: async () => ({
            allowed: false,
            reservationId: "reservation_1",
            bucketKeys: ["quota:test"],
            dimensions: { requests: 1 },
            reason: "quota_denied:500",
          }),
          settle: async () => undefined,
        },
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_999",
              experiment_id: "exp_999",
              workflow_id: "run:run_999",
              workflow_run_id: "workflow-run-4",
              status: "running",
              current_stage: "rubric_gen",
              target_count: 1,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [{
              target_type: "sample" as const,
              target_id: "sample_1",
              model: "gpt-4.1",
              system_prompt: "system",
              user_prompt: "user",
              metadata_json: null,
            }];
          },
          async recordLlmAttemptStart() {
            return { attempt_id: "attempt_1" };
          },
          async recordLlmAttemptFinish() {
            calls.push("finish");
            return null;
          },
          async applyRunStageResult() {
            throw new Error("applyRunStageResult should not be called");
          },
          async markRunStageFailure() {
            calls.push("mark-failure");
            return null;
          },
          async finalizeRunStage() {
            calls.push("finalize");
            return {
              total: 1,
              completed: 0,
              failed: 1,
              has_pending: false,
              halt_process: true,
              terminal_execution_status: "failed" as const,
              error_message: "quota stage failed",
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          throw new Error("runOpenAiChat should not be called");
        },
      },
      "run_999",
      "rubric_gen",
    );

    assert.equal(result.haltProcess, true);
    assert.equal(result.terminalExecutionStatus, "failed");
    assert.deepEqual(calls, ["finish", "mark-failure", "finalize"]);
  });

  it("emits periodic run heartbeats while a direct request is in flight", async () => {
    const heartbeatSources: string[] = [];

    const result = await runRunStageActivityWithDeps(
      {
        processHeartbeatIntervalMs: 5,
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_direct_heartbeat",
              experiment_id: "exp_direct_heartbeat",
              workflow_id: "run:run_direct_heartbeat",
              workflow_run_id: "workflow-run-direct-heartbeat",
              status: "running",
              current_stage: "rubric_critic",
              target_count: 1,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [{
              target_type: "sample" as const,
              target_id: "sample_1",
              model: "gpt-4.1",
              system_prompt: "system",
              user_prompt: "user",
              metadata_json: null,
            }];
          },
          async recordLlmAttemptStart() {
            return { attempt_id: "attempt_direct_heartbeat" };
          },
          async recordLlmAttemptFinish() {
            return null;
          },
          async recordProcessHeartbeat({ payload_json }) {
            const payload = payload_json ? JSON.parse(payload_json) : null;
            heartbeatSources.push(payload?.source ?? "unknown");
            return null;
          },
          async applyRunStageResult() {
            return null;
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            return {
              total: 1,
              completed: 1,
              failed: 0,
              has_pending: false,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          await new Promise((resolve) => setTimeout(resolve, 25));
          return {
            assistant_output: "ok",
            input_tokens: 10,
            output_tokens: 10,
            total_tokens: 20,
          };
        },
      },
      "run_direct_heartbeat",
      "rubric_critic",
    );

    assert.equal(result.summary, "run_stage:rubric_critic:success=1:failed=0:completed=1");
    assert.ok(heartbeatSources.length >= 1);
    assert.ok(heartbeatSources.every((source) => source === "direct_request"));
  });

  it("emits periodic run heartbeats while batch completion is still pending", async () => {
    const heartbeatSources: string[] = [];

    const result = await runRunStageActivityWithDeps(
      {
        processHeartbeatIntervalMs: 5,
        settings: {
          ...DEFAULT_ENGINE_SETTINGS,
          llm: {
            ...DEFAULT_ENGINE_SETTINGS.llm,
            batching: {
              ...DEFAULT_ENGINE_SETTINGS.llm.batching,
              minBatchSize: 2,
            },
          },
        },
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_batch_heartbeat",
              experiment_id: "exp_batch_heartbeat",
              workflow_id: "run:run_batch_heartbeat",
              workflow_run_id: "workflow-run-batch-heartbeat",
              status: "running",
              current_stage: "score_gen",
              target_count: 2,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [
              {
                target_type: "sample_score_target" as const,
                target_id: "target_1",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "user-1",
                metadata_json: null,
              },
              {
                target_type: "sample_score_target" as const,
                target_id: "target_2",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "user-2",
                metadata_json: null,
              },
            ];
          },
          async recordLlmAttemptStart({ target_id }) {
            return { attempt_id: `attempt_${target_id}` };
          },
          async recordLlmAttemptFinish() {
            return null;
          },
          async recordProcessHeartbeat({ payload_json }) {
            const payload = payload_json ? JSON.parse(payload_json) : null;
            heartbeatSources.push(payload?.source ?? "unknown");
            return null;
          },
          async applyRunStageResult() {
            return null;
          },
          async markRunStageFailure() {
            throw new Error("markRunStageFailure should not be called");
          },
          async finalizeRunStage() {
            return {
              total: 2,
              completed: 2,
              failed: 0,
              has_pending: false,
              halt_process: false,
              terminal_execution_status: null,
              error_message: null,
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          throw new Error("runOpenAiChat should not be called");
        },
        async runOpenAiBatchChat() {
          await new Promise((resolve) => setTimeout(resolve, 25));
          return {
            batchId: "batch_heartbeat",
            outputFileId: "file_out",
            errorFileId: null,
            succeeded: [
              {
                customId: "attempt_target_1",
                metadata: {
                  input: {
                    target_type: "sample_score_target" as const,
                    target_id: "target_1",
                    model: "gpt-4.1",
                    system_prompt: "system",
                    user_prompt: "user-1",
                    metadata_json: null,
                  },
                  attemptId: "attempt_target_1",
                },
                batchId: "batch_heartbeat",
                assistant_output: "ok-1",
                input_tokens: 10,
                output_tokens: 5,
                total_tokens: 15,
              },
              {
                customId: "attempt_target_2",
                metadata: {
                  input: {
                    target_type: "sample_score_target" as const,
                    target_id: "target_2",
                    model: "gpt-4.1",
                    system_prompt: "system",
                    user_prompt: "user-2",
                    metadata_json: null,
                  },
                  attemptId: "attempt_target_2",
                },
                batchId: "batch_heartbeat",
                assistant_output: "ok-2",
                input_tokens: 10,
                output_tokens: 5,
                total_tokens: 15,
              },
            ],
            failed: [],
          } as any;
        },
      },
      "run_batch_heartbeat",
      "score_gen",
    );

    assert.equal(result.summary, "run_stage:score_gen:success=2:failed=0:completed=2");
    assert.ok(heartbeatSources.length >= 1);
    assert.ok(heartbeatSources.every((source) => source === "batch_wait"));
  });

  it("times out a stalled direct preflight while emitting heartbeats", async () => {
    const heartbeatSteps: string[] = [];
    const finishedErrors: string[] = [];
    let markFailureCalls = 0;

    const result = await runRunStageActivityWithDeps(
      {
        processHeartbeatIntervalMs: 5,
        settings: {
          ...DEFAULT_ENGINE_SETTINGS,
          llm: {
            ...DEFAULT_ENGINE_SETTINGS.llm,
            preflightTimeoutMs: 15,
            retries: {
              ...DEFAULT_ENGINE_SETTINGS.llm.retries,
              providerFailureMaxAttempts: 1,
              unexpectedFailureMaxAttempts: 1,
            },
          },
        },
        quota: {
          reserve: async () => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            return {
              allowed: true,
              reservationId: "reservation_direct_stall",
              bucketKeys: ["quota:test"],
              dimensions: { requests: 1 },
            };
          },
          settle: async () => undefined,
        },
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_direct_preflight_timeout",
              experiment_id: "exp_direct_preflight_timeout",
              workflow_id: "run:run_direct_preflight_timeout",
              workflow_run_id: "workflow-run-direct-preflight-timeout",
              status: "running",
              current_stage: "rubric_critic",
              target_count: 1,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [{
              target_type: "sample" as const,
              target_id: "sample_1",
              model: "gpt-4.1",
              system_prompt: "system",
              user_prompt: "user",
              metadata_json: null,
            }];
          },
          async recordLlmAttemptStart() {
            return { attempt_id: "attempt_direct_preflight_timeout" };
          },
          async recordLlmAttemptFinish({ error_message }) {
            if (error_message) {
              finishedErrors.push(error_message);
            }
            return null;
          },
          async recordProcessHeartbeat({ payload_json }) {
            const payload = payload_json ? JSON.parse(payload_json) : null;
            heartbeatSteps.push(`${payload?.source ?? "unknown"}:${payload?.step ?? "unknown"}`);
            return null;
          },
          async applyRunStageResult() {
            throw new Error("applyRunStageResult should not be called");
          },
          async markRunStageFailure() {
            markFailureCalls += 1;
            return null;
          },
          async finalizeRunStage() {
            return {
              total: 1,
              completed: 0,
              failed: 1,
              has_pending: false,
              halt_process: true,
              terminal_execution_status: "failed" as const,
              error_message: "direct preflight failed",
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
        },
        async runOpenAiChat() {
          throw new Error("runOpenAiChat should not be called");
        },
      },
      "run_direct_preflight_timeout",
      "rubric_critic",
    );

    assert.equal(result.haltProcess, true);
    assert.equal(markFailureCalls, 1);
    assert.ok(heartbeatSteps.length >= 1);
    assert.ok(heartbeatSteps.every((step) => step === "direct_preamble:quota_reserve"));
    assert.equal(finishedErrors.length, 1);
    assert.match(finishedErrors[0] ?? "", /Timed out reserving direct-request quota/);
  });

  it("times out a stalled batch preflight while emitting heartbeats", async () => {
    const heartbeatSteps: string[] = [];
    const finishedErrors: string[] = [];
    let markFailureCalls = 0;

    const result = await runRunStageActivityWithDeps(
      {
        processHeartbeatIntervalMs: 5,
        settings: {
          ...DEFAULT_ENGINE_SETTINGS,
          llm: {
            ...DEFAULT_ENGINE_SETTINGS.llm,
            preflightTimeoutMs: 15,
            batching: {
              ...DEFAULT_ENGINE_SETTINGS.llm.batching,
              minBatchSize: 2,
            },
            retries: {
              ...DEFAULT_ENGINE_SETTINGS.llm.retries,
              providerFailureMaxAttempts: 1,
              unexpectedFailureMaxAttempts: 1,
            },
          },
        },
        quota: buildQuota(),
        convex: {
          async getRunExecutionContext() {
            return {
              run_id: "run_batch_preflight_timeout",
              experiment_id: "exp_batch_preflight_timeout",
              workflow_id: "run:run_batch_preflight_timeout",
              workflow_run_id: "workflow-run-batch-preflight-timeout",
              status: "running",
              current_stage: "score_gen",
              target_count: 2,
              completed_count: 0,
              pause_after: null,
            };
          },
          async listRunStageInputs() {
            return [
              {
                target_type: "sample_score_target" as const,
                target_id: "target_1",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "user-1",
                metadata_json: null,
              },
              {
                target_type: "sample_score_target" as const,
                target_id: "target_2",
                model: "gpt-4.1",
                system_prompt: "system",
                user_prompt: "user-2",
                metadata_json: null,
              },
            ];
          },
          async recordLlmAttemptStart({ target_id }) {
            return { attempt_id: `attempt_${target_id}` };
          },
          async recordLlmAttemptFinish({ error_message }) {
            if (error_message) {
              finishedErrors.push(error_message);
            }
            return null;
          },
          async recordProcessHeartbeat({ payload_json }) {
            const payload = payload_json ? JSON.parse(payload_json) : null;
            heartbeatSteps.push(`${payload?.source ?? "unknown"}:${payload?.step ?? "unknown"}`);
            return null;
          },
          async applyRunStageResult() {
            throw new Error("applyRunStageResult should not be called");
          },
          async markRunStageFailure() {
            markFailureCalls += 1;
            return null;
          },
          async finalizeRunStage() {
            return {
              total: 2,
              completed: 0,
              failed: 2,
              has_pending: false,
              halt_process: true,
              terminal_execution_status: "failed" as const,
              error_message: "batch preflight failed",
            };
          },
          async markRunProcessError() {
            throw new Error("markRunProcessError should not be called");
          },
          async ensureBatchExecution() {
            await new Promise((resolve) => setTimeout(resolve, 30));
            return {
              batch_execution_id: "batch_execution_stalled",
              provider_batch_id: null,
              status: "preparing",
              output_file_id: null,
              error_file_id: null,
            };
          },
          async finalizeBatchExecution() {
            return null;
          },
        },
        async runOpenAiChat() {
          throw new Error("runOpenAiChat should not be called");
        },
        async runOpenAiBatchChat() {
          throw new Error("runOpenAiBatchChat should not be called");
        },
      },
      "run_batch_preflight_timeout",
      "score_gen",
    );

    assert.equal(result.haltProcess, true);
    assert.equal(markFailureCalls, 2);
    assert.ok(heartbeatSteps.length >= 1);
    assert.ok(
      heartbeatSteps.every((step) => step.startsWith("batch_preamble:")),
    );
    assert.ok(heartbeatSteps.includes("batch_preamble:ensure_batch_execution"));
    assert.equal(finishedErrors.length, 2);
    assert.ok(
      finishedErrors.every((message) => /Timed out preparing batch execution/.test(message)),
    );
  });
});
