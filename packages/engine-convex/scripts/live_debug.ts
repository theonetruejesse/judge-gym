import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Args = {
  command: "watch" | "stuck" | "heal" | "tail" | "analyze" | "inspect" | "control" | "queues" | "campaign";
  processType?: "run" | "window";
  processId?: string;
  traceId?: string;
  action?: "set_pause_after" | "pause_now" | "resume" | "cancel" | "repair_bounded";
  pauseAfter?: string;
  operation?: "reproject_snapshot" | "resume_if_paused" | "clear_pause_after";
  cmdId?: string;
  note?: string;
  olderMs: number;
  limit: number;
  intervalMs: number;
  maxEvents: number;
  cursor?: number;
  maxActions?: number;
  apply: boolean;
  manifestPath: string;
};

function parseArgs(argv: string[]): Args {
  const command = (argv[0] ?? "watch") as Args["command"];
  let processType: Args["processType"];
  let processId: string | undefined;
  let traceId: string | undefined;
  let action: Args["action"];
  let pauseAfter: string | undefined;
  let operation: Args["operation"];
  let cmdId: string | undefined;
  let note: string | undefined;
  let olderMs = 120_000;
  let limit = 50;
  let intervalMs = 4_000;
  let maxEvents = 5_000;
  let cursor: number | undefined;
  let maxActions: number | undefined;
  let apply = false;
  let manifestPath = "_campaigns/v3_finish_pass/manifest.json";

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--run" && argv[i + 1]) {
      processType = "run";
      processId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--window" && argv[i + 1]) {
      processType = "window";
      processId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--trace" && argv[i + 1]) {
      traceId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--action" && argv[i + 1]) {
      action = argv[i + 1] as Args["action"];
      i += 1;
      continue;
    }
    if (arg === "--pause-after" && argv[i + 1]) {
      pauseAfter = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--operation" && argv[i + 1]) {
      operation = argv[i + 1] as Args["operation"];
      i += 1;
      continue;
    }
    if (arg === "--cmd-id" && argv[i + 1]) {
      cmdId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--note" && argv[i + 1]) {
      note = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--older-ms" && argv[i + 1]) {
      olderMs = Number(argv[i + 1]) || olderMs;
      i += 1;
      continue;
    }
    if (arg === "--limit" && argv[i + 1]) {
      limit = Number(argv[i + 1]) || limit;
      i += 1;
      continue;
    }
    if (arg === "--interval-ms" && argv[i + 1]) {
      intervalMs = Number(argv[i + 1]) || intervalMs;
      i += 1;
      continue;
    }
    if (arg === "--max-events" && argv[i + 1]) {
      maxEvents = Number(argv[i + 1]) || maxEvents;
      i += 1;
      continue;
    }
    if (arg === "--cursor" && argv[i + 1]) {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value >= 0) {
        cursor = value;
      }
      i += 1;
      continue;
    }
    if (arg === "--max-actions" && argv[i + 1]) {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value > 0) {
        maxActions = value;
      }
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--manifest" && argv[i + 1]) {
      manifestPath = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return {
    command,
    processType,
    processId,
    traceId,
    action,
    pauseAfter,
    operation,
    cmdId,
    note,
    olderMs,
    limit,
    intervalMs,
    maxEvents,
    cursor,
    maxActions,
    apply,
    manifestPath,
  };
}

