import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import { ENGINE_ENV_KEYS } from "@judge-gym/engine-settings/env";
import type { RedisQuotaRuntimeConfig } from "./types";

function buildRedisUrlFromDiscreteEnv() {
  const host = process.env[ENGINE_ENV_KEYS.redisHost] ?? null;
  const port = process.env[ENGINE_ENV_KEYS.redisPort] ?? null;
  const password = process.env[ENGINE_ENV_KEYS.redisPassword] ?? null;

  if (!host || !port) {
    return null;
  }

  const username = process.env[ENGINE_ENV_KEYS.redisUser] ?? "default";
  const auth = password
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    : "";

  return `redis://${auth}${host}:${port}`;
}

export function getRedisQuotaRuntimeConfig(): RedisQuotaRuntimeConfig {
  const url =
    process.env[ENGINE_ENV_KEYS.redisUrl] ??
    buildRedisUrlFromDiscreteEnv() ??
    null;

  return {
    enabled: Boolean(url),
    url,
    keyPrefix:
      process.env[ENGINE_ENV_KEYS.redisKeyPrefix]
      ?? DEFAULT_ENGINE_SETTINGS.quota.redisKeyPrefix,
  };
}
