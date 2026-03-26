import { ConvexHttpClient } from "convex/browser";
import { api } from "../apps/engine-convex/convex/_generated/api";

type Args = {
  query: string;
  start: string;
  end: string;
  collectionIds: number[];
  pageSize: number;
  maxPages: number;
  pollMs: number;
  timeoutMs: number;
  snapshotSet: boolean;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseCsvIntegers(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((part) => Number.isInteger(part) && part > 0);
}

function isoDateOffset(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    query: "democracy",
    start: isoDateOffset(30),
    end: isoDateOffset(0),
    collectionIds: [34412234],
    pageSize: 2,
    maxPages: 1,
    pollMs: 5_000,
    timeoutMs: 5 * 60_000,
    snapshotSet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--query" && next) {
      args.query = next;
      index += 1;
      continue;
    }
    if (arg === "--start" && next) {
      args.start = next;
      index += 1;
      continue;
    }
    if (arg === "--end" && next) {
      args.end = next;
      index += 1;
      continue;
    }
    if (arg === "--collections" && next) {
      args.collectionIds = parseCsvIntegers(next);
      index += 1;
      continue;
    }
    if (arg === "--page-size" && next) {
      args.pageSize = Math.max(1, Number(next) || args.pageSize);
      index += 1;
      continue;
    }
    if (arg === "--max-pages" && next) {
      args.maxPages = Math.max(1, Number(next) || args.maxPages);
      index += 1;
      continue;
    }
    if (arg === "--poll-ms" && next) {
      args.pollMs = Math.max(250, Number(next) || args.pollMs);
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms" && next) {
      args.timeoutMs = Math.max(1000, Number(next) || args.timeoutMs);
      index += 1;
      continue;
    }
    if (arg === "--snapshot-set") {
      args.snapshotSet = true;
      continue;
    }
  }

  return args;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    console.log(
      `[acquisition-smoke] status=${summary.status} discovered=${summary.discovered_count} hydrated=${summary.hydrated_count} errors=${summary.error_count}`,
    );

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new ConvexHttpClient(requireEnv("CONVEX_URL"));
  const tag = `infra_acq_smoke_${Date.now()}`;

  console.log("[acquisition-smoke] creating universe/spec/run");
  const universe = await client.mutation(api.packages.evidence.createEvidenceUniverse, {
    universe_tag: `${tag}_universe`,
    kind: "news",
    title: `${tag} universe`,
    description: `Infra acquisition smoke for query ${args.query}`,
  });

  const spec = await client.mutation(api.packages.evidence.createAcquisitionSpec, {
    universe_id: universe.universe_id,
    spec_tag: `${tag}_spec`,
    discovery_provider: "mediacloud",
    discovery_config_json: JSON.stringify({
      query: args.query,
      start_date: args.start,
      end_date: args.end,
      collection_ids: args.collectionIds,
      page_size: args.pageSize,
      max_pages: args.maxPages,
    }),
    hydrator_kind: "url_fetch",
    hydrator_config_json: JSON.stringify({
      fetch_strategy: "direct_url_v1",
    }),
    active: true,
  });

  const run = await client.mutation(api.packages.evidence.createAcquisitionRun, {
    acquisition_spec_id: spec.acquisition_spec_id,
  });

  const started = await client.action(api.packages.evidence.startAcquisitionRun, {
    acquisition_run_id: run.acquisition_run_id,
  });

  console.log(`[acquisition-smoke] started workflow ${started.workflow_id}`);
  const summary = await waitForAcquisitionCompletion({
    client,
    acquisitionRunId: String(run.acquisition_run_id),
    pollMs: args.pollMs,
    timeoutMs: args.timeoutMs,
  });

  let evidenceSet: { evidence_set_id: string; item_count: number } | null = null;
  if (args.snapshotSet && summary.hydrated_count > 0) {
    evidenceSet = await client.mutation(api.packages.evidence.createEvidenceSetFromAcquisitionRun, {
      acquisition_run_id: run.acquisition_run_id,
      evidence_set_tag: `${tag}_set`,
      title: `${tag} set`,
      quality_label: "high",
    });
  }

  console.log(
    JSON.stringify(
      {
        universe_id: String(universe.universe_id),
        acquisition_spec_id: String(spec.acquisition_spec_id),
        acquisition_run_id: String(run.acquisition_run_id),
        workflow_id: started.workflow_id,
        workflow_run_id: started.workflow_run_id,
        status: summary.status,
        discovered_count: summary.discovered_count,
        hydrated_count: summary.hydrated_count,
        error_count: summary.error_count,
        evidence_set: evidenceSet,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
