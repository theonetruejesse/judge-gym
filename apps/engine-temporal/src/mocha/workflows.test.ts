import { TestWorkflowEnvironment } from "@temporalio/testing";
import assert from "assert";
import { after, before, describe, it } from "mocha";
import { Worker } from "@temporalio/worker";
import type { ProjectProcessStateInput } from "@judge-gym/engine-settings/process";
import {
  acquireSharedTestWorkflowEnvironment,
  releaseSharedTestWorkflowEnvironment,
} from "./shared_test_env";
import {
  evidenceAcquisitionWorkflow,
  evidenceTransformWorkflow,
  runWorkflow,
} from "../workflows";
import { TEST_TASK_QUEUES } from "../testing";

describe("run workflow", function () {
  this.timeout(60000);
  let testEnv: TestWorkflowEnvironment;

  before(async () => {
    testEnv = await acquireSharedTestWorkflowEnvironment();
  });

  after(async () => {
    await releaseSharedTestWorkflowEnvironment();
  });

  it("completes the canonical run stages on the run task queue", async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = TEST_TASK_QUEUES.run;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("../workflows"),
      activities: {
        projectProcessState: async <TStage extends string>(
          input: ProjectProcessStateInput<TStage>,
        ) => input,
        runRunStage: async ({ runId, stage }: { runId: string; stage: string; }) => ({
          processKind: "run",
          processId: runId,
          stage,
          summary: `${runId}:${stage}`,
        }),
      },
    });

    const result = await worker.runUntil(
      client.workflow.execute(runWorkflow, {
        args: [{ runId: "run_123" }],
        workflowId: "run:run_123",
        taskQueue,
      }),
    );

    assert.equal(result.executionStatus, "completed");
    assert.deepEqual(result.stageHistory, [
      "rubric_gen",
      "rubric_critic",
      "score_gen",
      "score_critic",
    ]);
  });
});

describe("evidence transform workflow", function () {
  this.timeout(60000);
  let testEnv: TestWorkflowEnvironment;

  before(async () => {
    testEnv = await acquireSharedTestWorkflowEnvironment();
  });

  after(async () => {
    await releaseSharedTestWorkflowEnvironment();
  });

  it("runs transform stages in canonical order", async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = TEST_TASK_QUEUES.run;
    const seenStages: string[] = [];

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("../workflows"),
      activities: {
        projectProcessState: async <TStage extends string>(
          input: ProjectProcessStateInput<TStage>,
        ) => input,
        runRunStage: async ({ runId, stage }: { runId: string; stage: string; }) => ({
          processKind: "run",
          processId: runId,
          stage,
          summary: `${runId}:${stage}`,
        }),
        runEvidenceTransformStage: async (
          {
            evidenceTransformRunId,
            stage,
          }: {
            evidenceTransformRunId: string;
            stage: string;
          },
        ) => {
          seenStages.push(stage);
          return {
            processKind: "run" as const,
            processId: evidenceTransformRunId,
            stage,
            summary: `${evidenceTransformRunId}:${stage}`,
          };
        },
      },
    });

    const result = await worker.runUntil(
      client.workflow.execute(evidenceTransformWorkflow, {
        args: [{ transformRunId: "transform_123" }],
        workflowId: "evidence_transform:transform_123",
        taskQueue,
      }),
    );

    assert.equal(result.transformRunId, "transform_123");
    assert.deepEqual(seenStages, [
      "l1_cleaned",
      "l2_neutralized",
      "l3_abstracted",
    ]);
  });
});

describe("evidence acquisition workflow", function () {
  this.timeout(60000);
  let testEnv: TestWorkflowEnvironment;

  before(async () => {
    testEnv = await acquireSharedTestWorkflowEnvironment();
  });

  after(async () => {
    await releaseSharedTestWorkflowEnvironment();
  });

  it("loops acquisition cycles until the activity reports completion", async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = TEST_TASK_QUEUES.run;
    let iterations = 0;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("../workflows"),
      activities: {
        projectProcessState: async <TStage extends string>(
          input: ProjectProcessStateInput<TStage>,
        ) => input,
        runRunStage: async ({ runId, stage }: { runId: string; stage: string; }) => ({
          processKind: "run" as const,
          processId: runId,
          stage,
          summary: `${runId}:${stage}`,
        }),
        runEvidenceTransformStage: async (
          {
            evidenceTransformRunId,
            stage,
          }: {
            evidenceTransformRunId: string;
            stage: string;
          },
        ) => ({
          processKind: "run" as const,
          processId: evidenceTransformRunId,
          stage,
          summary: `${evidenceTransformRunId}:${stage}`,
        }),
        runEvidenceAcquisitionCycle: async ({
          acquisitionRunId,
        }: {
          acquisitionRunId: string;
        }) => {
          iterations += 1;
          return {
            acquisitionRunId,
            completed: iterations >= 3,
            paginationToken: iterations >= 3 ? null : `page-${iterations}`,
            discovered: 2,
            hydrated: 2,
            hydrationFailures: 0,
          };
        },
      },
    });

    const result = await worker.runUntil(
      client.workflow.execute(evidenceAcquisitionWorkflow, {
        args: [{ acquisitionRunId: "acquisition_123" }],
        workflowId: "acquisition:acquisition_123",
        taskQueue,
      }),
    );

    assert.equal(result.acquisitionRunId, "acquisition_123");
    assert.equal(result.iterations, 3);
  });
});
