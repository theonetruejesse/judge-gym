import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildV3CampaignSnapshot } from "../domain/maintenance/codex";

type ConvexTestInstance = ReturnType<typeof convexTest>;

const activeTests: ConvexTestInstance[] = [];

function initTest(): ConvexTestInstance {
  const t = convexTest(schema, buildModules());
  activeTests.push(t);
  return t;
}

async function seedWindowAndEvidence(t: ConvexTestInstance) {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "campaign control plane test",
      default_target_count: 2,
    },
  );
  const { window_run_id } = await t.mutation(
    internal.domain.window.window_repo.createWindowRun,
    {
      window_id,
      model: "gpt-4.1-mini",
      target_count: 2,
      target_stage: "l3_abstracted",
    },
  );

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_run_id,
    evidences: [
      {
        title: "Test evidence one",
        url: "https://example.com/test-evidence-1",
        raw_content: "Institutional conflict and procedural oversight article.",
      },
      {
        title: "Test evidence two",
        url: "https://example.com/test-evidence-2",
        raw_content: "Independent courts and election administration article.",
      },
    ],
  });

  const evidenceRows = await t.query(api.packages.lab.listEvidenceByWindow, {
    window_id,
  });

  const pool = await t.mutation(api.packages.lab.createPool, {
    evidence_ids: evidenceRows.map((row: { evidence_id: Id<"evidences"> }) => row.evidence_id),
    pool_tag: "test_v3_pool",
  });

  return { pool_id: pool.pool_id };
}

async function seedExperiment(
  t: ConvexTestInstance,
  args: {
    experiment_tag: string;
    pool_id: Id<"pools">;
    evidence_bundle_size?: number;
  },
) {
  const created = await t.mutation(api.packages.lab.initExperiment, {
    experiment_tag: args.experiment_tag,
    experiment_config: {
      rubric_config: {
        model: "gpt-4.1-mini",
        scale_size: 4,
        concept: "fascism",
      },
      scoring_config: {
        model: "gpt-4.1-mini",
        method: "subset",
        abstain_enabled: true,
        evidence_view: "l2_neutralized",
        randomizations: [
          "anonymize_stages",
          "hide_label_text",
          "shuffle_rubric_order",
        ],
        evidence_bundle_size: args.evidence_bundle_size ?? 1,
      },
    },
    pool_id: args.pool_id,
  });

  return created.experiment_id;
}

