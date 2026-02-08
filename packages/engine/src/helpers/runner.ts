/**
 * runner.ts — experiment runner helpers
 */
import { api, httpClient } from "./clients";
import { trackExperiment } from "./tracker";
import type { ExperimentSettings } from "./types";

type RunOptions = {
  settings: ExperimentSettings[];
  useNewRun: boolean;
  autoAdvance: boolean;
  runOnce: boolean;
};

// oops, fix runner lol

export async function runExperiments(options: RunOptions) {
  const { settings, useNewRun, autoAdvance, runOnce } = options;
  const runStamp = Date.now();

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

  await Promise.all(runners);
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
