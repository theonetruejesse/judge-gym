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
    assert.equal(TEST_TASK_QUEUES.window, "judge-gym.window.test");
  });
});
