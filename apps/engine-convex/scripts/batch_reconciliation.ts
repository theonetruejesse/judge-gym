import path from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const ENGINE_CONVEX_ROOT = path.resolve(SCRIPT_DIR, "..");

type ParsedArgs = {
  process_kind: "run" | "window";
  process_id: string;
  stage?: string;
};

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let process_kind: ParsedArgs["process_kind"] = "run";
  let process_id = "";
  let stage: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--run" && args[i + 1]) {
      process_kind = "run";
      process_id = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--window" && args[i + 1]) {
      process_kind = "window";
      process_id = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--stage" && args[i + 1]) {
      stage = args[i + 1];
      i += 1;
      continue;
    }
  }

  if (!process_id) {
    throw new Error("Specify either --run <runId> or --window <windowRunId>");
  }

  return { process_kind, process_id, stage };
}

function runConvexQuery(payload: object) {
  const command = process.execPath || "bun";
  const args = ["x", "convex", "run", "packages/codex:listBatchReconciliationStatus", JSON.stringify(payload)];
  const result = spawnSync(command, args, {
    cwd: ENGINE_CONVEX_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Convex call failed:\n${result.stderr}`);
  }
  if (!result.stdout) {
    throw new Error("Empty response from Convex");
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Failed to parse Convex response: ${error}`);
  }
}

function describeBatch(row: any) {
  const statusMeta = row.status.toUpperCase();
  const providerStatus = row.last_known_provider_status ?? statusMeta;
  const errors = row.last_error_message ? ` error=${row.last_error_message}` : "";
  return `${statusMeta.padEnd(9)} stage=${row.stage} items=${row.item_count} provider=${row.provider} model=${row.model} provider_id=${row.provider_batch_id ?? "<unset>"} provider_status=${providerStatus}${errors}`;
}

function main() {
  const args = parseArgs();
  const payload = {
    process_kind: args.process_kind,
    process_id: args.process_id,
    stage: args.stage,
  };
  const response = runConvexQuery(payload);
  const header = `Batch execution status for ${args.process_kind}:${args.process_id}${args.stage ? ` stage=${args.stage}` : ""}`;
  console.log(header);
  console.log("-".repeat(header.length));
  if (!response.batches.length) {
    console.log("No batch executions found.");
    return;
  }
  response.batches.forEach((batch: any, index: number) => {
    console.log(`${index + 1}. ${describeBatch(batch)}`);
  });
}

main();
