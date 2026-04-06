import { ConvexHttpClient } from "convex/browser";
import { api } from "../../apps/engine-convex/convex/_generated/api";
import {
  ensureDir,
  readJson,
  writeJson,
} from "./common";
import {
  NATIVE_CONCEPTS_MANIFEST_PATH,
  NATIVE_CONCEPTS_ROOT,
  type NativeConceptualManifest,
} from "./native_concepts";

type Args = {
  manifestPath: string;
  live: boolean;
  startRun: boolean;
  snapshotSetId: string | null;
  targetCount: number;
  targetSetSize: number | null;
  pageSize: number | null;
  maxPages: number | null;
  pollMs: number;
  queueTimeoutMs: number;
  acquisitionTimeoutMs: number;
  transformTimeoutMs: number;
  runTimeoutMs: number;
  allowExistingSet: boolean;
};

type QueueHealth = Awaited<ReturnType<ConvexHttpClient["action"]>>;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoTimestampTag() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    manifestPath: NATIVE_CONCEPTS_MANIFEST_PATH,
    live: false,
    startRun: false,
    snapshotSetId: null,
    targetCount: 1,
    targetSetSize: null,
    pageSize: null,
    maxPages: null,
    pollMs: 5_000,
    queueTimeoutMs: 60_000,
    acquisitionTimeoutMs: 20 * 60_000,
    transformTimeoutMs: 30 * 60_000,
    runTimeoutMs: 30 * 60_000,
    allowExistingSet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--manifest" && next) {
      args.manifestPath = next;
      index += 1;
      continue;
    }
    if (arg === "--live") {
      args.live = true;
      continue;
    }
    if (arg === "--start-run") {
      args.startRun = true;
      continue;
    }
    if (arg === "--snapshot-set-id" && next) {
      args.snapshotSetId = next;
      index += 1;
      continue;
    }
    if (arg === "--target-count" && next) {
      args.targetCount = Math.max(1, Number(next) || args.targetCount);
      index += 1;
      continue;
    }
    if (arg === "--target-set-size" && next) {
      args.targetSetSize = Math.max(1, Number(next) || 0);
      index += 1;
      continue;
    }
    if (arg === "--page-size" && next) {
      args.pageSize = Math.max(1, Number(next) || 0);
      index += 1;
      continue;
    }
    if (arg === "--max-pages" && next) {
      args.maxPages = Math.max(1, Number(next) || 0);
      index += 1;
      continue;
    }
    if (arg === "--poll-ms" && next) {
      args.pollMs = Math.max(250, Number(next) || args.pollMs);
      index += 1;
      continue;
    }
    if (arg === "--queue-timeout-ms" && next) {
      args.queueTimeoutMs = Math.max(1_000, Number(next) || args.queueTimeoutMs);
      index += 1;
      continue;
    }
    if (arg === "--acquisition-timeout-ms" && next) {
      args.acquisitionTimeoutMs = Math.max(1_000, Number(next) || args.acquisitionTimeoutMs);
      index += 1;
      continue;
    }
    if (arg === "--transform-timeout-ms" && next) {
      args.transformTimeoutMs = Math.max(1_000, Number(next) || args.transformTimeoutMs);
      index += 1;
      continue;
    }
    if (arg === "--run-timeout-ms" && next) {
      args.runTimeoutMs = Math.max(1_000, Number(next) || args.runTimeoutMs);
      index += 1;
      continue;
    }
    if (arg === "--allow-existing-set") {
      args.allowExistingSet = true;
      continue;
    }
  }

  return args;
}

async function waitForQueueReadiness(client: ConvexHttpClient, args: Args) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < args.queueTimeoutMs) {
    const health = await client.action(api.packages.codex.getTemporalTaskQueueHealth, {});
    if (health.all_ready) {
      return health;
    }
    await sleep(args.pollMs);
  }
  throw new Error("Timed out waiting for Temporal task queues to become ready.");
}

async function waitForAcquisitionCompletion(args: {
  client: ConvexHttpClient;
  acquisitionRunId: string;
  pollMs: number;
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < args.timeoutMs) {
    const summary = await args.client.query(api.packages.evidence.getAcquisitionRunSummary, {
      acquisition_run_id: args.acquisitionRunId as never,
    });
    if (summary.status === "completed") {
      return summary;
    }
    if (summary.status === "error" || summary.status === "canceled") {
      throw new Error(
        `Acquisition run failed: ${summary.last_error_message ?? summary.status}`,
      );
    }
    await sleep(args.pollMs);
  }
  throw new Error("Timed out waiting for acquisition run to complete.");
}

