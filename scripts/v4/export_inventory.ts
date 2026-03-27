import { readdir } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../apps/engine-convex/convex/_generated/api";
import {
  LOCAL_ROOT,
  V4_BUILDS_ROOT,
  V4_SOURCES_ROOT,
  ensureDir,
  readJson,
  writeJson,
  writeText,
} from "./common";

type LocalJsonFile = {
  path: string;
  file_name: string;
  size_bytes: number;
  json_kind: string | null;
  tag: string | null;
};

type InventoryData = {
  generated_at: string;
  local_sources: {
    root: string;
    files: string[];
  };
  local_builds: {
    root: string;
    files: LocalJsonFile[];
  };
  live: {
    universes: any[];
    evidence_sets: any[];
    packages: any[];
    experiments: any[];
  };
  summaries: {
    targets: Array<{
      target_key: string;
      experiment_count: number;
      provider_models: string[];
      condition_keys: string[];
      evidence_set_tags: string[];
      package_tags: string[];
      latest_run_statuses: string[];
    }>;
    providers: Array<{
      model: string;
      experiment_count: number;
      targets: string[];
      conditions: string[];
    }>;
    experiment_totals: {
      total_experiments: number;
      completed_experiments: number;
      experiments_with_multiple_runs: number;
    };
  };
  anomalies: {
    duplicate_universe_tags: Array<{ tag: string; universe_ids: string[] }>;
    duplicate_evidence_set_tags: Array<{
      tag: string;
      evidence_set_ids: string[];
      shared_canonical_keys: string[];
    }>;
    duplicate_package_tags: Array<{ tag: string; package_ids: string[] }>;
    experiments_with_multiple_runs: Array<{
      experiment_tag: string;
      total_count: number;
      latest_run_id: string | null;
    }>;
    universe_item_count_mismatches: Array<{
      universe_tag: string;
      universe_id: string;
      universe_item_count: number;
      evidence_set_tag: string;
      evidence_set_id: string;
      evidence_set_item_count: number;
    }>;
  };
  conceptual_readiness: {
    runnable_now: string[];
    blocked_or_missing: string[];
    immediate_queue: string[];
  };
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [] as string[];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function listJsonArtifacts(root: string) {
  const files = await listFilesRecursive(root);
  const jsonFiles = files.filter((filePath) => filePath.endsWith(".json"));
  const results = [] as LocalJsonFile[];
  for (const filePath of jsonFiles) {
    const json = await readJson<Record<string, unknown>>(filePath);
    const stat = await Bun.file(filePath).stat();
    results.push({
      path: path.relative(process.cwd(), filePath),
      file_name: path.basename(filePath),
      size_bytes: stat.size,
      json_kind: typeof json.build_kind === "string" ? json.build_kind : null,
      tag: typeof json.package_tag === "string"
        ? json.package_tag
        : typeof json.universe?.universe_tag === "string"
          ? String(json.universe.universe_tag)
          : null,
    });
  }
  return results;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function deriveConditionKey(experiment: any) {
  const target = experiment.paper_audit_target_key ?? experiment.study_kind ?? "unknown";
  const view = experiment.scoring_config?.evidence_view ?? "unknown";
  const abstain = experiment.scoring_config?.abstain_enabled ? "abstention_on" : "baseline";
  return `${target}:${abstain}:${view}`;
}

async function buildInventory() {
  const client = new ConvexHttpClient(requireEnv("CONVEX_URL"));
  const [
    experiments,
    universes,
    evidenceSets,
    packages,
  ] = await Promise.all([
    client.query(api.packages.lab.listExperiments, {}),
    client.query(api.packages.evidence.listEvidenceUniverses, {}),
    client.query(api.packages.evidence.listEvidenceSets, {}),
    client.query(api.packages.paper_audits.listPaperAuditPackages, {}),
  ]);

  const duplicateSetTags = new Map<string, typeof evidenceSets>();
  for (const evidenceSet of evidenceSets) {
    const matches = evidenceSets.filter((candidate: any) =>
      candidate.evidence_set_tag === evidenceSet.evidence_set_tag
    );
    if (matches.length > 1) {
      duplicateSetTags.set(evidenceSet.evidence_set_tag, matches);
    }
  }

  const duplicateSetDetails = [] as InventoryData["anomalies"]["duplicate_evidence_set_tags"];
  for (const [tag, matchingSets] of duplicateSetTags.entries()) {
    const setItems = await Promise.all(
      matchingSets.map((setRow: any) =>
        client.query(api.packages.evidence.listEvidenceSetItems, {
          evidence_set_id: setRow.evidence_set_id,
        })
      ),
    );
    const canonicalKeysBySet = setItems.map((items: any[]) => new Set(items.map((item) => item.canonical_key)));
    const sharedCanonicalKeys = canonicalKeysBySet.length > 1
      ? [...canonicalKeysBySet[0] ?? []].filter((key) =>
        canonicalKeysBySet.slice(1).every((keys) => keys.has(key))
      )
      : [];
    duplicateSetDetails.push({
      tag,
      evidence_set_ids: matchingSets.map((setRow: any) => setRow.evidence_set_id),
      shared_canonical_keys: sharedCanonicalKeys.sort(),
    });
  }

  const universeById = new Map(universes.map((universe: any) => [universe.universe_id, universe] as const));
  const targetGroups = new Map<string, any[]>();
  for (const experiment of experiments) {
    const targetKey = experiment.paper_audit_target_key ?? experiment.study_kind ?? "unknown";
    const group = targetGroups.get(targetKey) ?? [];
    group.push(experiment);
    targetGroups.set(targetKey, group);
  }

  const providerGroups = new Map<string, any[]>();
  for (const experiment of experiments) {
    const model = experiment.scoring_config?.model ?? "unknown";
    const group = providerGroups.get(model) ?? [];
    group.push(experiment);
    providerGroups.set(model, group);
  }

  const duplicateUniverseTags = uniqueSorted(universes.map((universe: any) => universe.universe_tag))
    .map((tag) => ({
      tag,
      rows: universes.filter((universe: any) => universe.universe_tag === tag),
    }))
    .filter((entry) => entry.rows.length > 1)
    .map((entry) => ({
      tag: entry.tag,
      universe_ids: entry.rows.map((row: any) => row.universe_id),
    }));

  const duplicatePackageTags = uniqueSorted(packages.map((pkg: any) => pkg.package_tag))
    .map((tag) => ({
      tag,
      rows: packages.filter((pkg: any) => pkg.package_tag === tag),
    }))
    .filter((entry) => entry.rows.length > 1)
    .map((entry) => ({
      tag: entry.tag,
      package_ids: entry.rows.map((row: any) => row.package_id),
    }));

  const universeItemCountMismatches = evidenceSets
    .map((evidenceSet: any) => {
      const universe = universeById.get(evidenceSet.universe_id);
      if (!universe) {
        return null;
      }
      if (universe.item_count > 0 || evidenceSet.item_count === 0) {
        return null;
      }
      return {
        universe_tag: universe.universe_tag,
        universe_id: universe.universe_id,
        universe_item_count: universe.item_count,
        evidence_set_tag: evidenceSet.evidence_set_tag,
        evidence_set_id: evidenceSet.evidence_set_id,
        evidence_set_item_count: evidenceSet.item_count,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value != null);

  return {
    generated_at: new Date().toISOString(),
    local_sources: {
      root: path.relative(process.cwd(), V4_SOURCES_ROOT),
      files: (await listFilesRecursive(V4_SOURCES_ROOT)).map((filePath) => path.relative(process.cwd(), filePath)),
    },
    local_builds: {
      root: path.relative(process.cwd(), V4_BUILDS_ROOT),
      files: await listJsonArtifacts(V4_BUILDS_ROOT),
    },
    live: {
      universes,
      evidence_sets: evidenceSets,
      packages,
      experiments,
    },
    summaries: {
      targets: [...targetGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(
        ([target_key, rows]) => ({
          target_key,
          experiment_count: rows.length,
          provider_models: uniqueSorted(rows.map((row) => row.scoring_config?.model)),
          condition_keys: uniqueSorted(rows.map((row) => deriveConditionKey(row))),
          evidence_set_tags: uniqueSorted(rows.map((row) => row.evidence_set_tag)),
          package_tags: uniqueSorted(rows.map((row) => row.paper_audit_package_tag)),
          latest_run_statuses: uniqueSorted(rows.map((row) => row.latest_run?.status ?? null)),
        }),
      ),
      providers: [...providerGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(
        ([model, rows]) => ({
          model,
          experiment_count: rows.length,
          targets: uniqueSorted(rows.map((row) => row.paper_audit_target_key)),
          conditions: uniqueSorted(rows.map((row) => deriveConditionKey(row))),
        }),
      ),
      experiment_totals: {
        total_experiments: experiments.length,
        completed_experiments: experiments.filter((experiment: any) => experiment.status === "completed").length,
        experiments_with_multiple_runs: experiments.filter((experiment: any) => experiment.total_count > 1).length,
      },
    },
    anomalies: {
      duplicate_universe_tags: duplicateUniverseTags,
      duplicate_evidence_set_tags: duplicateSetDetails,
      duplicate_package_tags: duplicatePackageTags,
      experiments_with_multiple_runs: experiments
        .filter((experiment: any) => experiment.total_count > 1)
        .map((experiment: any) => ({
          experiment_tag: experiment.experiment_tag,
          total_count: experiment.total_count,
          latest_run_id: experiment.latest_run?.run_id ?? null,
        })),
      universe_item_count_mismatches: universeItemCountMismatches,
    },
    conceptual_readiness: {
      runnable_now: [
        "Direct native evidence universes via Media Cloud acquisition on Temporal.",
        "Curated evidence sets pinned to source records or semantic views.",
        "Single-item and fixed-order bundled runs using `window_round_robin`.",
        "Randomized bundled runs using `random_bundle`.",
        "Raw/source-text versus `l1_cleaned`/`l2_neutralized`/`l3_abstracted` comparisons after transform coverage is generated.",
        "GPT-4.1-first conceptual runs using the same evidence-set-backed experiment substrate as the paper audits.",
      ],
      blocked_or_missing: [
        "No semantic clustering or projected clustering support for V4 evidence-set-backed runs; `semantic_cluster` and `semantic_cluster_projected` still throw in run materialization.",
        "No native conceptual package/build scripts analogous to the Gilardi/Zheng import builders.",
        "No frozen conceptual evidence universes or curated native evidence sets have been created yet.",
        "No concept-family manifest exists yet for `fascism` / `illiberal_democracy` / successor concepts.",
      ],
      immediate_queue: [
        "Freeze a native conceptual-study manifest separate from the paper-audit matrix.",
        "Create one native evidence universe plus one curated evidence set using the Media Cloud path.",
        "Define GPT-4.1-only conceptual baseline, abstention, and raw-vs-l2 cells before reopening broader provider families.",
        "Keep bundle-sensitive conceptual work limited to `window_round_robin` or `random_bundle` until clustering support is implemented.",
      ],
    },
  } satisfies InventoryData;
}

function renderMarkdown(data: InventoryData) {
  const lines = [] as string[];
  lines.push("# V4 Inventory");
  lines.push("");
  lines.push(`Generated: ${data.generated_at}`);
  lines.push("");
  lines.push("## Live Paper-Audit Surface");
  lines.push("");
  lines.push(`- Universes: ${data.live.universes.length}`);
  lines.push(`- Evidence sets: ${data.live.evidence_sets.length}`);
  lines.push(`- Paper-audit packages: ${data.live.packages.length}`);
  lines.push(`- Experiments: ${data.summaries.experiment_totals.total_experiments}`);
  lines.push(`- Completed experiments: ${data.summaries.experiment_totals.completed_experiments}`);
  lines.push(`- Experiments with multiple completed runs: ${data.summaries.experiment_totals.experiments_with_multiple_runs}`);
  lines.push("");
  lines.push("### Targets");
  lines.push("");
  for (const target of data.summaries.targets) {
    lines.push(`- \`${target.target_key}\`: ${target.experiment_count} experiments; providers ${target.provider_models.join(", ")}; sets ${target.evidence_set_tags.join(", ")}`);
  }
  lines.push("");
  lines.push("### Providers");
  lines.push("");
  for (const provider of data.summaries.providers) {
    lines.push(`- \`${provider.model}\`: ${provider.experiment_count} experiments across ${provider.targets.join(", ")}`);
  }
  lines.push("");
  lines.push("## Local Source Artifacts");
  lines.push("");
  lines.push(`- Source files: ${data.local_sources.files.length}`);
  lines.push(`- Build JSON artifacts: ${data.local_builds.files.length}`);
  lines.push("");
  lines.push("## Conceptual-Study Readiness");
  lines.push("");
  lines.push("### Runnable Now");
  lines.push("");
  for (const item of data.conceptual_readiness.runnable_now) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("### Blocked Or Missing");
  lines.push("");
  for (const item of data.conceptual_readiness.blocked_or_missing) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("### Immediate Queue");
  lines.push("");
  for (const item of data.conceptual_readiness.immediate_queue) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## Known Catalog Anomalies");
  lines.push("");
  if (
    data.anomalies.duplicate_universe_tags.length === 0
    && data.anomalies.duplicate_evidence_set_tags.length === 0
    && data.anomalies.experiments_with_multiple_runs.length === 0
    && data.anomalies.universe_item_count_mismatches.length === 0
  ) {
    lines.push("- None");
  } else {
    for (const duplicate of data.anomalies.duplicate_universe_tags) {
      lines.push(`- duplicate universe tag \`${duplicate.tag}\`: ${duplicate.universe_ids.join(", ")}`);
    }
    for (const duplicate of data.anomalies.duplicate_evidence_set_tags) {
      lines.push(
        `- duplicate evidence-set tag \`${duplicate.tag}\`: ${duplicate.evidence_set_ids.join(", ")}`
        + (duplicate.shared_canonical_keys.length > 0
          ? `; shared canonical keys ${duplicate.shared_canonical_keys.slice(0, 6).join(", ")}`
          : ""),
      );
    }
    for (const experiment of data.anomalies.experiments_with_multiple_runs) {
      lines.push(`- multiple runs on \`${experiment.experiment_tag}\`: ${experiment.total_count}`);
    }
    for (const mismatch of data.anomalies.universe_item_count_mismatches) {
      lines.push(
        `- universe/set mismatch: universe \`${mismatch.universe_tag}\` (${mismatch.universe_id}) `
        + `reports ${mismatch.universe_item_count} items but set \`${mismatch.evidence_set_tag}\` `
        + `(${mismatch.evidence_set_id}) reports ${mismatch.evidence_set_item_count}`,
      );
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const inventory = await buildInventory();
  const outputRoot = path.join(LOCAL_ROOT, "v4_inventory");
  await ensureDir(outputRoot);
  const jsonPath = path.join(outputRoot, "live_inventory.json");
  const markdownPath = path.join(outputRoot, "live_inventory.md");
  await writeJson(jsonPath, inventory);
  await writeText(markdownPath, renderMarkdown(inventory));

  console.log(JSON.stringify({
    json_path: path.relative(process.cwd(), jsonPath),
    markdown_path: path.relative(process.cwd(), markdownPath),
    total_experiments: inventory.summaries.experiment_totals.total_experiments,
    duplicate_universe_tags: inventory.anomalies.duplicate_universe_tags.length,
    duplicate_evidence_set_tags: inventory.anomalies.duplicate_evidence_set_tags.length,
    experiments_with_multiple_runs: inventory.anomalies.experiments_with_multiple_runs.length,
  }, null, 2));
}

await main();
