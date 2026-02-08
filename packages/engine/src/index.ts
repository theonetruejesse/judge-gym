/**
 * index.ts — Automated experiment runner + tracker
 *
 * Starts (or reuses) an experiment and advances all stages in order,
 * while rendering a live checklist in the console.
 *
 * Usage:
 *   bun src/index.ts
 */
import { EXPERIMENT_SETTINGS } from "./experiments";
import { runExperiments } from "./helpers/runner";

// === Server settings ===
const USE_NEW_RUN =
  process.env.NEW_RUN === "1" || process.env.NEW_RUN === "true";
const AUTO_ADVANCE =
  process.env.AUTO_ADVANCE === "0" || process.env.AUTO_ADVANCE === "false"
    ? false
    : true;
const RUN_ONCE = process.env.ONCE === "1" || process.env.ONCE === "true";

async function main() {
  await runExperiments({
    settings: EXPERIMENT_SETTINGS,
    useNewRun: USE_NEW_RUN,
    autoAdvance: AUTO_ADVANCE,
    runOnce: RUN_ONCE,
  });
}

main().catch((err) => {
  console.error("\nRunner failed:", err?.message ?? err);
  process.exit(1);
});
