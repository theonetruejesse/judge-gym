import { MockActivityEnvironment } from "@temporalio/testing";
import assert from "assert";
import path from "node:path";
import { describe, it } from "mocha";
import type { ProjectProcessStateInput } from "@judge-gym/engine-settings";
import * as activities from "../activities";
import {
  getDefaultTemporalTestServerDownloadDir,
  getTemporalTestEnvironmentConfig,
  TEST_TASK_QUEUES,
} from "../testing";

describe("temporal migration activities", () => {
  it("projects process state without mutation", async () => {
    const env = new MockActivityEnvironment();
    const input: ProjectProcessStateInput<"rubric_gen"> = {
      processKind: "run",
      processId: "run_123",
      workflowId: "run:run_123",
      workflowRunId: "run-id",
      workflowType: "RunWorkflow",
      executionStatus: "running",
      stage: "rubric_gen",
      stageStatus: "running",
      pauseAfter: null,
      stageHistory: [],
      lastControlCommandId: null,
      lastErrorMessage: null,
    };
    const result = (await env.run(
      activities.projectProcessState,
      input,
    )) as ProjectProcessStateInput<"rubric_gen">;

    assert.equal(result.workflowId, "run:run_123");
    assert.equal(result.stage, "rubric_gen");
  });

  it("uses an in-repo cache directory by default for workflow tests", () => {
    const config = getTemporalTestEnvironmentConfig();

    assert.equal(config.mode, "local");
    assert.equal(
      config.downloadDir,
      path.resolve(getDefaultTemporalTestServerDownloadDir()),
    );
  });

  it("publishes stable test task queues", () => {
    assert.equal(TEST_TASK_QUEUES.run, "judge-gym.run.test");
    assert.equal(TEST_TASK_QUEUES.window, "judge-gym.window.test");
  });
});
