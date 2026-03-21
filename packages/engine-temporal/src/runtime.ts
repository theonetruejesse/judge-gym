import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import { ENGINE_ENV_KEYS } from "@judge-gym/engine-settings/env";
import { TEMPORAL_TASK_QUEUES } from "@judge-gym/engine-settings/temporal";
import { rootCertificates } from "node:tls";

export type TemporalRuntimeConfig = {
  address: string;
  namespace: string;
  tls:
    | {
        serverNameOverride?: string;
        serverRootCACertificate?: Uint8Array;
      }
    | undefined;
  retryDelayMs: number;
  taskQueues: {
    run: string;
    window: string;
  };
};

export function getTemporalRuntimeConfig(): TemporalRuntimeConfig {
  const tlsEnabled =
    process.env[ENGINE_ENV_KEYS.temporalTlsEnabled] === "1";
  const tlsServerName =
    process.env[ENGINE_ENV_KEYS.temporalTlsServerName] ?? undefined;
  return {
    address:
      process.env[ENGINE_ENV_KEYS.temporalAddress] ?? "localhost:7233",
    namespace:
      process.env[ENGINE_ENV_KEYS.temporalNamespace] ?? "default",
    tls: tlsEnabled
      ? {
          ...(tlsServerName ? { serverNameOverride: tlsServerName } : {}),
          ...(rootCertificates.length > 0
            ? {
                serverRootCACertificate: Buffer.from(
                  rootCertificates.join("\n"),
                ),
              }
            : {}),
        }
      : undefined,
    retryDelayMs: Number(
      process.env[ENGINE_ENV_KEYS.temporalRetryDelayMs]
        ?? DEFAULT_ENGINE_SETTINGS.temporal.retryDelayMs,
    ),
    taskQueues: {
      run:
        process.env[ENGINE_ENV_KEYS.temporalRunTaskQueue]
        ?? DEFAULT_ENGINE_SETTINGS.temporal.taskQueues.run
        ?? TEMPORAL_TASK_QUEUES.run,
      window:
        process.env[ENGINE_ENV_KEYS.temporalWindowTaskQueue]
        ?? DEFAULT_ENGINE_SETTINGS.temporal.taskQueues.window
        ?? TEMPORAL_TASK_QUEUES.window,
    },
  };
}
