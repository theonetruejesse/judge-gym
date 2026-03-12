import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";

type ConvexTestInstance = ReturnType<typeof convexTest>;

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

function initTest(): ConvexTestInstance {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
}

async function createWindowWithEvidence(
  t: ConvexTestInstance,
  query: string,
  evidenceCount: number,
  rawPrefix: string,
) {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: "gpt-4.1-mini",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query,
    },
  );

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id,
    evidences: Array.from({ length: evidenceCount }, (_, index) => ({
      title: `${query} evidence ${index + 1}`,
      url: `https://example.com/${rawPrefix}/${index + 1}`,
      raw_content: `${rawPrefix} raw content ${index + 1}. `.repeat(40),
    })),
  });

  return {
    window_id,
    evidences: await t.query(api.packages.lab.listEvidenceByWindow, { window_id }),
  };
}

async function createPoolFromWindows(
  t: ConvexTestInstance,
  windows: Array<{ evidences: Array<{ evidence_id: Id<"evidences"> }> }>,
) {
  const evidence_ids = windows.flatMap((window) => window.evidences.map((row) => row.evidence_id));
  return t.mutation(api.packages.lab.createPool, { evidence_ids });
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

  test("single_evidence runs create one score target per pool evidence per sample", async () => {
    const t = initTest();
    const windowA = await createWindowWithEvidence(t, "single-a", 2, "single-a");
    const windowB = await createWindowWithEvidence(t, "single-b", 1, "single-b");
    const pool = await createPoolFromWindows(t, [windowA, windowB]);

    const { experiment_id } = await t.mutation(api.packages.lab.initExperiment, {
      pool_id: pool.pool_id,
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
          evidence_view: "l2_neutralized",
          randomizations: [],
          evidence_grouping: {
            mode: "single_evidence",
          },
        },
      },
    });

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 2,
    });

    const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });

    expect(scoreTargets).toHaveLength(6);
    expect(
      scoreTargets.every((target: (typeof scoreTargets)[number]) => target.target_mode === "single_evidence"),
    ).toBe(true);
    for (const target of scoreTargets) {
      expect(target.items).toHaveLength(1);
      expect(target.items[0]?.position).toBe(0);
    }
  });

  test("bundle runs partition the pool into stratified score targets per sample", async () => {
    const t = initTest();
    const windows = await Promise.all([
      createWindowWithEvidence(t, "bundle-a", 2, "bundle-a"),
      createWindowWithEvidence(t, "bundle-b", 2, "bundle-b"),
      createWindowWithEvidence(t, "bundle-c", 2, "bundle-c"),
      createWindowWithEvidence(t, "bundle-d", 2, "bundle-d"),
    ]);
    const pool = await createPoolFromWindows(t, windows);

    const { experiment_id } = await t.mutation(api.packages.lab.initExperiment, {
      pool_id: pool.pool_id,
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
          evidence_view: "l2_neutralized",
          randomizations: [],
          evidence_grouping: {
            mode: "bundle",
            bundle_size: 3,
            bundle_strategy: "stratified_by_window",
            assignment_scope: "per_run",
            max_estimated_input_tokens: 20000,
          },
        },
      },
    });

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 2,
    });

    const scoreTargets = await t.query(api.packages.lab.listRunScoreTargets, { run_id });
    expect(scoreTargets).toHaveLength(6);
    const groupedBySample = new Map<string, (typeof scoreTargets)>();
    for (const target of scoreTargets) {
      expect(target.target_mode).toBe("bundle");
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
          targets[0]!.items.map((item: { window_id: Id<"windows"> }) => String(item.window_id)),
        ).size,
      ).toBe(3);
    }
  });

  test("bundle token gate fails fast when estimated input is too large", async () => {
    const t = initTest();
    const windows = await Promise.all([
      createWindowWithEvidence(t, "gate-a", 2, "gate-a"),
      createWindowWithEvidence(t, "gate-b", 2, "gate-b"),
      createWindowWithEvidence(t, "gate-c", 2, "gate-c"),
    ]);
    const pool = await createPoolFromWindows(t, windows);

    const { experiment_id } = await t.mutation(api.packages.lab.initExperiment, {
      pool_id: pool.pool_id,
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
          evidence_grouping: {
            mode: "bundle",
            bundle_size: 3,
            bundle_strategy: "stratified_by_window",
            assignment_scope: "per_run",
            max_estimated_input_tokens: 10,
          },
        },
      },
    });

    await expect(
      t.mutation(internal.domain.runs.run_repo.createRun, {
        experiment_id,
        target_count: 1,
      }),
    ).rejects.toThrow(/max_estimated_input_tokens/i);
  });

  test("windows and pools persist count fields", async () => {
    const t = initTest();
    const windowA = await createWindowWithEvidence(t, "count-a", 2, "count-a");
    const windowB = await createWindowWithEvidence(t, "count-b", 3, "count-b");
    const pool = await createPoolFromWindows(t, [windowA, windowB]);

    const storedWindowA = await t.query(internal.domain.window.window_repo.getWindow, {
      window_id: windowA.window_id,
    });
    const storedWindowB = await t.query(internal.domain.window.window_repo.getWindow, {
      window_id: windowB.window_id,
    });
    const storedPool = await t.query(internal.domain.runs.experiments_repo.getPool, {
      pool_id: pool.pool_id,
    });

    expect(storedWindowA.target_count).toBe(2);
    expect(storedWindowA.completed_count).toBe(0);
    expect(storedWindowB.target_count).toBe(3);
    expect(storedWindowB.completed_count).toBe(0);
    expect(storedPool.evidence_count).toBe(5);
  });
});