describe("v3 campaign control plane", () => {
  const originalDataset = process.env.AXIOM_DATASET;
  const originalToken = process.env.AXIOM_TOKEN;
  const originalSkipExport = process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT;

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
    vi.restoreAllMocks();
  });

  test("status reports preflight_clean for reset cohort", async () => {
    const t = initTest();
    const { pool_id } = await seedWindowAndEvidence(t);
    await seedExperiment(t, {
      experiment_tag: "v3_test_alpha",
      pool_id,
      evidence_bundle_size: 1,
    });
    await seedExperiment(t, {
      experiment_tag: "v3_test_beta",
      pool_id,
      evidence_bundle_size: 2,
    });
    await seedExperiment(t, {
      experiment_tag: "not_v3_gamma",
      pool_id,
    });

    const status = await t.query(api.packages.codex.getV3CampaignStatus, {});
    expect(status.selected_experiment_count).toBe(2);
    expect(status.missing_experiment_tags).toEqual([]);
    expect(status.campaign_state).toBe("preflight_clean");
    expect(status.launch_ready).toBe(true);
    expect(status.counts.with_latest_run).toBe(0);
    expect(status.experiments.map((row: (typeof status.experiments)[number]) => row.score_target_estimate.per_sample)).toEqual([2, 1]);
    expect(status.workload_family_summary).toEqual([
      {
        estimated_total_score_targets: 0,
        experiment_count: 2,
        start: 2,
        queued: 0,
        completed: 0,
        running: 0,
        paused: 0,
        error: 0,
        canceled: 0,
        with_failures: 0,
      },
    ]);
  });

  test("campaign snapshot combines explicit cohort status with Temporal readiness", async () => {
    const t = initTest();
    const { pool_id } = await seedWindowAndEvidence(t);
    await seedExperiment(t, {
      experiment_tag: "v3_test_alpha",
      pool_id,
      evidence_bundle_size: 1,
    });
    await seedExperiment(t, {
      experiment_tag: "v3_test_beta",
      pool_id,
      evidence_bundle_size: 2,
    });

    const status = await t.query(api.packages.codex.getV3CampaignStatus, {
      experiment_tags: ["v3_test_alpha", "v3_test_beta"],
    });

    const snapshot = buildV3CampaignSnapshot({
      status,
      temporal_readiness: {
        namespace: "default",
        checked_at_ms: Date.now(),
        all_ready: false,
        queues: [
        {
          queue_kind: "run",
          task_queue: "judge-gym.run",
          workflow_poller_count: 1,
          activity_poller_count: 1,
          workflow_pollers: [
            { identity: "worker-a", last_access_time_ms: Date.now() },
          ],
          activity_pollers: [
            { identity: "worker-a", last_access_time_ms: Date.now() },
          ],
          approximate_backlog_count: 0,
          approximate_backlog_age_ms: 0,
          tasks_add_rate: 0,
          tasks_dispatch_rate: 0,
          ready: true,
        },
        {
          queue_kind: "window",
          task_queue: "judge-gym.window",
          workflow_poller_count: 0,
          activity_poller_count: 0,
          workflow_pollers: [],
          activity_pollers: [],
          approximate_backlog_count: 3,
          approximate_backlog_age_ms: 12_000,
          tasks_add_rate: 0.1,
          tasks_dispatch_rate: 0,
          ready: false,
        },
        ],
      },
      temporal_readiness_error: null,
    });

    expect(snapshot.status.selected_experiment_count).toBe(2);
    expect(snapshot.status.campaign_state).toBe("preflight_clean");
    expect(snapshot.temporal_readiness.all_ready).toBe(false);
    expect(snapshot.temporal_readiness_error).toBeNull();
    expect(snapshot.effective_campaign_state).toBe("preflight_clean");
    expect(snapshot.launch_ready).toBe(false);
    expect(snapshot.blocked_task_queues).toEqual(["judge-gym.window"]);
  });

  test("resetRuns wipes run-scoped data for the cohort only", async () => {
    const t = initTest();
    const { pool_id } = await seedWindowAndEvidence(t);
    const alpha = await seedExperiment(t, {
      experiment_tag: "v3_test_alpha",
      pool_id,
    });
    const beta = await seedExperiment(t, {
      experiment_tag: "v3_test_beta",
      pool_id,
    });
    const alphaRun = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id: alpha,
      target_count: 1,
      pause_after: null,
    });
    const betaRun = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id: beta,
      target_count: 1,
      pause_after: null,
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(alphaRun, { status: "completed" });
      await ctx.db.patch(betaRun, { status: "completed" });
    });

    const reset = await t.mutation(api.packages.codex.resetRuns, {
      dry_run: false,
    });
    expect(reset.selected_experiment_count).toBe(2);
    expect(reset.processed_experiment_count).toBe(2);
    expect(reset.next_cursor).toBeNull();
    expect(reset.totals.runs).toBe(2);

    await t.run(async (ctx) => {
      expect(await ctx.db.query("runs").collect()).toHaveLength(0);
      expect(await ctx.db.query("samples").collect()).toHaveLength(0);
      expect(await ctx.db.query("llm_attempts").collect()).toHaveLength(0);
      const experiments = await ctx.db.query("experiments").collect();
      expect(experiments.every((experiment) => experiment.total_count === 0)).toBe(true);
    });
  });

  test("resetRuns can wipe paused cohort runs when allow_active is true", async () => {
    const t = initTest();
    const { pool_id } = await seedWindowAndEvidence(t);
    const alpha = await seedExperiment(t, {
      experiment_tag: "v3_test_alpha",
      pool_id,
    });

    const runId = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id: alpha,
      target_count: 1,
      pause_after: "rubric_critic",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(runId, {
        status: "paused",
        current_stage: "rubric_critic",
      });
    });

    await expect(
      t.mutation(api.packages.codex.resetRuns, {
        dry_run: false,
      }),
    ).rejects.toThrow(/Refusing to delete active run/);

    const reset = await t.mutation(api.packages.codex.resetRuns, {
      dry_run: false,
      allow_active: true,
    });
    expect(reset.selected_experiment_count).toBe(1);
    expect(reset.processed_experiment_count).toBe(1);
    expect(reset.next_cursor).toBeNull();
    expect(reset.totals.runs).toBe(1);

    await t.run(async (ctx) => {
      expect(await ctx.db.query("runs").collect()).toHaveLength(0);
    });
  });
});
