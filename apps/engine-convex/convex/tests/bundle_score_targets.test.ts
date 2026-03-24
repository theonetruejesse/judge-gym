import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";

type ConvexTestInstance = ReturnType<typeof convexTest>;

function initTest(): ConvexTestInstance {
  return convexTest(schema, buildModules());
}

async function createEvidenceSet(
  t: ConvexTestInstance,
  args: {
    universe_tag: string;
    evidence_set_tag: string;
    itemCount: number;
  },
) {
  const { universe_id } = await t.mutation(
    internal.domain.evidence.evidence_repo.createUniverse,
    {
      universe_tag: args.universe_tag,
      kind: "paper_audit",
      title: args.universe_tag,
    },
  );

  const importedItems = [] as Array<{
    evidence_item_id: string;
    evidence_view_id: string;
  }>;

  for (let index = 0; index < args.itemCount; index += 1) {
    const imported = await t.action(
      internal.domain.evidence.evidence_service.importEvidenceItem,
      {
        universe_id,
        canonical_key: `${args.universe_tag}:item:${index + 1}`,
        title: `${args.evidence_set_tag} item ${index + 1}`,
        source_url: `https://example.com/${args.evidence_set_tag}/${index + 1}`,
        raw_text: `${args.evidence_set_tag} evidence text ${index + 1}.`,
        view_kind: "paper_original",
        pipeline_kind: "import",
        pipeline_version: "bundle-tests-v4",
      },
    );
    importedItems.push({
      evidence_item_id: imported.evidence_item_id,
      evidence_view_id: imported.evidence_view_id,
    });
  }

  const { evidence_set_id } = await t.mutation(
    internal.domain.evidence.evidence_repo.createEvidenceSet,
    {
      universe_id,
      evidence_set_tag: args.evidence_set_tag,
      title: args.evidence_set_tag,
      source_kind: "manual_import",
      quality_label: "high",
    },
  );

  await t.mutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, {
    evidence_set_id,
    items: importedItems.map((item, index) => ({
      evidence_item_id: item.evidence_item_id as never,
      pinned_view_id: item.evidence_view_id as never,
      ordinal: index,
      quality_label: "high" as const,
    })),
  });

  return {
    universe_id,
    evidence_set_id,
  };
}

async function createExperiment(
  t: ConvexTestInstance,
  args: {
    evidence_set_id: string;
    evidence_bundle_size: number;
  },
) {
  return t.mutation(api.packages.lab.initExperiment, {
    evidence_set_id: args.evidence_set_id as never,
    experiment_config: {
      rubric_config: {
        model: "gpt-4.1",
        scale_size: 4,
        concept: "fascism",
      },
      scoring_config: {
        model: "gpt-4.1",
        method: "subset",
        abstain_enabled: true,
        evidence_view: "l0_raw",
        randomizations: [],
        evidence_bundle_size: args.evidence_bundle_size,
      },
    },
  });
}

describe("bundle score targets", () => {
  const originalDataset = process.env.AXIOM_DATASET;
  const originalToken = process.env.AXIOM_TOKEN;
  const originalSkipExport = process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT;

  beforeEach(() => {
    process.env.AXIOM_DATASET = "judge-gym-test";
    process.env.AXIOM_TOKEN = "test-token";
    process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT = "1";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
  });

  afterEach(() => {
    if (originalDataset === undefined) {
      delete process.env.AXIOM_DATASET;
    } else {
      process.env.AXIOM_DATASET = originalDataset;
    }
    if (originalToken === undefined) {
      delete process.env.AXIOM_TOKEN;
    } else {
      process.env.AXIOM_TOKEN = originalToken;
    }
    if (originalSkipExport === undefined) {
      delete process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT;
    } else {
      process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT = originalSkipExport;
    }
    vi.unstubAllGlobals();
  });

  test("single-item runs create one score target per evidence-set item per sample", async () => {
    const t = initTest();
    const seeded = await createEvidenceSet(t, {
      universe_tag: "single-evidence-universe",
      evidence_set_tag: "single-evidence-set",
      itemCount: 3,
    });
    const { experiment_id } = await createExperiment(t, {
      evidence_set_id: seeded.evidence_set_id,
      evidence_bundle_size: 1,
    });

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 2,
    });

    const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });

    expect(scoreTargets).toHaveLength(6);
    for (const target of scoreTargets) {
      expect(target.items).toHaveLength(1);
      expect(target.items[0]?.position).toBe(0);
    }
  });

  test("bundle runs partition one evidence set into multiple score targets per sample", async () => {
    const t = initTest();
    const seeded = await createEvidenceSet(t, {
      universe_tag: "bundle-universe",
      evidence_set_tag: "bundle-set",
      itemCount: 8,
    });
    const { experiment_id } = await createExperiment(t, {
      evidence_set_id: seeded.evidence_set_id,
      evidence_bundle_size: 3,
    });

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 2,
    });

    const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });
    expect(scoreTargets).toHaveLength(6);

    const groupedBySample = new Map<string, (typeof scoreTargets)>();
    for (const target of scoreTargets) {
      const sampleTargets = groupedBySample.get(String(target.sample_id)) ?? [];
      sampleTargets.push(target);
      groupedBySample.set(String(target.sample_id), sampleTargets);
    }

    expect(groupedBySample.size).toBe(2);
    for (const targets of groupedBySample.values()) {
      expect(targets).toHaveLength(3);
      expect(targets[0]?.items).toHaveLength(3);
      expect(targets[1]?.items).toHaveLength(3);
      expect(targets[2]?.items).toHaveLength(2);
      expect(
        new Set(
          targets.flatMap((target: (typeof scoreTargets)[number]) =>
            target.items.map((item: (typeof scoreTargets)[number]["items"][number]) =>
              String(item.evidence_item_id)
            )),
        ).size,
      ).toBe(8);
    }
  });

  test("bundle size greater than evidence-set size creates a single all-evidence score target", async () => {
    const t = initTest();
    const seeded = await createEvidenceSet(t, {
      universe_tag: "all-evidence-universe",
      evidence_set_tag: "all-evidence-set",
      itemCount: 4,
    });
    const { experiment_id } = await createExperiment(t, {
      evidence_set_id: seeded.evidence_set_id,
      evidence_bundle_size: 99,
    });

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 1,
    });

    const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });
    expect(scoreTargets).toHaveLength(1);
    expect(scoreTargets[0]?.items).toHaveLength(4);
  });

  test("evidence sets persist item counts for curated V4 selections", async () => {
    const t = initTest();
    const seeded = await createEvidenceSet(t, {
      universe_tag: "counts-universe",
      evidence_set_tag: "counts-set",
      itemCount: 5,
    });

    const evidenceSet = await t.query(api.packages.evidence.getEvidenceSetSummary, {
      evidence_set_id: seeded.evidence_set_id as never,
    });

    expect(evidenceSet.item_count).toBe(5);
  });
});
