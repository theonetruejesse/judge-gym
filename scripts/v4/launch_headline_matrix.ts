import path from "node:path";
import { V4_BUILDS_ROOT, readJson } from "./common";
import { applyBundle } from "./apply_bundle";
import type { HeadlineCohort } from "./headline_matrix";
import { resolveCohortExperimentTags } from "./headline_matrix";

type ImportBundle = {
  experiment_blueprints: Array<{
    experiment_tag: string;
  }>;
  evidence_items: any[];
};

function parseCohort(): HeadlineCohort {
  const value = process.argv.find((arg) => arg.startsWith("--cohort="))?.split("=")[1];
  switch (value) {
    case "baseline":
    case "abstention":
    case "gilardi_l2":
    case "full":
      return value;
    case undefined:
      return "baseline";
    default:
      throw new Error(`Unsupported cohort: ${value}`);
  }
}

async function main() {
  const cohort = parseCohort();
  const live = process.argv.includes("--live");
  const startRun = process.argv.includes("--start-run");
  const forceReconfigure = process.argv.includes("--force-reconfigure");
  const targetCountValue = process.argv.find((arg) => arg.startsWith("--target-count="))?.split("=")[1];
  const targetCount = targetCountValue ? Number.parseInt(targetCountValue, 10) : 1;

  const gilardiBundlePath = path.join(V4_BUILDS_ROOT, "gilardi", "headline_bundle.json");
  const zhengBundlePath = path.join(V4_BUILDS_ROOT, "zheng", "headline_bundle.json");
  const selectedTags = resolveCohortExperimentTags(cohort);

  const targets = [
    {
      target: "gilardi",
      bundlePath: gilardiBundlePath,
      tags: selectedTags.filter((tag) => tag.startsWith("gilardi_")),
    },
    {
      target: "zheng_mt_bench",
      bundlePath: zhengBundlePath,
      tags: selectedTags.filter((tag) => tag.startsWith("zheng_")),
    },
  ].filter((entry) => entry.tags.length > 0);

  if (!live) {
    const summaries = await Promise.all(targets.map(async (entry) => {
      const bundle = await readJson<ImportBundle>(entry.bundlePath);
      return {
        target: entry.target,
        bundlePath: entry.bundlePath,
        evidence_count: bundle.evidence_items.length,
        selected_experiment_tags: entry.tags,
      };
    }));
    console.log(JSON.stringify({
      cohort,
      mode: "dry_run",
      targets: summaries,
      next_step: "Run with --live to issue Convex API calls.",
    }, null, 2));
    return;
  }

  const results = [];
  for (const entry of targets) {
    results.push({
      target: entry.target,
      ...(await applyBundle({
        bundlePath: entry.bundlePath,
        startRun,
        targetCount,
        experimentTags: entry.tags,
        forceReconfigure,
      })),
    });
  }

  console.log(JSON.stringify({
    cohort,
    mode: "live",
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