function parseJsonFromStdout(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    try {
      return JSON.parse(line);
    } catch {
      // keep scanning
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Could not parse Convex output as JSON:\n${trimmed}`);
  }
}

function runConvex(functionName: string, payload: object) {
  const candidates = functionName.startsWith("domain/maintenance/codex:")
    ? [functionName]
    : [
      functionName,
      functionName.replace("packages/codex:", "domain/maintenance/codex:"),
    ];
  const localConvexBin = path.join(process.cwd(), "node_modules", ".bin", "convex");
  const hasLocalConvexBin = existsSync(localConvexBin);

  let lastError: string | null = null;
  for (const candidate of candidates) {
    const command = hasLocalConvexBin ? localConvexBin : "npx";
    const args = hasLocalConvexBin
      ? ["run", candidate, JSON.stringify(payload)]
      : ["-y", "convex@latest", "run", candidate, JSON.stringify(payload)];

    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    if (result.status === 0) {
      return parseJsonFromStdout(result.stdout ?? "");
    }
    lastError = [
      `Convex call failed: ${candidate}`,
      `stdout: ${result.stdout?.trim() ?? ""}`,
      `stderr: ${result.stderr?.trim() ?? ""}`,
    ].join("\n");
  }
  throw new Error(lastError ?? `Convex call failed: ${functionName}`);
}

function requireProcess(args: Args) {
  if (!args.processType || !args.processId) {
    throw new Error("Expected one of --run <id> or --window <id>");
  }
}

function printHealth(data: any) {
  const stage = data.stage_progress.find((row: any) => row.stage === data.current_stage);
  console.log(`\n[${new Date().toISOString()}] ${data.process_type}:${data.process_id}`);
  console.log(`status=${data.status} stage=${data.current_stage} backend=${data.telemetry_backend}`);
  if (data.external_trace_ref) {
    console.log(`trace_ref=${data.external_trace_ref}`);
  }
  if (stage) {
    console.log(
      `stage_progress total=${stage.target_total} completed=${stage.completed} pending=${stage.pending} failed=${stage.failed}`,
    );
  }
  console.log(
    `execution workflow_bound=${data.execution_binding.workflow_bound} projection_fresh=${data.execution_binding.projection_fresh} workflow_id=${data.execution_binding.workflow_id ?? "null"} workflow_run_id=${data.execution_binding.workflow_run_id ?? "null"}`,
  );
  console.log(
    `stalled no_progress_ms=${data.stalled_signals.no_progress_for_ms ?? "null"} oldest_pending_ms=${data.stalled_signals.oldest_pending_request_age_ms ?? "null"} latest_projection_ms=${data.projection_meta.latest_updated_at_ms ?? "null"}`,
  );
  if (Array.isArray(data.error_summary) && data.error_summary.length > 0) {
    const summary = data.error_summary.map((row: any) => `${row.class}:${row.count}`).join(", ");
    console.log(`errors ${summary}`);
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWatch(args: Args) {
  requireProcess(args);
  while (true) {
    const health = runConvex("packages/codex:getProcessHealth", {
      process_type: args.processType,
      process_id: args.processId,
      include_recent_events: args.limit,
    }) as any;
    printHealth(health);
    await sleep(args.intervalMs);
  }
}

function runStuck(args: Args) {
  const result = runConvex("packages/codex:getStuckWork", {
    process_type: args.processType,
    older_than_ms: args.olderMs,
    limit: args.limit,
  }) as any;

  console.log(JSON.stringify(result, null, 2));
}

function runHeal(args: Args) {
  requireProcess(args);
  const result = runConvex("packages/codex:autoHealProcess", {
    process_type: args.processType,
    process_id: args.processId,
    older_than_ms: args.olderMs,
    dry_run: !args.apply,
    cursor: args.cursor,
    max_actions: args.maxActions,
  }) as any;

  console.log(JSON.stringify(result, null, 2));
}

function runTail(args: Args) {
  const trace = args.traceId
    ?? (args.processType && args.processId ? `${args.processType}:${args.processId}` : null);
  if (!trace) {
    throw new Error("Expected --trace <trace_id> or --run/--window");
  }

  const result = runConvex("packages/codex:tailTrace", {
    trace_id: trace,
    limit: args.limit,
  }) as any;

  console.log(JSON.stringify(result, null, 2));
}

function formatMs(ms: number | null): string {
  if (ms == null) return "null";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function runAnalyze(args: Args) {
  requireProcess(args);
  const result = runConvex("packages/codex:analyzeProcessTelemetry", {
    process_type: args.processType,
    process_id: args.processId,
    max_events: args.maxEvents,
  }) as any;

  console.log(`process=${result.process_type}:${result.process_id}`);
  console.log(`trace=${result.trace_id}`);
  console.log(`backend=${result.telemetry_backend}`);
  if (result.external_trace_ref) {
    console.log(`trace_ref=${result.external_trace_ref}`);
  }
  console.log(`sampled_events=${result.sampled_events} reached_end=${result.reached_end_of_trace}`);
  console.log(
    `seq_range=${result.seq_min ?? "null"}..${result.seq_max ?? "null"} missing=${result.missing_seq_count} dup=${result.duplicate_seq_count}`,
  );
  console.log(
    `duration=${formatMs(result.duration_ms)} terminal=${result.terminal_stats.terminal_event_name ?? "null"} events_after_terminal=${result.terminal_stats.events_after_terminal}`,
  );
  console.log(
    `requests unique=${result.request_stats.unique_request_entities} applied=${result.request_stats.request_applied_total} duplicate_apply=${result.request_stats.duplicate_apply_success_total} dup_requests=${result.request_stats.requests_with_duplicate_apply_success} max_dup_per_request=${result.request_stats.max_duplicate_apply_success_per_request}`,
  );
  console.log(
    `jobs unique=${result.job_stats.unique_job_entities} finalized=${result.job_stats.job_finalized_total} multi_finalized=${result.job_stats.jobs_finalized_multiple_times} max_finalized_per_job=${result.job_stats.max_job_finalized_per_job}`,
  );
  console.log("");
  console.log("top_events:");
  for (const row of result.event_counts.slice(0, 12)) {
    console.log(`  ${row.event_name}: ${row.count}`);
  }
  console.log("");
  console.log("stage_summaries:");
  for (const stage of result.stage_summaries) {
    console.log(
      `  ${stage.stage} route=${stage.route} duration=${formatMs(stage.duration_ms)} applied=${stage.request_applied} duplicate_apply=${stage.request_apply_duplicate_success} request_error=${stage.request_error} job_poll=${stage.job_running_polled} job_finalized=${stage.job_finalized} batch_polled=${stage.batch_polled} batch_success=${stage.batch_success}`,
    );
  }
}

function runInspect(args: Args) {
  requireProcess(args);
  const result = runConvex("packages/codex:inspectProcessExecution", {
    process_type: args.processType,
    process_id: args.processId,
    include_recent_events: args.limit,
  }) as any;

  console.log(JSON.stringify(result, null, 2));
}

function runControl(args: Args) {
  requireProcess(args);
  if (!args.action) {
    throw new Error("Expected --action <set_pause_after|pause_now|resume|cancel|repair_bounded>");
  }

  const result = runConvex("packages/codex:controlProcessExecution", {
    process_type: args.processType,
    process_id: args.processId,
    action: args.action,
    pause_after: args.pauseAfter ?? undefined,
    operation: args.operation ?? undefined,
    cmd_id: args.cmdId ?? undefined,
    note: args.note ?? undefined,
  }) as any;

  console.log(JSON.stringify(result, null, 2));
}

function runQueues() {
  const result = runConvex("packages/codex:getTemporalTaskQueueHealth", {}) as any;
  console.log(JSON.stringify(result, null, 2));
}

function runCampaign(args: Args) {
  const manifest = JSON.parse(readFileSync(args.manifestPath, "utf8")) as {
    required_experiment_tags?: string[];
  };
  const result = runConvex("packages/codex:getV3CampaignSnapshot", {
    experiment_tags: manifest.required_experiment_tags ?? [],
  }) as any;
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "watch") {
    await runWatch(args);
    return;
  }
  if (args.command === "stuck") {
    runStuck(args);
    return;
  }
  if (args.command === "heal") {
    runHeal(args);
    return;
  }
  if (args.command === "tail") {
    runTail(args);
    return;
  }
  if (args.command === "analyze") {
    runAnalyze(args);
    return;
  }
  if (args.command === "inspect") {
    runInspect(args);
    return;
  }
  if (args.command === "control") {
    runControl(args);
    return;
  }
  if (args.command === "queues") {
    runQueues();
    return;
  }
  if (args.command === "campaign") {
    runCampaign(args);
    return;
  }

  throw new Error(`Unsupported command: ${args.command}`);
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
