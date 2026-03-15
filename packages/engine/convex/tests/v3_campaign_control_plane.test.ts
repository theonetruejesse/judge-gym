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
        evidence_bundle_size: 1,
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
    });
    await seedExperiment(t, {
      experiment_tag: "v3_test_beta",
      pool_id,
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
      });
      await seedExperiment(t, {
        experiment_tag: "v3_test_beta",
        pool_id,
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

      const status = await t.query(api.packages.codex.getV3CampaignStatus, {
        expected_pause_after: "rubric_critic",
      });
      expect(status.selected_experiment_count).toBe(2);
      expect(status.counts.with_latest_run).toBe(2);
      expect(status.experiments.every((experiment: (typeof status.experiments)[number]) =>
        experiment.latest_run?.pause_after === "rubric_critic"
      )).toBe(true);
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
    expect(reset.totals.runs).toBe(2);

    await t.run(async (ctx) => {
      expect(await ctx.db.query("runs").collect()).toHaveLength(0);
      expect(await ctx.db.query("samples").collect()).toHaveLength(0);
      expect(await ctx.db.query("llm_requests").collect()).toHaveLength(0);
      const experiments = await ctx.db.query("experiments").collect();
      expect(experiments.every((experiment) => experiment.total_count === 0)).toBe(true);
    });
  });
});
