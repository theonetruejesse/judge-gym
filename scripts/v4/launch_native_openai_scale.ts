import path from "node:path";
import { readdir } from "node:fs/promises";
import {
  NATIVE_CONCEPTS_ROOT,
  NATIVE_OPENAI_PROVIDERS,
  nativeModelTagSuffix,
  type NativeOpenAIProvider,
} from "./native_concepts";
import {
  readJson,
  writeJson,
} from "./common";

const OPENAI_SCALE_ROOT = path.join(NATIVE_CONCEPTS_ROOT, "openai_scale");
const DEFAULT_TARGET_COUNT = 30;

type Args = {
  live: boolean;
  targetCount: number;
  snapshotSetId: string | null;
  allowExistingSet: boolean;
  runTimeoutMs: number;
  pollMs: number;
  providers: NativeOpenAIProvider[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    live: false,
    targetCount: DEFAULT_TARGET_COUNT,
    snapshotSetId: null,
    allowExistingSet: false,
    runTimeoutMs: 2 * 60 * 60_000,
    pollMs: 5_000,
    providers: [...NATIVE_OPENAI_PROVIDERS],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--live") {
      args.live = true;
      continue;
    }
    if (arg === "--allow-existing-set") {
      args.allowExistingSet = true;
      continue;
    }
    if (arg === "--target-count" && next) {
      args.targetCount = Math.max(1, Number(next) || args.targetCount);
      index += 1;
      continue;
    }
    if (arg === "--snapshot-set-id" && next) {
      args.snapshotSetId = next;
      index += 1;
      continue;
    }
    if (arg === "--run-timeout-ms" && next) {
      args.runTimeoutMs = Math.max(1_000, Number(next) || args.runTimeoutMs);
      index += 1;
      continue;
    }
    if (arg === "--poll-ms" && next) {
      args.pollMs = Math.max(250, Number(next) || args.pollMs);
      index += 1;
      continue;
    }
    if (arg === "--providers" && next) {
      const requested = next.split(",").map((value) => value.trim()).filter(Boolean);
      args.providers = NATIVE_OPENAI_PROVIDERS.filter((provider) => requested.includes(provider));
      index += 1;
      continue;
    }
  }

  if (args.providers.length === 0) {
    throw new Error("No valid providers selected.");
  }

  return args;
}

async function resolveSnapshotSetId(explicit: string | null) {
  if (explicit) {
    return explicit;
  }
  const fileNames = await readdir(NATIVE_CONCEPTS_ROOT);
  const launchFiles = fileNames
    .filter((name) => name.startsWith("live_launch_") && name.endsWith(".json"))
    .sort();
  const latest = launchFiles.at(-1);
  if (!latest) {
    throw new Error(
      "Could not infer snapshot set id. Provide --snapshot-set-id or run the base native launcher first.",
    );
  }
  const summary = await readJson<{
    snapshot_set?: { evidence_set_id?: string };
  }>(path.join(NATIVE_CONCEPTS_ROOT, latest));
  const snapshotSetId = summary.snapshot_set?.evidence_set_id ?? null;
  if (!snapshotSetId) {
    throw new Error(`Latest launch summary ${latest} does not contain snapshot_set.evidence_set_id.`);
  }
  return snapshotSetId;
}

async function runChild(cmd: string[]) {
  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `Command failed (${cmd.join(" ")}):\n${stderr || stdout}`,
    );
  }
  return stdout.trim();
}

function isoTimestampTag() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshotSetId = await resolveSnapshotSetId(args.snapshotSetId);

  const launches = args.providers.map((provider) => ({
    provider,
    manifest_path: path.join(OPENAI_SCALE_ROOT, `${nativeModelTagSuffix(provider)}.json`),
  }));
  const plan = {
    live: args.live,
    target_count: args.targetCount,
    snapshot_set_id: snapshotSetId,
    providers: launches,
  };

  if (!args.live) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const outputs = [];
  for (const launch of launches) {
    const stdout = await runChild([
      process.execPath,
      "scripts/v4/launch_native_conceptual_matrix.ts",
      "--manifest",
      launch.manifest_path,
      "--live",
      "--start-run",
      "--snapshot-set-id",
      snapshotSetId,
      "--target-count",
      String(args.targetCount),
      "--run-timeout-ms",
      String(args.runTimeoutMs),
      "--poll-ms",
      String(args.pollMs),
      ...(args.allowExistingSet ? ["--allow-existing-set"] : []),
    ]);
    outputs.push({
      provider: launch.provider,
      manifest_path: launch.manifest_path,
      summary: JSON.parse(stdout),
    });
  }

  const summaryPath = path.join(
    OPENAI_SCALE_ROOT,
    `live_openai_launch_${isoTimestampTag()}.json`,
  );
  const summary = {
    ...plan,
    outputs,
  };
  await writeJson(summaryPath, summary);
  console.log(JSON.stringify({
    ...summary,
    summary_path: summaryPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
