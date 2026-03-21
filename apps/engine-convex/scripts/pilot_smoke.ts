import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../convex/_generated/api";

type QueueHealth = FunctionReturnType<typeof api.packages.codex.getTemporalTaskQueueHealth>;
type WindowSummary = FunctionReturnType<typeof api.packages.lab.getWindowSummary>;
type RunSummary = FunctionReturnType<typeof api.packages.lab.getRunSummary>;
type ProcessInspection = FunctionReturnType<typeof api.packages.codex.inspectProcessExecution>;

type Args = {
  query: string;
  country: string;
  startDate: string;
  endDate: string;
  evidenceLimit: number;
  model: "gpt-4.1" | "gpt-4.1-mini" | "gpt-5.2" | "gpt-5.2-chat";
  targetCount: number;
  pollMs: number;
  queueTimeoutMs: number;
  windowTimeoutMs: number;
  runTimeoutMs: number;
};

const DEFAULTS: Args = {
  query: "United States democracy election courts press freedom",
  country: "USA",
  startDate: "2025-10-01",
  endDate: "2026-03-15",
  evidenceLimit: 2,
  model: "gpt-4.1-mini",
  targetCount: 1,
  pollMs: 5_000,
  queueTimeoutMs: 60_000,
  windowTimeoutMs: 10 * 60_000,
  runTimeoutMs: 15 * 60_000,
};

function parseArgs(argv: string[]): Args {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--query" && next) {
      args.query = next;
      i += 1;
      continue;
    }
    if (arg === "--country" && next) {
      args.country = next;
      i += 1;
      continue;
    }
    if (arg === "--start-date" && next) {
      args.startDate = next;
      i += 1;
      continue;
    }
    if (arg === "--end-date" && next) {
      args.endDate = next;
      i += 1;
      continue;
    }
    if (arg === "--evidence-limit" && next) {
      args.evidenceLimit = Number(next) || args.evidenceLimit;
      i += 1;
      continue;
    }
    if (arg === "--model" && next) {
      args.model = next as Args["model"];
      i += 1;
      continue;
    }
    if (arg === "--target-count" && next) {
      args.targetCount = Number(next) || args.targetCount;
      i += 1;
      continue;
    }
    if (arg === "--poll-ms" && next) {
      args.pollMs = Number(next) || args.pollMs;
      i += 1;
      continue;
    }
    if (arg === "--queue-timeout-ms" && next) {
      args.queueTimeoutMs = Number(next) || args.queueTimeoutMs;
      i += 1;
      continue;
    }
    if (arg === "--window-timeout-ms" && next) {
      args.windowTimeoutMs = Number(next) || args.windowTimeoutMs;
      i += 1;
      continue;
    }
    if (arg === "--run-timeout-ms" && next) {
      args.runTimeoutMs = Number(next) || args.runTimeoutMs;
      i += 1;
      continue;
    }
  }
  return args;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function summarizeQueue(queue: QueueHealth["queues"][number]) {
  return {
    task_queue: queue.task_queue,
    ready: queue.ready,
    workflow_poller_count: queue.workflow_poller_count,
    activity_poller_count: queue.activity_poller_count,
    approximate_backlog_count: queue.approximate_backlog_count,
    approximate_backlog_age_ms: queue.approximate_backlog_age_ms,
  };
}

async function waitForQueueReadiness(
  client: ConvexHttpClient,
  args: Args,
): Promise<QueueHealth> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < args.queueTimeoutMs) {
    const health = await client.action(api.packages.codex.getTemporalTaskQueueHealth, {});
    if (health.all_ready) {
      return health;
    }
    console.log(
      `[pilot-smoke] waiting for Temporal queue readiness (${formatMs(Date.now() - startedAt)})`,
      JSON.stringify(health.queues.map(summarizeQueue), null, 2),
    );
    await sleep(args.pollMs);
  }
  throw new Error("Timed out waiting for Temporal task queues to become ready");
}

async function waitForWindowCompletion(
  client: ConvexHttpClient,
  windowId: string,
  args: Args,
): Promise<{ summary: WindowSummary; inspection: ProcessInspection }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < args.windowTimeoutMs) {
    const [summary, inspection] = await Promise.all([
      client.query(api.packages.lab.getWindowSummary, { window_id: windowId as never }),
      client.action(api.packages.codex.inspectProcessExecution, {
        process_type: "window",
        process_id: windowId,
      }),
    ]);

    console.log(
      `[pilot-smoke] window ${windowId} status=${summary.status} stage=${summary.current_stage} completed=${summary.completed_count}/${summary.target_count}`,
    );

    if (
      inspection.temporal.temporal_status === "FAILED"
      || inspection.temporal.temporal_status === "TERMINATED"
      || summary.status === "error"
      || summary.status === "canceled"
    ) {
      throw new Error(
        `Window failed: status=${summary.status} temporal=${inspection.temporal.temporal_status} error=${inspection.temporal.snapshot?.lastErrorMessage ?? inspection.temporal.snapshot_query_error ?? "unknown"}`,
      );
    }

    if (summary.status === "completed") {
      return { summary, inspection };
    }

    await sleep(args.pollMs);
  }
  throw new Error(`Timed out waiting for window ${windowId} to complete`);
}

