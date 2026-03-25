import assert from "assert";
import path from "node:path";
import { describe, it } from "mocha";
import * as activities from "../activities";
import {
  getDefaultTemporalTestServerDownloadDir,
  getTemporalTestEnvironmentConfig,
  TEST_TASK_QUEUES,
} from "../testing";

describe("temporal migration activities", () => {
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
  });

  it("fails fast before querying Convex when a run stage input omits runId", async () => {
    await assert.rejects(
      () => activities.runRunStage({
        runId: undefined as unknown as string,
        stage: "rubric_gen",
      }),
      /runId is required/,
    );
  });

  it("fails fast before querying Convex when a transform stage input omits the run id", async () => {
    await assert.rejects(
      () => activities.runEvidenceTransformStage({
        evidenceTransformRunId: undefined as unknown as string,
        stage: "l1_cleaned",
      }),
      /processId is required/,
    );
  });
});
