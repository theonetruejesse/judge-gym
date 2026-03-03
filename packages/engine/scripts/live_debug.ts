import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

type Args = {
  command: "watch" | "stuck" | "heal" | "tail";
  processType?: "run" | "window";
  processId?: string;
  traceId?: string;
  olderMs: number;
  limit: number;
  intervalMs: number;
  apply: boolean;
};

function parseArgs(argv: string[]): Args {
  const command = (argv[0] ?? "watch") as Args["command"];
  let processType: Args["processType"];
  let processId: string | undefined;
  let traceId: string | undefined;
  let olderMs = 120_000;
  let limit = 50;
  let intervalMs = 4_000;
  let apply = false;

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
    if (arg === "--apply") {
      apply = true;
      continue;
    }
  }

  return {
    command,
    processType,
    processId,
    traceId,
    olderMs,
    limit,
    intervalMs,
    apply,
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
  const localConvexBin = path.join(process.cwd(), "node_modules", ".bin", "convex");
  const hasLocalConvexBin = existsSync(localConvexBin);

  const command = hasLocalConvexBin ? localConvexBin : "npx";
  const args = hasLocalConvexBin
    ? ["run", functionName, JSON.stringify(payload)]
    : ["-y", "convex@latest", "run", functionName, JSON.stringify(payload)];

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error([
      `Convex call failed: ${functionName}`,
      `stdout: ${result.stdout?.trim() ?? ""}`,
      `stderr: ${result.stderr?.trim() ?? ""}`,
    ].join("\n"));
  }

  return parseJsonFromStdout(result.stdout ?? "");
}

function requireProcess(args: Args) {
  if (!args.processType || !args.processId) {
    throw new Error("Expected one of --run <id> or --window <id>");
  }
}

function printHealth(data: any) {
  const stage = data.stage_progress.find((row: any) => row.stage === data.current_stage);
  console.log(`\\n[${new Date().toISOString()}] ${data.process_type}:${data.process_id}`);
  console.log(`status=${data.status} stage=${data.current_stage}`);
  if (stage) {
    console.log(
      `stage_progress total=${stage.target_total} completed=${stage.completed} pending=${stage.pending} failed=${stage.failed}`,
    );
  }
  console.log(
    `transport batches(q/r)=${data.active_transport.queued_batches}/${data.active_transport.running_batches} jobs(q/r)=${data.active_transport.queued_jobs}/${data.active_transport.running_jobs} orphans=${data.active_transport.orphaned_requests}`,
  );
  console.log(
    `stalled no_progress_ms=${data.stalled_signals.no_progress_for_ms ?? "null"} oldest_pending_ms=${data.stalled_signals.oldest_pending_request_age_ms ?? "null"} scheduler_scheduled=${data.stalled_signals.scheduler_scheduled}`,
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

  throw new Error(`Unsupported command: ${args.command}`);
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
