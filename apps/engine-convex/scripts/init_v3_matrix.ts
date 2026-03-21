import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseArgs(argv: string[]) {
  let windowRunId: string | null = null;
  let poolTag: string | undefined;
  let forceReconfigure = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--window-run-id" && next) {
      windowRunId = next;
      i += 1;
      continue;
    }
    if (arg === "--pool-tag" && next) {
      poolTag = next;
      i += 1;
      continue;
    }
    if (arg === "--force-reconfigure") {
      forceReconfigure = true;
      continue;
    }
  }

  if (!windowRunId) {
    throw new Error("Missing required argument: --window-run-id");
  }

  return { windowRunId, poolTag, forceReconfigure };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new ConvexHttpClient(requireEnv("CONVEX_URL"));

  const contract = await client.query(api.packages.codex.getV3MatrixContract, {});
  console.log("[v3:init] contract", JSON.stringify({
    version: contract.version,
    experiment_count: contract.experiment_count,
  }, null, 2));

  const pool = await client.mutation(api.packages.lab.createPoolFromWindowRun, {
    window_run_id: args.windowRunId as never,
    pool_tag: args.poolTag,
  });
  console.log("[v3:init] pool", JSON.stringify(pool, null, 2));

  const initialized = await client.mutation(api.packages.codex.initV3MatrixFromPool, {
    pool_id: pool.pool_id,
    force_reconfigure: args.forceReconfigure,
  });
  console.log("[v3:init] initialized", JSON.stringify({
    pool_id: initialized.pool_id,
    experiment_count: initialized.experiment_count,
    actions: initialized.rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.action] = (acc[row.action] ?? 0) + 1;
      return acc;
    }, {}),
  }, null, 2));
}

main().catch((error) => {
  console.error("[v3:init] failed");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
