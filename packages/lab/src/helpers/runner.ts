/**
 * runner.ts — experiment runner helpers (Lab side)
 */
import { api, httpClient, liveClient } from "./clients";
import { trackRun } from "./tracker";
import type { ExperimentSettings } from "./types";
import { RUN_POLICY } from "../run_policy";

type RunOptions = {
  settings: ExperimentSettings[];
  useNewRun: boolean;
  runOnce: boolean;
};

export async function runExperiments(options: RunOptions) {
  const { settings, useNewRun, runOnce } = options;
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
    const experiment_tag = useNewRun
      ? `${setting.experiment.experiment_tag}-${runStamp}-${index + 1}`
      : setting.experiment.experiment_tag;

    await ensureExperiment({
      experiment_tag,
      setting,
    });

    const { run_id } = await httpClient.mutation(
      api.domain.runs.entrypoints.createRun,
      {
      experiment_tag,
      stop_at_stage: undefined,
      policy: RUN_POLICY,
      },
    );

    await trackRun({
      run_id,
      once: runOnce,
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

export async function bootstrapExperiments(options: {
  settings: ExperimentSettings[];
  useNewRun: boolean;
}): Promise<{ run_ids: string[] }> {
  const { settings, useNewRun } = options;
  const runStamp = Date.now();
  const run_ids: string[] = [];

  for (const [index, setting] of settings.entries()) {
    const experiment_tag = useNewRun
      ? `${setting.experiment.experiment_tag}-${runStamp}-${index + 1}`
      : setting.experiment.experiment_tag;

    await ensureExperiment({
      experiment_tag,
      setting,
    });

    const { run_id } = await httpClient.mutation(
      api.domain.runs.entrypoints.createRun,
      {
      experiment_tag,
      stop_at_stage: undefined,
      policy: RUN_POLICY,
      },
    );
    run_ids.push(run_id);
  }

  return { run_ids };
}

async function ensureExperiment(options: {
  experiment_tag: string;
  setting: ExperimentSettings;
}) {
  const { experiment_tag, setting } = options;

  try {
    await httpClient.mutation(api.domain.experiments.entrypoints.initExperiment, {
      window: setting.window,
      experiment: {
        ...setting.experiment,
        experiment_tag,
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
