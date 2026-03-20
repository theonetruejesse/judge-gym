import { ENGINE_ENV_KEYS } from "@judge-gym/engine-settings";
import type { UpstashQuotaRuntimeConfig } from "./types";

export function getUpstashQuotaRuntimeConfig(): UpstashQuotaRuntimeConfig {
  const url = process.env[ENGINE_ENV_KEYS.upstashUrl] ?? null;
  const token = process.env[ENGINE_ENV_KEYS.upstashToken] ?? null;

  return {
    enabled: Boolean(url && token),
    url,
    token,
    keyPrefix:
      process.env[ENGINE_ENV_KEYS.upstashKeyPrefix] ?? "judge-gym:quota",
  };
}
