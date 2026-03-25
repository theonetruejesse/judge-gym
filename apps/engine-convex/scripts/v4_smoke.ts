import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../convex/_generated/api";

type QueueHealth = FunctionReturnType<typeof api.packages.codex.getTemporalTaskQueueHealth>;
type RunSummary = FunctionReturnType<typeof api.packages.lab.getRunSummary>;
type ProcessInspection = FunctionReturnType<typeof api.packages.codex.inspectProcessExecution>;

type Args = {
  model:
    | "gpt-4.1"
    | "gpt-4.1-mini"
    | "gpt-5.2"
    | "gpt-5.2-chat"
    | "claude-sonnet-4"
    | "qwen-current-text-flagship";
  targetCount: number;
  pollMs: number;
  queueTimeoutMs: number;
  runTimeoutMs: number;
};

const DEFAULTS: Args = {
  model: "gpt-4.1-mini",
  targetCount: 1,
  pollMs: 5_000,
  queueTimeoutMs: 60_000,
  runTimeoutMs: 15 * 60_000,
};

function parseArgs(argv: string[]): Args {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
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
      `[v4-smoke] waiting for Temporal queue readiness (${formatMs(Date.now() - startedAt)})`,
      JSON.stringify(health.queues.map(summarizeQueue), null, 2),
    );
    await sleep(args.pollMs);
  }
  throw new Error("Timed out waiting for Temporal task queues to become ready");
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
      `[v4-smoke] run ${runId} status=${summary.status} stage=${summary.current_stage} completed=${summary.completed_count}/${summary.target_count}`,
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
  const runTag = `v4_smoke_${seed}`;

  console.log("[v4-smoke] checking Temporal queue readiness");
  const queueHealth = await waitForQueueReadiness(client, args);

  const universe = await client.mutation(api.packages.evidence.createEvidenceUniverse, {
    universe_tag: `${runTag}_universe`,
    kind: "paper_audit",
    title: `${runTag} universe`,
  });

  const importedItems = await Promise.all([
    client.action(api.packages.evidence.importEvidenceItem, {
      universe_id: universe.universe_id,
      canonical_key: `${runTag}:001`,
      title: "Canary evidence one",
      source_url: "https://example.com/v4-smoke/1",
      source_name: "V4 Smoke Fixture",
      publish_date: "2026-03-24",
      raw_text: "Institutional conflict, judicial independence, and election oversight.",
      source_record_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "v4-smoke-v1",
    }),
    client.action(api.packages.evidence.importEvidenceItem, {
      universe_id: universe.universe_id,
      canonical_key: `${runTag}:002`,
      title: "Canary evidence two",
      source_url: "https://example.com/v4-smoke/2",
      source_name: "V4 Smoke Fixture",
      publish_date: "2026-03-24",
      raw_text: "Executive pressure on media systems and administrative oversight bodies.",
      source_record_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "v4-smoke-v1",
    }),
  ]);

  const evidenceSet = await client.mutation(api.packages.evidence.createEvidenceSet, {
    universe_id: universe.universe_id,
    evidence_set_tag: `${runTag}_set`,
    title: `${runTag} evidence set`,
    source_kind: "manual_import",
    quality_label: "high",
  });

  await client.mutation(api.packages.evidence.addEvidenceSetItems, {
    evidence_set_id: evidenceSet.evidence_set_id,
    items: importedItems.map((item, index) => ({
      evidence_item_id: item.evidence_item_id,
      pinned_source_record_id: item.source_record_id,
      ordinal: index,
      quality_label: "high" as const,
      inclusion_reason: "V4 smoke canary fixture",
    })),
  });

  const experiment = await client.mutation(api.packages.lab.initExperiment, {
    experiment_tag: `${runTag}_experiment`,
    evidence_set_id: evidenceSet.evidence_set_id,
    experiment_config: {
      study_kind: "paper_audit",
      rubric_source_kind: "generate",
      compatibility_mode: "native",
      rubric_config: {
        model: args.model,
        scale_size: 4,
        concept: "institutional democratic erosion",
      },
      scoring_config: {
        model: args.model,
        method: "subset",
        abstain_enabled: true,
        evidence_view: "paper_original",
        randomizations: [
          "anonymize_stages",
          "hide_label_text",
          "shuffle_rubric_order",
        ],
        evidence_bundle_size: 1,
      },
    },
  });

  console.log("[v4-smoke] starting run");
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
    evidence: {
      universe_id: String(universe.universe_id),
      evidence_set_id: String(evidenceSet.evidence_set_id),
      imported_count: importedItems.length,
    },
    experiment: {
      experiment_id: String(experiment.experiment_id),
      experiment_tag: `${runTag}_experiment`,
      evidence_set_id: String(evidenceSet.evidence_set_id),
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
  console.error("[v4-smoke] failed");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