async function waitForRunCompletion(
  client: ConvexHttpClient,
  runId: string,
  args: Args,
): Promise<{ summary: RunSummary; inspection: ProcessInspection }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < args.runTimeoutMs) {
    const [summary, inspection] = await Promise.all([
      client.query(api.packages.lab.getRunSummary, { run_id: runId as never }),
      client.action(api.packages.codex.inspectProcessExecution, {
        process_type: "run",
        process_id: runId,
      }),
    ]);

    console.log(
      `[pilot-smoke] run ${runId} status=${summary.status} stage=${summary.current_stage} completed=${summary.completed_count}/${summary.target_count}`,
    );

    if (
      inspection.temporal.temporal_status === "FAILED"
      || inspection.temporal.temporal_status === "TERMINATED"
      || summary.status === "error"
      || summary.status === "canceled"
    ) {
      throw new Error(
        `Run failed: status=${summary.status} temporal=${inspection.temporal.temporal_status} error=${inspection.temporal.snapshot?.lastErrorMessage ?? inspection.temporal.snapshot_query_error ?? "unknown"}`,
      );
    }

    if (summary.status === "completed") {
      return { summary, inspection };
    }

    await sleep(args.pollMs);
  }
  throw new Error(`Timed out waiting for run ${runId} to complete`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const convexUrl = requireEnv("CONVEX_URL");
  const client = new ConvexHttpClient(convexUrl);
  const seed = Date.now();
  const runTag = `pilot_smoke_${seed}`;

  console.log("[pilot-smoke] checking Temporal queue readiness");
  const queueHealth = await waitForQueueReadiness(client, args);

  console.log("[pilot-smoke] creating window");
  const createdWindow = await client.mutation(api.packages.lab.createWindowForm, {
    evidence_window: {
      query: args.query,
      country: args.country,
      start_date: args.startDate,
      end_date: args.endDate,
      model: args.model,
    },
    evidence_limit: args.evidenceLimit,
  });

  const windowId = String(createdWindow.window_id);
  const completedWindow = await waitForWindowCompletion(client, windowId, args);
  const evidenceRows = await client.query(api.packages.lab.listEvidenceByWindow, {
    window_id: createdWindow.window_id,
  });
  if (evidenceRows.length === 0) {
    throw new Error(`Window ${windowId} completed without evidence rows`);
  }

  console.log("[pilot-smoke] creating pool and experiment");
  const pool = await client.mutation(api.packages.lab.createPool, {
    evidence_ids: evidenceRows.map((row) => row.evidence_id),
    pool_tag: `${runTag}_pool`,
  });

  const experiment = await client.mutation(api.packages.lab.initExperiment, {
    experiment_tag: `${runTag}_experiment`,
    pool_id: pool.pool_id,
    experiment_config: {
      rubric_config: {
        model: args.model,
        scale_size: 4,
        concept: "fascism",
      },
      scoring_config: {
        model: args.model,
        method: "subset",
        abstain_enabled: true,
        evidence_view: "l2_neutralized",
        randomizations: [
          "anonymize_stages",
          "hide_label_text",
          "shuffle_rubric_order",
        ],
        evidence_bundle_size: 1,
      },
    },
  });

  console.log("[pilot-smoke] starting run");
  const startedRun = await client.mutation(api.packages.lab.startExperimentRun, {
    experiment_id: experiment.experiment_id,
    target_count: args.targetCount,
    pause_after: null,
  });

  const runId = String(startedRun.run_id);
  const completedRun = await waitForRunCompletion(client, runId, args);
  const diagnostics = await client.query(api.packages.lab.getRunDiagnostics, {
    run_id: startedRun.run_id,
  });

  const output = {
    queue_health: {
      checked_at_ms: queueHealth.checked_at_ms,
      queues: queueHealth.queues.map(summarizeQueue),
    },
    window: {
      window_id: windowId,
      status: completedWindow.summary.status,
      current_stage: completedWindow.summary.current_stage,
      completed_count: completedWindow.summary.completed_count,
      evidence_count: evidenceRows.length,
      workflow_id: completedWindow.inspection.temporal.workflow_id,
      workflow_run_id: completedWindow.inspection.temporal.workflow_run_id,
    },
    experiment: {
      experiment_id: String(experiment.experiment_id),
      experiment_tag: `${runTag}_experiment`,
      pool_id: String(pool.pool_id),
    },
    run: {
      run_id: runId,
      status: completedRun.summary.status,
      current_stage: completedRun.summary.current_stage,
      completed_count: completedRun.summary.completed_count,
      has_failures: completedRun.summary.has_failures,
      workflow_id: completedRun.inspection.temporal.workflow_id,
      workflow_run_id: completedRun.inspection.temporal.workflow_run_id,
      terminal_failed_targets: diagnostics.terminal_failed_targets.length,
      failed_requests: diagnostics.failed_requests.length,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error("[pilot-smoke] failed");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
