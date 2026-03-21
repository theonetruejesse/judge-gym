import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";

type ConvexTestInstance = ReturnType<typeof convexTest>;

function initTest(): ConvexTestInstance {
  return convexTest(schema, buildModules());
}

async function seedCompletedWindowRun(t: ConvexTestInstance) {
  const createdWindow = await t.mutation(
    internal.domain.window.window_repo.upsertWindow,
    {
      window_tag: "v3_test_window",
      source_provider: "firecrawl",
      country: "USA",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "v3 matrix init test",
      default_target_count: 3,
      default_target_stage: "l2_neutralized",
    },
  );
  const createdRun = await t.mutation(
    internal.domain.window.window_repo.createWindowRun,
    {
      window_id: createdWindow.window_id,
      model: "gpt-4.1-mini",
      target_count: 3,
    },
  );
  await t.mutation(api.packages.worker.bindWindowWorkflow, {
    window_run_id: createdRun.window_run_id,
    workflow_id: `window:${createdRun.window_run_id}`,
    workflow_run_id: "test-run",
  });

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_run_id: createdRun.window_run_id,
    evidences: [
      {
        title: "Evidence one",
        url: "https://example.com/1",
        raw_content: "Raw content one",
      },
      {
        title: "Evidence two",
        url: "https://example.com/2",
        raw_content: "Raw content two",
      },
      {
        title: "Evidence three",
        url: "https://example.com/3",
        raw_content: "Raw content three",
      },
    ],
  });
  await t.mutation(api.packages.worker.projectProcessState, {
    processKind: "window",
    processId: createdRun.window_run_id,
    workflowId: `window:${createdRun.window_run_id}`,
    workflowRunId: "test-run",
    workflowType: "WindowWorkflow",
    executionStatus: "completed",
    stage: "l2_neutralized",
    stageStatus: "done",
    pauseAfter: null,
    stageHistory: ["collect", "l1_cleaned", "l2_neutralized"],
    lastControlCommandId: null,
    lastErrorMessage: null,
  });

  return {
    window_id: createdWindow.window_id,
    window_run_id: createdRun.window_run_id,
  };
}

describe("v3 matrix initialization", () => {
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

  test("window runs inherit the definition default target stage", async () => {
    const t = initTest();
    const createdWindow = await t.mutation(
      internal.domain.window.window_repo.upsertWindow,
      {
        window_tag: "window_default_stage_test",
        source_provider: "firecrawl",
        country: "USA",
        start_date: "2026-03-01",
        end_date: "2026-03-02",
        query: "window default stage",
        default_target_count: 5,
        default_target_stage: "l2_neutralized",
      },
    );

    const createdRun = await t.mutation(
      internal.domain.window.window_repo.createWindowRun,
      {
        window_id: createdWindow.window_id,
        model: "gpt-4.1-mini",
        target_count: 5,
      },
    );
    const windowRun = await t.query(internal.domain.window.window_repo.getWindowRun, {
      window_run_id: createdRun.window_run_id,
    });

    expect(windowRun._id).toBe(createdRun.window_run_id);
    expect(windowRun.target_stage).toBe("l2_neutralized");
  });

  test("matrix init creates the corrected 32-experiment contract from one pool", async () => {
    const t = initTest();
    const seeded = await seedCompletedWindowRun(t);
    const pool = await t.mutation(api.packages.lab.createPoolFromWindowRun, {
      window_run_id: seeded.window_run_id,
      pool_tag: "v3_single_pool",
    });

    const contract = await t.query(api.packages.codex.getV3MatrixContract, {});
    expect(contract.experiment_count).toBe(32);

    const initialized = await t.mutation(api.packages.codex.initV3MatrixFromPool, {
      pool_id: pool.pool_id,
    });
    expect(initialized.experiment_count).toBe(32);
    expect(initialized.rows.every((row: (typeof initialized.rows)[number]) => row.action === "created")).toBe(true);

    const experiments = await t.query(api.packages.lab.listExperiments, {});
    const v3Experiments = experiments.filter((row: (typeof experiments)[number]) => row.experiment_tag.startsWith("v3_"));
    expect(v3Experiments).toHaveLength(32);

    const c2 = v3Experiments.find((row: (typeof v3Experiments)[number]) => row.experiment_tag === "v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2");
    expect(c2?.bundle_plan_id).toBeTruthy();
    expect(c2?.scoring_config.bundle_strategy).toBe("semantic_cluster");
    expect(c2?.scoring_config.evidence_bundle_size).toBe(5);

    const rerun = await t.mutation(api.packages.codex.initV3MatrixFromPool, {
      pool_id: pool.pool_id,
    });
    expect(rerun.rows.some((row: (typeof rerun.rows)[number]) => row.action === "created")).toBe(false);
    expect(rerun.rows.some((row: (typeof rerun.rows)[number]) => row.action === "conflict")).toBe(false);
  });
});
