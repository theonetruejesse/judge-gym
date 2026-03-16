import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
import type { Id } from "../_generated/dataModel";

type ConvexTestInstance = ReturnType<typeof convexTest>;

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

function initTest(): ConvexTestInstance {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
}

async function seedWindowAndEvidence(t: ConvexTestInstance) {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: "gpt-4.1-mini",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "campaign control plane test",
    },
  );

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id,
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

  await t.run(async (ctx) => {
    await ctx.db.patch(created.experiment_id, {
      experiment_tag: args.experiment_tag,
    });
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

  test("startV3Experiments launches only cohort rows and persists pause_after", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    const t = initTest();
    try {
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

      const launched = await t.mutation(api.packages.codex.startV3Experiments, {
        target_count: 2,
        pause_after: "rubric_critic",
        start_scheduler: false,
      });
      expect(launched.selected_experiment_count).toBe(2);
      expect(launched.rows.filter((row: (typeof launched.rows)[number]) => row.action === "started")).toHaveLength(2);
      expect(launched.rows.every((row: (typeof launched.rows)[number]) =>
        row.reason === "scheduled_start" && row.run_id === null
      )).toBe(true);

      await t.finishAllScheduledFunctions(() => {
        vi.runAllTimers();
      });

      const status = await t.query(api.packages.codex.getV3CampaignStatus, {
        expected_pause_after: "rubric_critic",
      });
      expect(status.selected_experiment_count).toBe(2);
      expect(status.counts.with_latest_run).toBe(2);
      expect(status.experiments.every((experiment: (typeof status.experiments)[number]) =>
        experiment.latest_run?.pause_after === "rubric_critic"
      )).toBe(true);
      expect(status.workload_family_summary).toEqual([
        {
          estimated_total_score_targets: 2,
          experiment_count: 1,
          start: 0,
          queued: 0,
          completed: 0,
          running: 1,
          paused: 0,
          error: 0,
          canceled: 0,
          with_failures: 0,
        },
        {
          estimated_total_score_targets: 4,
          experiment_count: 1,
          start: 0,
          queued: 0,
          completed: 0,
          running: 1,
          paused: 0,
          error: 0,
          canceled: 0,
          with_failures: 0,
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("resumeV3Experiments resumes paused latest runs in place", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    const t = initTest();
    try {
      const { pool_id } = await seedWindowAndEvidence(t);
      const alpha = await seedExperiment(t, {
        experiment_tag: "v3_test_alpha",
        pool_id,
      });
      await seedExperiment(t, {
        experiment_tag: "not_v3_gamma",
        pool_id,
      });

      const runId = await t.mutation(internal.domain.runs.run_repo.createRun, {
        experiment_id: alpha,
        target_count: 1,
        pause_after: "rubric_critic",
      });
      const rubricRequestId = await t.mutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: "gpt-4.1-mini",
          user_prompt: "rubric request",
          custom_key: "sample:test:rubric_gen",
          attempt_index: 1,
        },
      );
      const rubricCriticRequestId = await t.mutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: "gpt-4.1-mini",
          user_prompt: "rubric critic request",
          custom_key: "sample:test:rubric_critic",
          attempt_index: 1,
        },
      );

      await t.run(async (ctx) => {
        const samples = (await ctx.db.query("samples").collect())
          .filter((sample) => sample.run_id === runId);
        expect(samples).toHaveLength(1);
        const rubricId = await ctx.db.insert("rubrics", {
          run_id: runId,
          sample_id: samples[0]!._id,
          model: "gpt-4.1-mini",
          concept: "fascism",
          scale_size: 4,
          llm_request_id: rubricRequestId,
          justification: "ok",
          stages: [
            { stage_number: 1, label: "Weak", criteria: ["a"] },
            { stage_number: 2, label: "Medium", criteria: ["b"] },
            { stage_number: 3, label: "Strong", criteria: ["c"] },
            { stage_number: 4, label: "Max", criteria: ["d"] },
          ],
          label_mapping: {},
        });
        const rubricCriticId = await ctx.db.insert("rubric_critics", {
          run_id: runId,
          sample_id: samples[0]!._id,
          model: "gpt-4.1-mini",
          llm_request_id: rubricCriticRequestId,
          justification: "ok",
          expert_agreement_prob: {
            observability_score: 0.9,
            discriminability_score: 0.8,
          },
        });
        await ctx.db.patch(samples[0]!._id, {
          rubric_id: rubricId,
          rubric_critic_id: rubricCriticId,
        });
        await ctx.db.patch(runId, {
          status: "paused",
          current_stage: "rubric_critic",
          rubric_gen_count: 1,
          rubric_critic_count: 1,
        });
      });

      const resumed = await t.mutation(api.packages.codex.resumeV3Experiments, {
        pause_after: null,
        start_scheduler: false,
      });
      expect(resumed.selected_experiment_count).toBe(1);
      expect(resumed.rows).toEqual([
        expect.objectContaining({
          experiment_tag: "v3_test_alpha",
          action: "resumed",
          reason: "scheduled_resume",
          run_id: runId,
        }),
      ]);

      await t.finishAllScheduledFunctions(() => {
        vi.runAllTimers();
      });

      await t.run(async (ctx) => {
        const run = await ctx.db.get(runId);
        expect(run?.status).toBe("running");
        expect(run?.current_stage).toBe("score_gen");
        expect(run?.pause_after).toBeNull();

        const requests = await ctx.db.query("llm_requests").collect();
        expect(requests.some((request) => request.run_id === runId || request.custom_key.endsWith(":score_gen"))).toBe(true);
      });
    } finally {
      vi.useRealTimers();
    }
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
      expect(await ctx.db.query("llm_requests").collect()).toHaveLength(0);
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
      expect(await ctx.db.query("samples").collect()).toHaveLength(0);
    });
  });
});
