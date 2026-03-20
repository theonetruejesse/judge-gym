import { mkdir } from "node:fs/promises";
import path from "node:path";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import {
  ENGINE_ENV_KEYS,
  TEMPORAL_TASK_QUEUES,
} from "@judge-gym/engine-settings";
import { getTemporalRuntimeConfig } from "./runtime";

const TEST_SERVER_MODES = ["local", "existing"] as const;
type TestServerMode = (typeof TEST_SERVER_MODES)[number];

export type TemporalTestEnvironmentConfig = {
  mode: TestServerMode;
  address: string;
  namespace: string;
  downloadDir: string;
  executablePath: string | null;
};

function getPackageRoot() {
  return path.resolve(__dirname, "..");
}

export function getDefaultTemporalTestServerDownloadDir() {
  return path.join(getPackageRoot(), ".temporal", "test-server-downloads");
}

export function getTemporalTestEnvironmentConfig(): TemporalTestEnvironmentConfig {
  const runtime = getTemporalRuntimeConfig();
  const requestedMode =
    process.env[ENGINE_ENV_KEYS.temporalTestServerMode] ?? "local";
  const mode = TEST_SERVER_MODES.includes(requestedMode as TestServerMode)
    ? (requestedMode as TestServerMode)
    : "local";

  return {
    mode,
    address: runtime.address,
    namespace: runtime.namespace,
    downloadDir:
      process.env[ENGINE_ENV_KEYS.temporalTestServerDownloadDir] ??
      getDefaultTemporalTestServerDownloadDir(),
    executablePath:
      process.env[ENGINE_ENV_KEYS.temporalTestServerExecutable] ?? null,
  };
}

export async function createTemporalTestWorkflowEnvironment() {
  const config = getTemporalTestEnvironmentConfig();

  if (config.mode === "existing") {
    return TestWorkflowEnvironment.createFromExistingServer({
      address: config.address,
      namespace: config.namespace,
    });
  }

  await mkdir(config.downloadDir, {
    recursive: true,
  });

  return TestWorkflowEnvironment.createLocal({
    server: {
      ip: "127.0.0.1",
      namespace: config.namespace,
      ui: false,
      searchAttributes: [],
      executable: config.executablePath
        ? {
            type: "existing-path",
            path: config.executablePath,
          }
        : {
            type: "cached-download",
            downloadDir: config.downloadDir,
          },
    },
  });
}

export const TEST_TASK_QUEUES = {
  run: `${TEMPORAL_TASK_QUEUES.run}.test`,
  window: `${TEMPORAL_TASK_QUEUES.window}.test`,
} as const;
