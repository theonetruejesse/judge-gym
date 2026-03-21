import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  let useManifestTags = true;
  const experimentTags: string[] = [];

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
    if (arg === "--all-experiments") {
      useManifestTags = false;
      continue;
    }
    if (arg === "--experiment-tag" && next) {
      experimentTags.push(next);
      useManifestTags = false;
      i += 1;
      continue;
    }
  }

  if (!windowRunId) {
    throw new Error("Missing required argument: --window-run-id");
  }

  return { windowRunId, poolTag, forceReconfigure, useManifestTags, experimentTags };
}

function loadManifestExperimentTags() {
  const manifestPath = resolve(
    process.cwd(),
    "_campaigns/v3_finish_pass/manifest.json",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    required_experiment_tags?: string[];
  };
  return manifest.required_experiment_tags ?? [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new ConvexHttpClient(requireEnv("CONVEX_URL"));
  const selectedExperimentTags = args.useManifestTags
    ? loadManifestExperimentTags()
    : args.experimentTags;

  const contract = await client.query(api.packages.codex.getV3MatrixContract, {});
  console.log("[v3:init] contract", JSON.stringify({
    version: contract.version,
    experiment_count: contract.experiment_count,
    selected_experiment_count: selectedExperimentTags.length,
  }, null, 2));

  const pool = await client.mutation(api.packages.lab.createPoolFromWindowRun, {
    window_run_id: args.windowRunId as never,
    pool_tag: args.poolTag,
  });
  console.log("[v3:init] pool", JSON.stringify(pool, null, 2));

  const initialized = await client.mutation(api.packages.codex.initV3MatrixFromPool, {
    pool_id: pool.pool_id,
    force_reconfigure: args.forceReconfigure,
    experiment_tags: selectedExperimentTags.length > 0 ? selectedExperimentTags as never : undefined,
  });
  console.log("[v3:init] initialized", JSON.stringify({
    pool_id: initialized.pool_id,
    experiment_count: initialized.experiment_count,
    missing_experiment_tags: initialized.missing_experiment_tags,
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
