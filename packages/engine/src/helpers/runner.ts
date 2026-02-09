/**
 * runner.ts — experiment runner helpers
 */
import { api, httpClient, liveClient } from "./clients";
import { trackExperiment } from "./tracker";
import type { ExperimentSettings } from "./types";

type RunOptions = {
  settings: ExperimentSettings[];
  useNewRun: boolean;
  autoAdvance: boolean;
  runOnce: boolean;
};

/**
 * Orchestrates and runs a batch of experiments according to the provided options.
 *
 * @param options - Configuration for the run:
 *   - `settings`: array of ExperimentSettings to run.
 *   - `useNewRun`: when true, appends a timestamp and 1-based index to each experiment's tag to create a new run-specific tag.
 *   - `autoAdvance`: whether experiments should automatically advance between steps.
 *   - `runOnce`: whether each experiment should execute only once.
 */

export async function runExperiments(options: RunOptions) {
  const { settings, useNewRun, autoAdvance, runOnce } = options;
  const runStamp = Date.now();
  let cleaningUp = false;
  const cleanup = async (exitCode: number) => {
    if (cleaningUp) return;
    cleaningUp = true;
    try {
      await liveClient.close();
    } catch (err) {
      console.error("Error closing client:", err);
    }
    process.exit(exitCode);
  };
  process.on("SIGINT", () => {
    void cleanup(0);
  });

  const runners = settings.map(async (setting, index) => {
    const experimentTag = useNewRun
      ? `${setting.experiment.experimentTag}-${runStamp}-${index + 1}`
      : setting.experiment.experimentTag;

    await ensureExperiment({
      experimentTag,
      setting,
    });

    await trackExperiment({
      experimentTag,
      once: runOnce,
      autoAdvance,
      evidenceLimit: setting.evidenceLimit,
      sampleCount: setting.sampleCount,
    });
  });

  const results = await Promise.allSettled(runners);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length > 0) {
    console.error(
      `${failures.length} experiment(s) failed:`,
      failures.map((failure) => failure.reason),
    );
  }
  await cleanup(failures.length > 0 ? 1 : 0);
}

async function ensureExperiment(options: {
  experimentTag: string;
  setting: ExperimentSettings;
}) {
  const { experimentTag, setting } = options;

  try {
    await httpClient.mutation(api.main.initExperiment, {
      window: setting.window,
      experiment: {
        ...setting.experiment,
        experimentTag,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to connect to Convex or init experiment. ${message}\n` +
      "Is the Convex dev server running and CONVEX_URL set?",
    );
  }
}
