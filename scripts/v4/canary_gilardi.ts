import path from "node:path";
import { V4_BUILDS_ROOT, readJson } from "./common";

async function main() {
  const bundlePath = path.join(V4_BUILDS_ROOT, "gilardi", "canary_bundle.json");
  const live = process.argv.includes("--live");
  const startRun = process.argv.includes("--start-run");

  if (!live) {
    const bundle = await readJson<any>(bundlePath);
    console.log(JSON.stringify({
      target: "gilardi",
      mode: "dry_run",
      bundlePath,
      experiment_tags: bundle.experiment_blueprints.map((entry: any) => entry.experiment_tag),
      evidence_count: bundle.evidence_items.length,
      next_step: "Run with --live to issue Convex API calls.",
    }, null, 2));
    return;
  }

  const { applyBundle } = await import("./apply_bundle");
  const result = await applyBundle({
    bundlePath,
    startRun,
    targetCount: 1,
  });
  console.log(JSON.stringify({
    target: "gilardi",
    mode: "live",
    ...result,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
