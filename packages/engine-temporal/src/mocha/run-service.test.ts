import assert from "assert";
import { describe, it } from "mocha";
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

describe("run stage service", () => {
  it("records successful rubric generation attempts and finalizes the stage", async () => {
    const calls: string[] = [];

    const result = await runRunStageActivityWithDeps(
      {
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
        async runOpenAiChat() {
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
    assert.equal(result.summary, "run_stage:rubric_gen:success=1:failed=0:completed=1");
    assert.deepEqual(calls, ["start", "finish", "apply", "finalize"]);
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
    assert.deepEqual(calls, ["start", "finish", "mark-failure", "finalize"]);
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
});
