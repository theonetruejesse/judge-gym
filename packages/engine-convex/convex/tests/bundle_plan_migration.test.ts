import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { buildModules } from "./test.setup";
import type { Id } from "../_generated/dataModel";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";

type ConvexTestInstance = ReturnType<typeof convexTest>;

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);
const activeTests: ConvexTestInstance[] = [];
const originalDataset = process.env.AXIOM_DATASET;
const originalToken = process.env.AXIOM_TOKEN;
const originalSkipExport = process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT;

function initTest(): ConvexTestInstance {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  activeTests.push(t);
  return t;
}

async function setupPool(t: ConvexTestInstance) {
  const firstWindow = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: "gpt-4.1-mini",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "bundle plan migration test one",
    },
  );
  const secondWindow = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: "gpt-4.1-mini",
      start_date: "2026-03-03",
      end_date: "2026-03-04",
      query: "bundle plan migration test two",
    },
  );

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id: firstWindow.window_id,
    evidences: [
      {
        title: "Evidence A",
        url: "https://example.com/a",
        raw_content: "Executive overreach and institutional weakening.",
      },
      {
        title: "Evidence B",
        url: "https://example.com/b",
        raw_content: "Opposition parties face new legal constraints.",
      },
    ],
  });
  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id: secondWindow.window_id,
    evidences: [
      {
        title: "Evidence C",
        url: "https://example.com/c",
        raw_content: "Civil society protests continue in major cities.",
      },
      {
        title: "Evidence D",
        url: "https://example.com/d",
        raw_content: "Courts remain partially independent but pressured.",
      },
    ],
  });

  const firstEvidence = await t.query(api.packages.lab.listEvidenceByWindow, {
    window_id: firstWindow.window_id,
  });
  const secondEvidence = await t.query(api.packages.lab.listEvidenceByWindow, {
    window_id: secondWindow.window_id,
  });
  const pool = await t.mutation(api.packages.lab.createPool, {
    pool_tag: "bundle-plan-migration-pool",
    evidence_ids: [...firstEvidence, ...secondEvidence].map((row) => row.evidence_id),
  });

  return {
    pool_id: pool.pool_id,
  };
}

beforeEach(() => {
  process.env.AXIOM_DATASET = "judge-gym-test";
  process.env.AXIOM_TOKEN = "test-token";
  process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT = "1";
  vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
});

afterEach(async () => {
  while (activeTests.length > 0) {
    const t = activeTests.pop();
    if (!t) continue;
    await t.finishAllScheduledFunctions(() => {});
  }
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

describe("bundle plan migration", () => {
  test("materialized bundle plans reuse the same bundle membership for every sample", async () => {
    const t = initTest();
    const { pool_id } = await setupPool(t);
    const bundlePlan = await t.mutation(api.packages.lab.createBundlePlan, {
      pool_id,
      strategy: "random_bundle",
      strategy_version: "v3_1",
      bundle_size: 2,
      seed: 17,
    });
    const experiment = await t.mutation(api.packages.lab.initExperiment, {
      experiment_tag: "bundle-plan-reuse-test",
      pool_id,
      bundle_plan_id: bundlePlan.bundle_plan_id,
      experiment_config: {
        rubric_config: {
          model: "gpt-4.1-mini",
          scale_size: 4,
          concept: "institutional capture",
        },
        scoring_config: {
          model: "gpt-4.1-mini",
          method: "subset",
          abstain_enabled: true,
          evidence_view: "l2_neutralized",
          randomizations: [],
          evidence_bundle_size: 2,
          bundle_strategy: "random_bundle",
          bundle_strategy_version: "v3_1",
          clustering_seed: 17,
        },
      },
    });

    const runId = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id: experiment.experiment_id,
      target_count: 2,
    });
    const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, {
      run_id: runId,
    });

    const signaturesBySample = new Map<string, string[]>();
    for (const target of scoreTargets) {
      const signature = target.items
        .map((item: (typeof target.items)[number]) => String(item.evidence_id))
        .sort()
        .join("|");
      const current = signaturesBySample.get(String(target.sample_id)) ?? [];
      current.push(signature);
      signaturesBySample.set(String(target.sample_id), current);
    }

    const sampleSignatures = Array.from(signaturesBySample.values()).map((signatures) =>
      signatures.slice().sort(),
    );
    expect(sampleSignatures).toHaveLength(2);
    expect(sampleSignatures[0]).toEqual(sampleSignatures[1]);
  });

  test("bundle plan backfill creates and links missing plans", async () => {
    const t = initTest();
    const { pool_id } = await setupPool(t);
    const experiment = await t.mutation(api.packages.lab.initExperiment, {
      experiment_tag: "bundle-plan-backfill-test",
      pool_id,
      experiment_config: {
        rubric_config: {
          model: "gpt-4.1-mini",
          scale_size: 4,
          concept: "institutional capture",
        },
        scoring_config: {
          model: "gpt-4.1-mini",
          method: "subset",
          abstain_enabled: true,
          evidence_view: "l2_neutralized",
          randomizations: [],
          evidence_bundle_size: 2,
          bundle_strategy: "semantic_cluster",
          bundle_strategy_version: "v3_1",
          clustering_seed: 20260317,
        },
      },
    });

    const dryRun = await t.mutation(api.packages.codex.backfillExperimentBundlePlans, {
      dry_run: true,
      experiment_ids: [experiment.experiment_id],
    });
    expect(dryRun.rows[0]?.changed).toBe(true);
    expect(dryRun.rows[0]?.created_bundle_plan).toBe(true);

    const applied = await t.mutation(api.packages.codex.backfillExperimentBundlePlans, {
      dry_run: false,
      experiment_ids: [experiment.experiment_id],
    });
    expect(applied.rows[0]?.changed).toBe(true);
    expect(applied.rows[0]?.created_bundle_plan).toBe(true);
    expect(applied.rows[0]?.next_bundle_plan_id).toBeTruthy();

    const summary = await t.query(api.packages.lab.getExperimentSummary, {
      experiment_id: experiment.experiment_id,
    });
    expect(summary.bundle_plan_id).toEqual(applied.rows[0]?.next_bundle_plan_id as Id<"bundle_plans">);

    const plans = await t.query(api.packages.lab.listBundlePlans, {
      pool_id,
    });
    const createdPlan = plans.find((plan: (typeof plans)[number]) => (
      plan.bundle_plan_id === summary.bundle_plan_id
    ));
    expect(createdPlan?.strategy).toBe("semantic_cluster");
    expect(createdPlan?.materialized_item_count).toBe(4);
  });
});
