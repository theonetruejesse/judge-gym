import { ENGINE_SETTINGS } from "../settings";

export function shouldRunAt(ts: number | undefined, now: number): boolean {
  return ts === undefined || ts <= now;
}

export function getNextRunAt(now: number): number {
  return now + ENGINE_SETTINGS.run_policy.poll_interval_ms;
}

export function getNextAttemptAt(now: number): number {
  return now + ENGINE_SETTINGS.run_policy.retry_backoff_ms;
}
