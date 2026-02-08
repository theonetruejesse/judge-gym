import process from "node:process";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

// Bun auto-loads .env.local from packages/engine/
const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error(
    "CONVEX_URL not found — make sure packages/engine/.env.local exists",
  );
}

export const httpClient = new ConvexHttpClient(CONVEX_URL);
export const liveClient = new ConvexClient(CONVEX_URL);
export { api };
