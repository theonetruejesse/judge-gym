import process from "node:process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Bun auto-loads .env.local from packages/engine/
const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error(
    "CONVEX_URL not found — make sure packages/engine/.env.local exists",
  );
}

export const client = new ConvexHttpClient(CONVEX_URL);
export { api };

// --- Helpers ---

export function log(step: number, msg: string) {
  console.log(`[Step ${step}] ${msg}`);
}

export async function poll<T>(
  fn: () => Promise<T>,
  check: (val: T) => boolean,
  { interval = 5_000, maxAttempts = 60 } = {},
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    const val = await fn();
    if (check(val)) return val;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Polling timed out");
}
