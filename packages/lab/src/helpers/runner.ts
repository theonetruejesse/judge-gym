/**
 * runner.ts — experiment runner helpers (Lab side)
 */
import { api, httpClient, liveClient } from "./clients";
import { trackRun } from "./tracker";
import type { ExperimentSettings } from "./types";
import { RUN_POLICIES } from "../run_policy";

type RunOptions = {
  settings: ExperimentSettings[];
  useNewRun: boolean;
  runOnce: boolean;
};

export async function ensureExperiments(options: {
  settings: ExperimentSettings[];
}): Promise<{ ensured: string[]; errors: string[] }> {
  const { settings } = options;
  const ensured: string[] = [];
  const errors: string[] = [];

  for (const setting of settings) {
    try {
      await ensureExperiment({
        experiment_tag: setting.experiment.experiment_tag,
        setting,
      });
      ensured.push(setting.experiment.experiment_tag);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${setting.experiment.experiment_tag}: ${message}`);
    }
  }

  return { ensured, errors };
}

export async function createRunsForTags(options: {
  experiment_tags: string[];
}): Promise<{ run_ids: string[]; errors: string[] }> {
  const { experiment_tags } = options;
  const run_ids: string[] = [];
  const errors: string[] = [];

  try {
    const result = await httpClient.mutation(
      api.domain.runs.entrypoints.startExperiments,
      { tags: experiment_tags },
    );
    for (const started of result.started) {
      run_ids.push(started.run_id);
    }
    for (const failed of result.failed) {
      errors.push(`${failed.tag}: ${failed.error}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`startExperiments: ${message}`);
  }

  return { run_ids, errors };
}

export async function collectEvidenceForTags(options: {
  items: Array<{ experiment_tag: string; evidence_limit: number }>;
}): Promise<{ completed: string[]; errors: string[] }> {
  const { items } = options;
  const completed: string[] = [];
  const errors: string[] = [];

  for (const { experiment_tag, evidence_limit } of items) {
    try {
      await httpClient.action(
        api.domain.evidence.entrypoints.collectEvidenceForExperiment,
        {
          experiment_tag,
          evidence_limit,
        },
      );
      completed.push(experiment_tag);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${experiment_tag}: ${message}`);
    }
  }

  return { completed, errors };
}

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
}): Promise<{ run_ids: string[]; errors: string[] }> {
  const { settings, useNewRun } = options;
  const runStamp = Date.now();
  const run_ids: string[] = [];
  const errors: string[] = [];

  for (const [index, setting] of settings.entries()) {
    const experiment_tag = useNewRun
      ? `${setting.experiment.experiment_tag}-${runStamp}-${index + 1}`
      : setting.experiment.experiment_tag;

    try {
      await ensureExperiment({
        experiment_tag,
        setting,
      });

      const { run_id } = await httpClient.mutation(
        api.domain.runs.entrypoints.createRun,
        {
          experiment_tag,
          stop_at_stage: undefined,
        },
      );
      run_ids.push(run_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${experiment_tag}: ${message}`);
    }
  }

  return { run_ids, errors };
}

async function ensureExperiment(options: {
  experiment_tag: string;
  setting: ExperimentSettings;
}) {
  const { experiment_tag, setting } = options;

  try {
    await httpClient.mutation(api.domain.configs.entrypoints.seedConfigTemplate, {
      template_id: experiment_tag,
      version: 1,
      schema_version: 1,
      config_body: {
        window: setting.window,
        experiment: {
          ...setting.experiment,
          experiment_tag,
        },
        policies: RUN_POLICIES,
      },
      created_by: "lab",
      notes: "lab seed",
    });

    await httpClient.mutation(
      api.domain.experiments.entrypoints.initExperimentFromTemplate,
      {
        template_id: experiment_tag,
        version: 1,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to connect to Convex or init experiment. ${message}\n` +
        "Is the Convex dev server running and CONVEX_URL set?",
    );
  }
}