async function waitForTransformCompletion(args: {
  client: ConvexHttpClient;
  evidenceTransformRunId: string;
  pollMs: number;
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < args.timeoutMs) {
    const summary = await args.client.query(api.packages.evidence_transform.getEvidenceTransformRun, {
      evidence_transform_run_id: args.evidenceTransformRunId as never,
    });
    if (summary.status === "completed") {
      return summary;
    }
    if (summary.status === "error" || summary.status === "canceled") {
      throw new Error(
        `Transform run failed: ${summary.last_error_message ?? summary.status}`,
      );
    }
    await sleep(args.pollMs);
  }
  throw new Error("Timed out waiting for evidence transform run to complete.");
}

async function waitForRunsCompletion(args: {
  client: ConvexHttpClient;
  runIds: string[];
  pollMs: number;
  timeoutMs: number;
}) {
  const pending = new Set(args.runIds);
  const summaries = new Map<string, unknown>();
  const startedAt = Date.now();
  while (pending.size > 0 && Date.now() - startedAt < args.timeoutMs) {
    for (const runId of Array.from(pending)) {
      const summary = await args.client.query(api.packages.lab.getRunSummary, {
        run_id: runId as never,
      });
      if (summary.status === "completed") {
        summaries.set(runId, summary);
        pending.delete(runId);
        continue;
      }
      if (summary.status === "error" || summary.status === "canceled") {
        throw new Error(`Run ${runId} failed with status ${summary.status}`);
      }
    }
    if (pending.size > 0) {
      await sleep(args.pollMs);
    }
  }
  if (pending.size > 0) {
    throw new Error(`Timed out waiting for runs to complete: ${Array.from(pending).join(", ")}`);
  }
  return Array.from(summaries.entries()).map(([run_id, summary]) => ({ run_id, summary }));
}

type HydratedSnapshotItem = {
  evidence_set_item_id: string;
  evidence_item_id: string;
  title: string | null;
  source_name: string | null;
  source_url: string | null;
  publish_date: string | null;
  language: string | null;
  canonical_key: string;
  source_record_id: string;
  source_text: string;
  char_count: number;
  score: number;
  buckets: string[];
};

function scoreSnapshotItem(item: Omit<HydratedSnapshotItem, "score">) {
  let score = 0;
  if (item.title) score += 10;
  if (item.source_name) score += 8;
  if (item.source_url) score += 6;
  if (item.publish_date) score += 4;
  if (item.language === "en") score += 12;
  if (item.char_count >= 1_800 && item.char_count <= 6_500) {
    score += 20;
  } else if (item.char_count >= 1_200 && item.char_count <= 12_000) {
    score += 10;
  }
  const lowered = item.source_text.toLowerCase();
  if (lowered.includes("fascism")) score += 6;
  if (lowered.includes("illiberal democracy")) score += 6;
  return score;
}

function includesAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function deriveBuckets(args: {
  item: Omit<HydratedSnapshotItem, "score" | "buckets">;
  bucketQuotas: NativeConceptualManifest["curation"]["bucket_quotas"];
}) {
  if (!args.bucketQuotas?.length) {
    return [] as string[];
  }
  const haystack = `${args.item.title ?? ""}\n${args.item.source_text}`.toLowerCase();
  return args.bucketQuotas
    .filter((bucket) => includesAnyTerm(haystack, bucket.terms))
    .map((bucket) => bucket.key);
}

function applyManifestScoreAdjustments(args: {
  item: Omit<HydratedSnapshotItem, "score" | "buckets">;
  baseScore: number;
  boosts: NativeConceptualManifest["curation"]["keyword_score_boosts"];
  penalties: NativeConceptualManifest["curation"]["keyword_score_penalties"];
}) {
  let score = args.baseScore;
  const haystack = `${args.item.title ?? ""}\n${args.item.source_text}`.toLowerCase();

  for (const boost of args.boosts ?? []) {
    if (includesAnyTerm(haystack, boost.terms)) {
      score += boost.score;
    }
  }
  for (const penalty of args.penalties ?? []) {
    if (includesAnyTerm(haystack, penalty.terms)) {
      score -= penalty.score;
    }
  }

  return score;
}

