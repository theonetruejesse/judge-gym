import { TestWorkflowEnvironment } from "@temporalio/testing";
import assert from "assert";
import { after, before, describe, it } from "mocha";
import { Worker } from "@temporalio/worker";
import {
  acquireSharedTestWorkflowEnvironment,
  releaseSharedTestWorkflowEnvironment,
} from "./shared_test_env";
import {
  getProcessSnapshotQuery,
  resumeUpdate,
  windowWorkflow,
} from "../workflows";
import { TEST_TASK_QUEUES } from "../testing";

describe("window workflow controls", function () {
  this.timeout(60000);
  let testEnv: TestWorkflowEnvironment;

  before(async () => {
    testEnv = await acquireSharedTestWorkflowEnvironment();
  });

  after(async () => {
    await releaseSharedTestWorkflowEnvironment();
  });

  it("pauses at the requested stage and resumes via update", async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = TEST_TASK_QUEUES.window;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("../workflows"),
      activities: {
        projectProcessState: async (input: unknown) => input,
        runWindowStage: async ({ windowId, stage }: { windowId: string; stage: string; }) => ({
          processKind: "window",
          processId: windowId,
          stage,
          summary: `${windowId}:${stage}`,
        }),
        runRunStage: async () => {
          throw new Error("runRunStage should not be used in window tests");
        },
      },
    });

    const result = await worker.runUntil(async () => {
      const handle = await client.workflow.start(windowWorkflow, {
        args: [{ windowId: "window_123", pauseAfter: "collect" }],
        workflowId: "window:window_123",
        taskQueue,
      });

      let pausedSnapshot = await handle.query(getProcessSnapshotQuery);
      for (let attempt = 0; attempt < 10 && pausedSnapshot.executionStatus !== "paused"; attempt += 1) {
        await testEnv.sleep("200 milliseconds");
        pausedSnapshot = await handle.query(getProcessSnapshotQuery);
      }
      assert.equal(pausedSnapshot.executionStatus, "paused");
      assert.equal(pausedSnapshot.stage, "collect");

      const resumedSnapshot = await handle.executeUpdate(resumeUpdate, {
        args: [{ cmdId: "cmd_resume_1" }],
      });
      assert.equal(resumedSnapshot.executionStatus, "running");

      return handle.result();
    });

    assert.equal(result.executionStatus, "completed");
    assert.deepEqual(result.stageHistory, [
      "collect",
      "l1_cleaned",
      "l2_neutralized",
      "l3_abstracted",
    ]);
  });
});
