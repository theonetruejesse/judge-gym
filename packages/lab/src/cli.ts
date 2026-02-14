import process from "node:process";
import { api, httpClient, liveClient } from "./helpers/clients";
import {
  renderChecklist,
  renderConfigSummary,
  renderHeader,
  renderSummary,
  type RunSummary,
} from "./helpers/console";

function usage() {
  console.log(
    [
      "Usage:",
      "  experiments status <tag|run_id> [--json]",
      "  experiments watch <tag|run_id> [--json]",
      "  experiments start --tags a,b,c",
      "  experiments start <tag>",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]) {
  const args = argv[0] === "experiments" ? argv.slice(1) : argv;
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const json = flags.has("--json");
  return { args, json };
}

async function renderRunSummary(summary: RunSummary, json: boolean) {
  if (json) {
    console.log(JSON.stringify(summary));
    return;
  }
  console.clear();
  console.log(renderHeader("judge-gym · Run Status"));
  console.log(renderSummary(summary));
  console.log("");
  console.log(renderConfigSummary(summary.config));
  console.log(renderChecklist(summary));
}

function renderExperimentStatus(status: any, json: boolean) {
  if (json) {
    console.log(JSON.stringify(status));
    return;
  }
  const windowLabel = status.window
    ? `${status.window.start_date}..${status.window.end_date} ${status.window.country} ${status.window.concept}`
    : "—";
  const rubricStatus = status.rubric?.parse_status ?? "missing";
  const latest = status.latest_run;
  const runLabel = latest
    ? `${latest.status} · stage: ${latest.current_stage ?? "—"}`
    : "none";
  console.clear();
  console.log(renderHeader("judge-gym · Experiment Status"));
  console.log(`  Experiment : ${status.experiment_tag}`);
  console.log(`  Window     : ${windowLabel}`);
  console.log(`  Evidence   : ${status.evidence_total ?? 0}`);
  console.log(`  Neutralized: ${status.evidence_neutralized ?? 0}`);
  console.log(`  Rubric     : ${rubricStatus}`);
  console.log(`  Runs       : ${status.run_count ?? 0}`);
  console.log(`  Latest     : ${runLabel}`);
}

async function main() {
  const { args, json } = parseArgs(process.argv.slice(2));
  const [command, target, ...rest] = args;

  if (!command) {
    usage();
    process.exit(1);
  }

  if (command === "start") {
    const tagsFlagIndex = rest.indexOf("--tags");
    let tags: string[] = [];
    if (tagsFlagIndex >= 0) {
      const value = rest[tagsFlagIndex + 1] ?? "";
      tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    } else if (target) {
      tags = [target];
    }
    if (tags.length === 0) {
      usage();
      process.exit(1);
    }
    const result = await httpClient.mutation(
      api.domain.runs.entrypoints.startExperiments,
      { tags },
    );
    if (json) {
      console.log(JSON.stringify(result));
      return;
    }
    if (result.started.length > 0) {
      console.log(
        `Started ${result.started.length} run(s): ${result.started
          .map((row) => row.tag)
          .join(", ")}`,
      );
    }
    if (result.failed.length > 0) {
      console.log(
        `Failed ${result.failed.length} run(s): ${result.failed
          .map((row) => `${row.tag} (${row.error})`)
          .join(", ")}`,
      );
    }
    return;
  }

  if (!target) {
    usage();
    process.exit(1);
  }

  if (command === "status") {
    try {
      const runSummary = await httpClient.query(
        api.domain.experiments.data.getRunSummary,
        { run_id: target },
      );
      await renderRunSummary(runSummary, json);
      return;
    } catch {
      // fall through to experiment status
    }

    const status = await httpClient.query(
      api.domain.experiments.status.getExperimentStatus,
      { experiment_tag: target },
    );
    if (!status.exists) {
      console.error(`Experiment not found: ${target}`);
      process.exit(1);
    }
    renderExperimentStatus(status, json);
    return;
  }

  if (command === "watch") {
    let isRun = false;
    try {
      const current = await httpClient.query(
        api.domain.experiments.data.getRunSummary,
        { run_id: target },
      );
      isRun = true;
      await renderRunSummary(current, json);
    } catch {
      isRun = false;
    }

    if (isRun) {
      const subscription = liveClient.onUpdate(
        api.domain.experiments.data.getRunSummary,
        { run_id: target },
        async (summary) => {
          await renderRunSummary(summary, json);
          if (summary.status === "complete") {
            subscription.unsubscribe();
            process.exit(0);
          }
        },
        (err) => {
          console.error("Watch error:", err);
          subscription.unsubscribe();
          process.exit(1);
        },
      );
      return;
    }

    const subscription = liveClient.onUpdate(
      api.domain.experiments.status.getExperimentStatus,
      { experiment_tag: target },
      (status) => {
        if (!status.exists) return;
        renderExperimentStatus(status, json);
      },
      (err) => {
        console.error("Watch error:", err);
        subscription.unsubscribe();
        process.exit(1);
      },
    );
    const current = subscription.getCurrentValue();
    if (current && current.exists) {
      renderExperimentStatus(current, json);
    }
    return;
  }

  usage();
  process.exit(1);
}

void main();
