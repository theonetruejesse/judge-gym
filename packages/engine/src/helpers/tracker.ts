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
        void maybeAdvance(summary, options, triggered);
      }
      if (options.once) {
        subscription.unsubscribe();
        void liveClient.close();
        process.exit(0);
      }
    },
    (err) => {
      console.error("Tracker subscription error:", err);
    },
  );

  const current = subscription.getCurrentValue();
  if (current) {
    render(current);
  }

  process.on("SIGINT", async () => {
    subscription.unsubscribe();
    await liveClient.close();
    process.exit(0);
  });
}

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
      });
      return;
    }
    case "scoring": {
      if (triggered.has(key("probing"))) return;
      triggered.add(key("probing"));
      await httpClient.mutation(api.main.startProbingTrial, {
        experimentTag: summary.experimentTag,
      });
      return;
    }
    default:
      return;
  }
}