function curateSnapshotItems(args: {
  items: HydratedSnapshotItem[];
  targetCount: number;
  maxItemsPerSource: number;
  bucketQuotas?: NativeConceptualManifest["curation"]["bucket_quotas"];
}) {
  const sorted = args.items
    .slice()
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      const leftDate = left.publish_date ?? "";
      const rightDate = right.publish_date ?? "";
      if (leftDate !== rightDate) {
        return rightDate.localeCompare(leftDate);
      }
      return left.canonical_key.localeCompare(right.canonical_key);
    });

  const selected: HydratedSnapshotItem[] = [];
  const sourceCounts = new Map<string, number>();
  const seenItemIds = new Set<string>();
  const bucketCounts = new Map<string, number>();

  const trySelect = (item: HydratedSnapshotItem) => {
    if (selected.length >= args.targetCount) return false;
    if (seenItemIds.has(item.evidence_item_id)) return false;
    const sourceKey = item.source_name ?? item.source_url ?? "unknown";
    const sourceCount = sourceCounts.get(sourceKey) ?? 0;
    if (sourceCount >= args.maxItemsPerSource) {
      return false;
    }
    selected.push(item);
    seenItemIds.add(item.evidence_item_id);
    sourceCounts.set(sourceKey, sourceCount + 1);
    for (const bucket of item.buckets) {
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
    }
    return true;
  };

  if (args.bucketQuotas?.length) {
    for (const bucket of args.bucketQuotas) {
      const candidates = sorted.filter((item) => item.buckets.includes(bucket.key));
      for (const item of candidates) {
        if ((bucketCounts.get(bucket.key) ?? 0) >= bucket.quota) {
          break;
        }
        trySelect(item);
      }
    }
  }

  for (const item of sorted) {
    if (selected.length >= args.targetCount) break;
    trySelect(item);
  }

  if (selected.length < args.targetCount) {
    for (const item of sorted) {
      if (selected.length >= args.targetCount) break;
      if (seenItemIds.has(item.evidence_item_id)) continue;
      selected.push(item);
      seenItemIds.add(item.evidence_item_id);
    }
  }

  return selected;
}

