/**
 * trial.ts — First experimental run
 *
 * Creates a time window, sets up an ECC experiment, and runs the
 * evidence collection pipeline. Polls until evidence is collected,
 * then prints next-step commands for rubric/scoring/probing.
 *
 * Usage:
 *   bun scripts/trial.ts
 */
import { nanoid } from "nanoid";
import { client, api, log, poll } from "./shared";

// ── Trial Configuration ──────────────────────────────────────────

const WINDOW = {
  startDate: "2026-01-01",
  endDate: "2026-01-07",
  country: "USA",
};

const MODEL = "gpt-4.1" as const;
const CONCEPT = "fascism";
const EVIDENCE_LIMIT = 15;

const CONFIG = {
  scaleSize: 4,
  randomizeLabels: true,
  neutralizeEvidence: true,
  scoringMethod: "freeform-suffix-single" as const,
  promptOrdering: "rubric-first" as const,
  abstainEnabled: true,
  freshWindowProbe: true,
};

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const experimentId = `ecc-${CONCEPT}-${WINDOW.country.toLowerCase()}-${nanoid(8)}`;

  console.log("╔══════════════════════════════════════════╗");
  console.log("║        judge-gym · Trial Runner          ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`  Experiment : ${experimentId}`);
  console.log(`  Model      : ${MODEL}`);
  console.log(`  Concept    : ${CONCEPT}`);
  console.log(`  Window     : ${WINDOW.startDate} → ${WINDOW.endDate} (${WINDOW.country})`);
  console.log(`  Evidence   : ${EVIDENCE_LIMIT} articles (Firecrawl)`);
  console.log(`  Scoring    : ${CONFIG.scoringMethod}`);
  console.log(`  Scale      : ${CONFIG.scaleSize}-point, ${CONFIG.randomizeLabels ? "labels randomized" : "fixed labels"}`);
  console.log(`  Neutralize : ${CONFIG.neutralizeEvidence}`);
  console.log("");

  // Step 1 — Create time window
  log(1, "Creating time window...");
  const windowId = await client.mutation(api.main.createWindow, WINDOW);
  log(1, `Window created → ${windowId}\n`);

  // Step 2 — Create experiment
  log(2, "Creating experiment...");
  await client.mutation(api.main.createExperiment, {
    experimentId,
    windowId,
    modelId: MODEL,
    taskType: "ecc",
    concept: CONCEPT,
    config: CONFIG,
  });
  log(2, `Experiment created → ${experimentId}\n`);

  // Step 3 — Start evidence pipeline
  log(3, `Starting evidence pipeline (limit: ${EVIDENCE_LIMIT})...`);
  await client.mutation(api.main.startEvidencePipeline, {
    windowId,
    experimentId,
    limit: EVIDENCE_LIMIT,
  });
  log(3, "Evidence pipeline kicked off. Polling for completion...\n");

  // Step 4 — Poll until evidence-done
  process.stdout.write("  Waiting");
  const summary = await poll(
    () => client.query(api.data.getExperimentSummary, { experimentId }),
    (s) => s.status !== "pending",
    { interval: 5_000, maxAttempts: 120 }, // up to 10 min
  );
  console.log("\n");

  // Print summary
  console.log("┌─────────────────────────────────────────┐");
  console.log("│           Evidence Complete              │");
  console.log("└─────────────────────────────────────────┘");
  console.log(`  Status  : ${summary.status}`);
  console.log(`  Samples : ${summary.counts.samples}`);
  console.log("");

  // Next steps
  console.log("── Next Steps ──────────────────────────────");
  console.log(`  Rubric generation:`);
  console.log(`    npx convex run main:startRubricGeneration '{"experimentId":"${experimentId}"}'`);
  console.log(`  Scoring trial:`);
  console.log(`    npx convex run main:startScoringTrial '{"experimentId":"${experimentId}"}'`);
  console.log(`  Probing trial:`);
  console.log(`    npx convex run main:startProbingTrial '{"experimentId":"${experimentId}"}'`);
  console.log(`  Check status:`);
  console.log(`    npx convex run data:getExperimentSummary '{"experimentId":"${experimentId}"}'`);
}

main().catch((err) => {
  console.error("\nTrial failed:", err.message ?? err);
  process.exit(1);
});
