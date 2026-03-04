import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";

type TelemetryEvent = {
  _creationTime?: number;
  trace_id: string;
  seq: number;
  entity_type: string;
  entity_id: string;
  event_name: string;
  stage?: string | null;
  status?: string | null;
  custom_key?: string | null;
  attempt?: number | null;
  ts_ms: number;
  payload_json?: string | null;
};

type Args = {
  traceId?: string;
  limit: number;
  eventsFile?: string;
};

function parseArgs(argv: string[]): Args {
  let traceId: string | undefined;
  let limit = 6000;
  let eventsFile: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--trace-id" && argv[i + 1]) {
      traceId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--limit" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (!Number.isNaN(parsed) && Number.isInteger(parsed) && parsed > 0) {
        limit = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--events-file" && argv[i + 1]) {
      eventsFile = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return { traceId, limit, eventsFile };
}

function runConvexData(table: "telemetry_events", limit: number): unknown {
  const localConvexBin = path.join(process.cwd(), "node_modules", ".bin", "convex");
  const hasLocalConvexBin = existsSync(localConvexBin);
  const command = hasLocalConvexBin ? localConvexBin : "npx";
  const args = hasLocalConvexBin
    ? ["data", table, "--limit", String(limit), "--order", "desc", "--format", "json"]
    : [
      "-y",
      "convex@latest",
      "data",
      table,
      "--limit",
      String(limit),
      "--order",
      "desc",
      "--format",
      "json",
    ];

  const result = spawnSync(
    command,
    args,
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    const stdout = result.stdout?.trim() ?? "";
    throw new Error(
      `Failed to fetch ${table}.\nstdout: ${stdout}\nstderr: ${stderr}`,
    );
  }

  return JSON.parse(result.stdout);
}

function loadJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function chooseTraceId(events: TelemetryEvent[], preferred?: string): string {
  if (preferred) {
    return preferred;
  }

  const latestByTrace = new Map<string, number>();
  for (const event of events) {
    if (!event.trace_id || event.trace_id.startsWith("scheduler:")) {
      continue;
    }
    const t = event._creationTime ?? 0;
    const existing = latestByTrace.get(event.trace_id) ?? 0;
    if (t > existing) {
      latestByTrace.set(event.trace_id, t);
    }
  }

  if (latestByTrace.size === 0) {
    throw new Error("No non-scheduler traces found. Provide --trace-id.");
  }

  return [...latestByTrace.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function formatTs(tsMs: number): string {
  return new Date(tsMs).toISOString();
}

function main() {
  const { traceId: argTraceId, limit, eventsFile } = parseArgs(process.argv.slice(2));
  const events = eventsFile
    ? loadJsonFile<TelemetryEvent[]>(eventsFile)
    : runConvexData("telemetry_events", limit) as TelemetryEvent[];

  const traceId = chooseTraceId(events, argTraceId);
  const traceEvents = events
    .filter((event) => event.trace_id === traceId)
    .sort((a, b) => a.seq - b.seq);

  if (traceEvents.length === 0) {
    throw new Error(`No events found for trace_id=${traceId}.`);
  }

  const seqs = traceEvents.map((event) => event.seq);
  const seqSet = new Set(seqs);
  const minSeq = seqs[0];
  const maxSeq = seqs[seqs.length - 1];
  const duplicateSeqCount = seqs.length - new Set(seqs).size;
  const hasSeqCollisions = duplicateSeqCount > 0;


  const eventCountByName = new Map<string, number>();
  const statusCount = new Map<string, number>();
  const stageCount = new Map<string, number>();
  let failureCount = 0;

  for (const event of traceEvents) {
    eventCountByName.set(
      event.event_name,
      (eventCountByName.get(event.event_name) ?? 0) + 1,
    );
    const statusKey = String(event.status ?? "null");
    statusCount.set(statusKey, (statusCount.get(statusKey) ?? 0) + 1);
    const stageKey = String(event.stage ?? "null");
    stageCount.set(stageKey, (stageCount.get(stageKey) ?? 0) + 1);
    const loweredStatus = String(event.status ?? "").toLowerCase();
    const loweredName = event.event_name.toLowerCase();
    if (
      loweredStatus === "failed" ||
      loweredStatus === "error" ||
      loweredName.includes("fail")
    ) {
      failureCount += 1;
    }
  }

  const started = (eventCountByName.get("window_created") ?? 0) > 0
    && (eventCountByName.get("window_flow_started") ?? 0) > 0;
  const schedulerKickoff = (eventCountByName.get("scheduler_kickoff_for_window") ?? 0) > 0;
  const completed = (eventCountByName.get("window_completed") ?? 0) > 0;

  const firstTs = traceEvents[0].ts_ms;
  const lastTs = traceEvents[traceEvents.length - 1].ts_ms;
  const durationSec = Math.max(0, (lastTs - firstTs) / 1000);

  const duplicateApplySuccessCount =
    eventCountByName.get("request_apply_duplicate_success") ?? 0;
  const requestAppliedCount = eventCountByName.get("request_applied") ?? 0;
  const batchSuccessCount = eventCountByName.get("batch_success") ?? 0;
  const batchClaimDeniedCount = eventCountByName.get("batch_poll_claim_denied") ?? 0;
  const batchSubmitClaimDeniedCount = eventCountByName.get("batch_submit_claim_denied") ?? 0;
  const batchSuccessEntities = new Set(
    traceEvents
      .filter((event) => event.event_name === "batch_success")
      .map((event) => event.entity_id),
  ).size;

  const healthOk =
    started
    && schedulerKickoff
    && completed
    && failureCount === 0
    && !hasSeqCollisions;

  console.log(`trace_id: ${traceId}`);
  console.log(`events: ${traceEvents.length} (seq ${minSeq}..${maxSeq})`);
  console.log(
    `time_range: ${formatTs(firstTs)} -> ${formatTs(lastTs)} (${durationSec.toFixed(1)}s)`,
  );
  console.log("sequence_strategy: timestamp_entropy");
  console.log(`duplicate_seq_count: ${duplicateSeqCount}`);
  console.log(`started_events_present: ${started}`);
  console.log(`scheduler_kickoff_present: ${schedulerKickoff}`);
  console.log(`window_completed_present: ${completed}`);
  console.log(`failure_event_count: ${failureCount}`);
  console.log(`duplicate_apply_success_count: ${duplicateApplySuccessCount}`);
  console.log(`request_applied_count: ${requestAppliedCount}`);
  console.log(`batch_success_count: ${batchSuccessCount}`);
  console.log(`batch_success_distinct_entities: ${batchSuccessEntities}`);
  console.log(`batch_poll_claim_denied_count: ${batchClaimDeniedCount}`);
  console.log(`batch_submit_claim_denied_count: ${batchSubmitClaimDeniedCount}`);
  if (requestAppliedCount > 0) {
    const ratio = duplicateApplySuccessCount / requestAppliedCount;
    console.log(`duplicate_apply_to_applied_ratio: ${ratio.toFixed(2)}`);
  }
  console.log(`health_ok: ${healthOk}`);
  console.log("");

  console.log("status_counts:");
  for (const [key, value] of [...statusCount.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${key}: ${value}`);
  }
  console.log("");

  console.log("stage_counts:");
  for (const [key, value] of [...stageCount.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${key}: ${value}`);
  }

  if (!healthOk) {
    process.exitCode = 1;
  }
}

main();