function resolveTransformStages(
  targetViewKinds: NativeConceptualManifest["transform"]["target_view_kinds"],
) {
  const stages = new Set<string>();
  for (const stage of targetViewKinds) {
    if (stage === "l1_cleaned") {
      stages.add("l1_cleaned");
      continue;
    }
    if (stage === "l2_neutralized") {
      stages.add("l1_cleaned");
      stages.add("l2_neutralized");
      continue;
    }
    if (stage === "l3_abstracted") {
      stages.add("l1_cleaned");
      stages.add("l2_neutralized");
      stages.add("l3_abstracted");
    }
  }
  return Array.from(stages) as Array<"l1_cleaned" | "l2_neutralized" | "l3_abstracted">;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = await readJson<NativeConceptualManifest>(args.manifestPath);
  const targetSetSize = args.targetSetSize ?? manifest.curation.target_item_count;
  const pageSize = args.pageSize ?? manifest.acquisition.page_size;
  const maxPages = args.maxPages ?? manifest.acquisition.max_pages;

  const plan = {
    manifest_path: args.manifestPath,
    live: args.live,
    start_run: args.startRun,
    target_count: args.targetCount,
    target_set_size: targetSetSize,
    provider: manifest.provider,
    concepts: manifest.concepts,
    universe_tag: manifest.universe.universe_tag,
    curated_evidence_set_tag: manifest.curation.curated_evidence_set_tag,
    acquisition_query: manifest.acquisition.query,
    acquisition_window: {
      start_date: manifest.acquisition.start_date,
      end_date: manifest.acquisition.end_date,
    },
    page_size: pageSize,
    max_pages: maxPages,
    experiment_tags: manifest.experiment_blueprints.map((blueprint) => blueprint.experiment_tag),
  };

  if (!args.live) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const client = new ConvexHttpClient(requireEnv("CONVEX_URL"));
  await waitForQueueReadiness(client, args);

  const universe = await client.mutation(api.packages.evidence.upsertEvidenceUniverse, {
    universe_tag: manifest.universe.universe_tag,
    kind: manifest.universe.kind,
    title: manifest.universe.title,
    description: manifest.universe.description,
    default_locale: manifest.universe.default_locale,
  });

  const existingSets = await client.query(api.packages.evidence.listEvidenceSets, {});
  const existingCuratedSet = existingSets.find(
    (setRow) => setRow.evidence_set_tag === manifest.curation.curated_evidence_set_tag,
  ) ?? null;
  if (existingCuratedSet && !args.allowExistingSet) {
    throw new Error(
      `Curated evidence set ${manifest.curation.curated_evidence_set_tag} already exists. `
      + "Re-run with --allow-existing-set only if you intend to reuse it.",
    );
  }

  const acquisitionSuffix = isoTimestampTag();
  let acquisitionSpec: { acquisition_spec_id: string } | null = null;
  let acquisitionRun: { acquisition_run_id: string } | null = null;
  let acquisitionWorkflow: { workflow_id: string; workflow_run_id: string } | null = null;
  let acquisitionSummary: unknown = null;
  let snapshotSet: { evidence_set_id: string; item_count: number };

  if (args.snapshotSetId) {
    const snapshotSummary = await client.query(api.packages.evidence.getEvidenceSetSummary, {
      evidence_set_id: args.snapshotSetId as never,
    });
    snapshotSet = {
      evidence_set_id: String(snapshotSummary.evidence_set_id),
      item_count: snapshotSummary.item_count,
    };
  } else {
    acquisitionSpec = await client.mutation(api.packages.evidence.createAcquisitionSpec, {
      universe_id: universe.universe_id,
      spec_tag: `${manifest.acquisition.spec_tag_prefix}_${acquisitionSuffix}`,
      discovery_provider: manifest.acquisition.discovery_provider,
      discovery_config_json: JSON.stringify({
        query: manifest.acquisition.query,
        start_date: manifest.acquisition.start_date,
        end_date: manifest.acquisition.end_date,
        collection_ids: manifest.acquisition.collection_ids,
        page_size: pageSize,
        max_pages: maxPages,
      }),
      hydrator_kind: manifest.acquisition.hydrator_kind,
      hydrator_config_json: manifest.acquisition.hydrator_config_json,
      active: true,
    });

    acquisitionRun = await client.mutation(api.packages.evidence.createAcquisitionRun, {
      acquisition_spec_id: acquisitionSpec.acquisition_spec_id as never,
    });
    acquisitionWorkflow = await client.action(api.packages.evidence.startAcquisitionRun, {
      acquisition_run_id: acquisitionRun.acquisition_run_id as never,
    });
    acquisitionSummary = await waitForAcquisitionCompletion({
      client,
      acquisitionRunId: String(acquisitionRun.acquisition_run_id),
      pollMs: args.pollMs,
      timeoutMs: args.acquisitionTimeoutMs,
    });

    snapshotSet = await client.mutation(api.packages.evidence.createEvidenceSetFromAcquisitionRun, {
      acquisition_run_id: acquisitionRun.acquisition_run_id as never,
      evidence_set_tag: `${manifest.curation.snapshot_evidence_set_tag_prefix}_${acquisitionSuffix}`,
      title: `${manifest.curation.snapshot_title_prefix} ${acquisitionSuffix}`,
      quality_label: "high",
    });
  }

  const snapshotItems = await client.query(api.packages.evidence.listEvidenceSetItems, {
    evidence_set_id: snapshotSet.evidence_set_id,
  });

  const hydratedCandidates = [] as HydratedSnapshotItem[];
  for (const snapshotItem of snapshotItems) {
    const content = await client.action(api.packages.evidence.getEvidenceItemContent, {
      evidence_item_id: snapshotItem.evidence_item_id,
    });
    const sourceRecord = content.source_records.find(
      (record) => record.record_kind === manifest.curation.required_record_kind && record.content,
    ) ?? null;
    if (!sourceRecord?.content) {
      continue;
    }
    const charCount = sourceRecord.content.trim().length;
    if (
      charCount < manifest.curation.min_char_count
      || charCount > manifest.curation.max_char_count
    ) {
      continue;
    }
    const candidate = {
      evidence_set_item_id: String(snapshotItem.evidence_set_item_id),
      evidence_item_id: String(snapshotItem.evidence_item_id),
      title: snapshotItem.title ?? null,
      source_name: snapshotItem.source_name ?? null,
      source_url: snapshotItem.source_url ?? null,
      publish_date: snapshotItem.publish_date ?? null,
      language: snapshotItem.language ?? null,
      canonical_key: snapshotItem.canonical_key,
      source_record_id: String(sourceRecord.evidence_source_record_id),
      source_text: sourceRecord.content,
      char_count: charCount,
      score: 0,
      buckets: [] as string[],
    } satisfies Omit<HydratedSnapshotItem, "score" | "buckets"> & {
      score: number;
      buckets: string[];
    };
    candidate.buckets = deriveBuckets({
      item: candidate,
      bucketQuotas: manifest.curation.bucket_quotas,
    });
    candidate.score = applyManifestScoreAdjustments({
      item: candidate,
      baseScore: scoreSnapshotItem(candidate),
      boosts: manifest.curation.keyword_score_boosts,
      penalties: manifest.curation.keyword_score_penalties,
    });
    hydratedCandidates.push(candidate);
  }

  const curatedItems = curateSnapshotItems({
    items: hydratedCandidates,
    targetCount: targetSetSize,
    maxItemsPerSource: manifest.curation.max_items_per_source,
    bucketQuotas: manifest.curation.bucket_quotas,
  });
  if (curatedItems.length < targetSetSize) {
    throw new Error(
      `Only ${curatedItems.length} curated items passed filters, expected ${targetSetSize}.`,
    );
  }

  const curatedSet = await client.mutation(api.packages.evidence.upsertEvidenceSet, {
    universe_id: universe.universe_id,
    evidence_set_tag: manifest.curation.curated_evidence_set_tag,
    title: manifest.curation.curated_title,
    source_kind: "universe_slice",
    quality_label: manifest.curation.quality_label,
    selection_config_json: JSON.stringify({
      manifest_tag: manifest.manifest_tag,
      acquisition_run_id: acquisitionRun?.acquisition_run_id ?? null,
      snapshot_evidence_set_id: snapshotSet.evidence_set_id,
      target_item_count: targetSetSize,
      max_items_per_source: manifest.curation.max_items_per_source,
      min_char_count: manifest.curation.min_char_count,
      max_char_count: manifest.curation.max_char_count,
      bucket_quotas: manifest.curation.bucket_quotas ?? null,
    }),
  });

  await client.mutation(api.packages.evidence.addEvidenceSetItems, {
    evidence_set_id: curatedSet.evidence_set_id,
    items: curatedItems.map((item, index) => ({
      evidence_item_id: item.evidence_item_id as never,
      pinned_source_record_id: item.source_record_id as never,
      ordinal: index,
      inclusion_reason: `Media Cloud curated for ${manifest.manifest_tag}`,
      quality_label: "high",
      metadata_json: JSON.stringify({
        score: item.score,
        source_name: item.source_name,
        char_count: item.char_count,
        buckets: item.buckets,
      }),
    })),
  });

  const requiredViewKinds = resolveTransformStages(manifest.transform.target_view_kinds);
  const transformCoverage = await client.query(
    api.packages.evidence_transform.getEvidenceSetTransformCoverage,
    {
      evidence_set_id: curatedSet.evidence_set_id,
    },
  );
  const sourceCoverage = transformCoverage.source_record_coverage.find(
    (entry) => entry.record_kind === manifest.transform.source_record_kind,
  ) ?? null;
  const hasRequiredSourceCoverage = sourceCoverage?.missing_count === 0;
  const hasRequiredViewCoverage = requiredViewKinds.every((viewKind) => {
    const coverage = transformCoverage.view_coverage.find((entry) => entry.view_kind === viewKind) ?? null;
    return coverage?.pending_count === 0 && coverage.error_count === 0;
  });

  let transformRun = null;
  let transformWorkflow = null;
  let transformSummary = null;
  if (!(hasRequiredSourceCoverage && hasRequiredViewCoverage)) {
    transformRun = await client.mutation(api.packages.evidence_transform.createEvidenceTransformRun, {
      evidence_set_id: curatedSet.evidence_set_id,
      source_record_kind: manifest.transform.source_record_kind,
      target_view_kinds: requiredViewKinds,
      model: manifest.transform.model,
      prompt_version: manifest.transform.prompt_version,
    });
    transformWorkflow = await client.action(api.packages.evidence_transform.startEvidenceTransformRun, {
      evidence_transform_run_id: transformRun.evidence_transform_run_id,
    });
    transformSummary = await waitForTransformCompletion({
      client,
      evidenceTransformRunId: String(transformRun.evidence_transform_run_id),
      pollMs: args.pollMs,
      timeoutMs: args.transformTimeoutMs,
    });
  } else {
    transformSummary = {
      evidence_transform_run_id: null,
      status: "skipped",
      item_count: transformCoverage.item_count,
      completed_count: transformCoverage.item_count,
      pending_count: 0,
      error_count: 0,
      source_record_kind: manifest.transform.source_record_kind,
      target_view_kinds: requiredViewKinds,
      model: manifest.transform.model,
      prompt_version: manifest.transform.prompt_version,
      started_at_ms: null,
      finished_at_ms: null,
      last_error_message: null,
    };
  }

  const experiments = [];
  for (const blueprint of manifest.experiment_blueprints) {
    const experiment = await client.mutation(api.packages.lab.upsertExperiment, {
      experiment_tag: blueprint.experiment_tag,
      evidence_set_id: curatedSet.evidence_set_id,
      force_reconfigure: args.allowExistingSet,
      experiment_config: {
        study_kind: blueprint.study_kind,
        compatibility_mode: blueprint.compatibility_mode,
        rubric_source_kind: blueprint.rubric_source_kind,
        task_contract: blueprint.task_contract,
        output_contract: blueprint.output_contract,
        rubric_config: blueprint.rubric_config,
        scoring_config: blueprint.scoring_config,
      },
    });
    if (experiment.action === "conflict" && !args.allowExistingSet) {
      throw new Error(`Experiment tag conflict for ${blueprint.experiment_tag}`);
    }
    experiments.push({
      ...blueprint,
      ...experiment,
    });
  }

  let runs: Array<{ run_id: string; summary: unknown }> = [];
  if (args.startRun) {
    const startedRuns = [];
    for (const experiment of experiments) {
      const startedRun = await client.mutation(api.packages.lab.startExperimentRun, {
        experiment_id: experiment.experiment_id,
        target_count: args.targetCount,
        pause_after: null,
      });
      startedRuns.push(startedRun);
    }
    runs = await waitForRunsCompletion({
      client,
      runIds: startedRuns.map((run) => String(run.run_id)),
      pollMs: args.pollMs,
      timeoutMs: args.runTimeoutMs,
    });
  }

  const curationReportPath = `${NATIVE_CONCEPTS_ROOT}/live_curation_${acquisitionSuffix}.json`;
  const launchSummaryPath = `${NATIVE_CONCEPTS_ROOT}/live_launch_${acquisitionSuffix}.json`;

  await ensureDir(NATIVE_CONCEPTS_ROOT);
  await writeJson(curationReportPath, {
    manifest_tag: manifest.manifest_tag,
    acquisition_run_id: acquisitionRun?.acquisition_run_id ?? null,
    snapshot_evidence_set_id: snapshotSet.evidence_set_id,
    curated_evidence_set_id: curatedSet.evidence_set_id,
    selected_items: curatedItems.map((item) => ({
      canonical_key: item.canonical_key,
      title: item.title,
      source_name: item.source_name,
      publish_date: item.publish_date,
      char_count: item.char_count,
      score: item.score,
      buckets: item.buckets,
    })),
  });

  const summary = {
    plan,
    universe,
    acquisition_spec: acquisitionSpec,
    acquisition_run: acquisitionRun,
    acquisition_workflow: acquisitionWorkflow,
    acquisition_summary: acquisitionSummary,
    snapshot_set: snapshotSet,
    curated_set: curatedSet,
    transform_run: transformRun,
    transform_workflow: transformWorkflow,
    transform_summary: transformSummary,
    experiments,
    runs,
    curation_report_path: curationReportPath,
  };
  await writeJson(launchSummaryPath, summary);
  console.log(JSON.stringify({
    ...summary,
    launch_summary_path: launchSummaryPath,
  }, null, 2));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
