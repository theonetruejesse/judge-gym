import { api, httpClient, liveClient } from "./clients";
import {
  renderChecklist,
  renderConfigSummary,
  renderHeader,
  renderSummary,
  type RunSummary,
} from "./console";

export async function trackRun(options: {
  run_id: string;
  once?: boolean;
}): Promise<void> {
  return await new Promise((resolve, reject) => {
    const render = (summary: RunSummary) => {
      console.clear();
      console.log(renderHeader("judge-gym · Run Tracker"));
      console.log(renderSummary(summary));
      console.log("");
      console.log(renderConfigSummary(summary.config));
      console.log(renderChecklist(summary));
    };

    const subscription = liveClient.onUpdate(
      api.domain.experiments.data.getRunSummary,
      { run_id: options.run_id },
      (summary) => {
        render(summary);
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

export async function pauseRun(run_id: string) {
  await httpClient.mutation(api.domain.runs.entrypoints.updateRunState, {
    run_id,
    desired_state: "paused",
  });
}

export async function cancelRun(run_id: string) {
  await httpClient.mutation(api.domain.runs.entrypoints.updateRunState, {
    run_id,
    desired_state: "canceled",
  });
}
