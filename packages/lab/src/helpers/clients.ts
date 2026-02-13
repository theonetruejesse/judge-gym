import process from "node:process";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { api } from "@judge-gym/engine";

// Bun auto-loads the repo root .env.local
const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error(
    "CONVEX_URL not found — make sure .env.local exists at repo root",
  );
}

export const httpClient = new ConvexHttpClient(CONVEX_URL);
export const liveClient = new ConvexClient(CONVEX_URL);
export { api };
