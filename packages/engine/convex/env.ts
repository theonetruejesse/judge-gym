function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getEnv(key: string): string | undefined {
  return readEnv(key);
}

export function requireEnv(key: string): string {
  const value = readEnv(key);
  if (!value) {
    throw new Error(`${key} is required but not set`);
  }
  return value;
}

export function preflightCheck(requiredEnvs: string[]): { ok: true } {
  const missing = requiredEnvs.filter((key) => !readEnv(key));
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}`,
    );
  }
  return { ok: true };
}
