import { api, httpClient, liveClient } from "./clients";
import {
  renderChecklist,
  renderConfigSummary,
  renderHeader,
  renderSummary,
  type ExperimentSummary,
} from "./console";

export async function trackExperiment(options: {
  experimentTag: string;
  once?: boolean;
  autoAdvance?: boolean;
  evidenceLimit?: number;
  sampleCount?: number;
}): Promise<void> {
  const triggered = new Set<string>();

  return await new Promise((resolve, reject) => {
    const render = (summary: ExperimentSummary) => {
      console.clear();
      console.log(renderHeader("judge-gym · Experiment Tracker"));
      console.log(renderSummary(summary));
      console.log("");
      console.log(renderConfigSummary(summary.config));
      console.log(renderChecklist(summary));
    };

    const subscription = liveClient.onUpdate(
      api.data.getExperimentSummary,
      { experimentTag: options.experimentTag },
      (summary) => {
        render(summary);
        if (options.autoAdvance) {
          void maybeAdvance(summary, options, triggered).catch((err) => {
            console.error("Auto-advance failed:", err);
          });
        }
        if (options.once || summary.status === "complete") {
          subscription.unsubscribe();
          resolve();
        }
      },
      (err) => {
        console.error("Tracker subscription error:", err);
        subscription.unsubscribe();
        reject(err);
      },
    );

    const current = subscription.getCurrentValue();
    if (current) {
      render(current);
      if (current.status === "complete") {
        subscription.unsubscribe();
        resolve();
        return;
      }
    }

  });
}

/**
 * Initiates the next experiment progression step by sending the appropriate backend mutation based on the experiment summary.
 *
 * Determines which advancement action to take from `summary.status` ("pending", "evidence-done", "rubric-done") and issues the corresponding HTTP mutation (start evidence pipeline, start rubric generation, or start scoring trial). Uses `triggered` to ensure each stage is initiated at most once per run.
 *
 * @param summary - Current experiment summary containing status, windowId, and experimentTag
 * @param options.experimentTag - Tag identifying the experiment to advance
 * @param options.evidenceLimit - Optional limit for evidence window passed to evidence/scoring mutations
 * @param options.sampleCount - Optional number of samples to request for rubric/scoring; defaults to 5
 * @param triggered - Set used to record and prevent duplicate triggers for a given experiment stage
 */
async function maybeAdvance(
  summary: ExperimentSummary,
  options: {
    experimentTag: string;
    evidenceLimit?: number;
    sampleCount?: number;
  },
  triggered: Set<string>,
) {
  const key = (stage: string) => `${summary.experimentTag}:${stage}`;
  const sampleCount = options.sampleCount ?? 5;

  switch (summary.status) {
    case "pending": {
      if (triggered.has(key("evidence"))) return;
      triggered.add(key("evidence"));
      await httpClient.mutation(api.main.startEvidencePipeline, {
        windowId: summary.windowId,
        experimentTag: summary.experimentTag,
        limit: options.evidenceLimit,
      });
      return;
    }
    case "evidence-done": {
      if (triggered.has(key("rubric"))) return;
      triggered.add(key("rubric"));
      await httpClient.mutation(api.main.startRubricGeneration, {
        experimentTag: summary.experimentTag,
        samples: sampleCount,
      });
      return;
    }
    case "rubric-done": {
      if (triggered.has(key("scoring"))) return;
      triggered.add(key("scoring"));
      await httpClient.mutation(api.main.startScoringTrial, {
        experimentTag: summary.experimentTag,
        samples: sampleCount,
        evidenceLimit: options.evidenceLimit,
      });
      return;
    }
    default:
      return;
  }
}
