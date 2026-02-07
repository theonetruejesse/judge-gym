/**
 * index.ts — Lab runner
 *
 * Runs the full workflow: init → evidence → rubric → scoring → probing.
 *
 * Usage:
 *   bun src/index.ts
 */
import { client, api, log, poll } from "./shared";
import { TRIAL } from "./experiment";

async function main() {
  const useNewRun =
    process.env.NEW_RUN === "1" || process.env.NEW_RUN === "true";
  const experimentTag = useNewRun
    ? `${TRIAL.experiment.experimentTag}-${Date.now()}`
    : TRIAL.experiment.experimentTag;

  console.log("╔══════════════════════════════════════════╗");
  console.log("║        judge-gym · Lab Runner            ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`  Experiment : ${experimentTag}`);
  console.log(`  Mode       : ${useNewRun ? "new run" : "reuse if exists"}`);
  console.log(`  Model      : ${TRIAL.experiment.modelId}`);
  console.log(`  Concept    : ${TRIAL.window.concept}`);
  console.log(
    `  Window     : ${TRIAL.window.startDate} → ${TRIAL.window.endDate} (${TRIAL.window.country})`,
  );
  console.log(`  Evidence   : ${TRIAL.evidenceLimit} articles (Firecrawl)`);
  console.log(`  Samples    : ${TRIAL.sampleCount}`);
  console.log(`  Scoring    : ${TRIAL.experiment.config.scoringMethod}`);
  console.log(
    `  Scale      : ${TRIAL.experiment.config.scaleSize}-point, ${TRIAL.experiment.config.randomizeLabels ? "labels randomized" : "fixed labels"}`,
  );
  console.log(`  Neutralize : ${TRIAL.experiment.config.neutralizeEvidence}`);
  console.log("");

  // Step 1 — Init experiment (creates or reuses window/experiment)
  log(1, "Initializing experiment...");
  const init = await client.mutation(api.main.initExperiment, {
    window: TRIAL.window,
    experiment: {
      ...TRIAL.experiment,
      experimentTag,
    },
  });
  log(
    1,
    `Window ${init.reusedWindow ? "reused" : "created"} → ${init.windowId}`,
  );
  log(
    1,
    `Experiment ${init.reusedExperiment ? "reused" : "created"} → ${init.experimentId}\n`,
  );

  // Step 2 — Evidence pipeline
  log(2, `Starting evidence pipeline (limit: ${TRIAL.evidenceLimit})...`);
  await client.mutation(api.main.startEvidencePipeline, {
    windowId: init.windowId,
    experimentTag,
    limit: TRIAL.evidenceLimit,
  });
  log(2, "Evidence pipeline kicked off. Polling for completion...\n");

  process.stdout.write("  Waiting");
  await poll(
    () => client.query(api.data.getExperimentSummary, { experimentTag }),
    (s) => s.status === "evidence-done",
    { interval: 5_000, maxAttempts: 120 },
  );
  console.log("\n");
  log(2, "Evidence complete.\n");

  // Step 3 — Rubric generation
  log(3, `Starting rubric generation (count: ${TRIAL.sampleCount})...`);
  await client.mutation(api.main.startRubricGeneration, {
    experimentTag,
    samples: TRIAL.sampleCount,
  });
  log(3, "Rubric generation kicked off. Polling for completion...\n");

  process.stdout.write("  Waiting");
  await poll(
    () => client.query(api.data.getExperimentSummary, { experimentTag }),
    (s) => s.status === "rubric-done",
    { interval: 5_000, maxAttempts: 120 },
  );
  console.log("\n");
  log(3, "Rubric complete.\n");

  // Step 4 — Scoring
  log(4, "Starting scoring trial...");
  await client.mutation(api.main.startScoringTrial, {
    experimentTag,
    samples: TRIAL.sampleCount,
  });
  log(4, "Scoring kicked off. Polling for completion...\n");

  process.stdout.write("  Waiting");
  await poll(
    () => client.query(api.data.getExperimentSummary, { experimentTag }),
    (s) => s.status === "scoring",
    { interval: 5_000, maxAttempts: 240 },
  );
  console.log("\n");
  log(4, "Scoring complete.\n");

  // Step 5 — Probing
  log(5, "Starting probing trial...");
  await client.mutation(api.main.startProbingTrial, { experimentTag });
  log(5, "Probing kicked off. Polling for completion...\n");

  process.stdout.write("  Waiting");
  const summary = await poll(
    () => client.query(api.data.getExperimentSummary, { experimentTag }),
    (s) => s.status === "complete",
    { interval: 5_000, maxAttempts: 240 },
  );
  console.log("\n");

  console.log("┌─────────────────────────────────────────┐");
  console.log("│             Trial Complete              │");
  console.log("└─────────────────────────────────────────┘");
  console.log(`  Status  : ${summary.status}`);
  console.log(`  Samples : ${summary.counts.samples}`);
  console.log(`  Scores  : ${summary.counts.scores}`);
  console.log(`  Probes  : ${summary.counts.probes}`);
}

main().catch((err) => {
  console.error("\nTrial failed:", err?.message ?? err);
  process.exit(1);
});
