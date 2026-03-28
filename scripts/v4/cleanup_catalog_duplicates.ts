import { ConvexHttpClient } from "convex/browser";
import { api } from "../../apps/engine-convex/convex/_generated/api";

type Args = {
  universeTag: string;
  evidenceSetTag: string;
  dryRun: boolean;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    universeTag: "gilardi_relevance_v1",
    evidenceSetTag: "gilardi_relevance_v1_canary_set",
    dryRun: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--universe-tag" && next) {
      args.universeTag = next;
      index += 1;
      continue;
    }
    if (arg === "--evidence-set-tag" && next) {
      args.evidenceSetTag = next;
      index += 1;
      continue;
    }
    if (arg === "--live") {
      args.dryRun = false;
      continue;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new ConvexHttpClient(requireEnv("CONVEX_URL"));

  const result = await client.action(api.packages.codex.cleanupDuplicateEvidenceCatalogRows, {
    universe_tag: args.universeTag,
    evidence_set_tag: args.evidenceSetTag,
    dry_run: args.dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
