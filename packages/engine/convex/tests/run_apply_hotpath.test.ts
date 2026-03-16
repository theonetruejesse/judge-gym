import { afterEach, beforeEach, describe, expect, test } from "vitest";
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

async function setupExperiment(t: ConvexTestInstance) {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: "gpt-4.1-mini",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "run apply hotpath test",
    },
  );

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id,
    evidences: [
      {
        title: "Test evidence",
        url: "https://example.com/test-evidence",
        raw_content: "A short evidence paragraph about institutional reporting.",
      },
    ],
  });

  const evidenceRows = await t.query(api.packages.lab.listEvidenceByWindow, {
    window_id,
  });

  const pool = await t.mutation(api.packages.lab.createPool, {
    evidence_ids: evidenceRows.map((row: { evidence_id: Id<"evidences"> }) => row.evidence_id),
  });

  const experiment = await t.mutation(api.packages.lab.initExperiment, {
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
        evidence_view: "l0_raw",
        randomizations: [],
        evidence_bundle_size: 1,
      },
    },
    pool_id: pool.pool_id,
  });

  return { experiment_id: experiment.experiment_id };
}

describe("run apply hotpath", () => {
  const originalDataset = process.env.AXIOM_DATASET;
  const originalToken = process.env.AXIOM_TOKEN;
  const originalSkipExport = process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT;

  beforeEach(() => {
    process.env.AXIOM_DATASET = "judge-gym-test";
    process.env.AXIOM_TOKEN = "test-token";
    process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT = "1";
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
  });

  test("applyRequestResult updates counts without advancing the run stage inline", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 1,
    });

    const sample_id = await t.run(async (ctx) => {
      await ctx.db.patch(run_id, {
        status: "running",
        current_stage: "rubric_gen",
      });
      const samples = (await ctx.db.query("samples").collect())
        .filter((sample) => sample.run_id === run_id);
      return samples[0]!._id;
    });

    const request_id = await t.mutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: "gpt-4.1-mini",
        user_prompt: "rubric request",
        custom_key: `sample:${sample_id}:rubric_gen`,
        attempt_index: 1,
      },
    );

    await t.mutation(internal.domain.runs.run_service.applyRequestResult, {
      request_id,
      custom_key: `sample:${sample_id}:rubric_gen`,
      output: [
        "Reasoning about the evidence.",
        "RUBRIC:",
        "1) Weak :: criterion a; criterion b; criterion c",
        "2) Medium :: criterion a; criterion b; criterion c",
        "3) Strong :: criterion a; criterion b; criterion c",
        "4) Max :: criterion a; criterion b; criterion c",
      ].join("\n"),
    });

    const beforeReconcile = await t.query(api.packages.lab.getRunSummary, {
      run_id,
    });
    expect(beforeReconcile.status).toBe("running");
    expect(beforeReconcile.current_stage).toBe("rubric_gen");
    expect(beforeReconcile.stage_counts).toEqual({
      rubric_gen: 1,
      rubric_critic: 0,
      score_gen: 0,
      score_critic: 0,
    });

    const reconcile = await t.mutation(internal.domain.runs.run_service.reconcileRunStage, {
      run_id,
      stage: "rubric_gen",
    });
    expect(reconcile.outcome).toBe("advanced");

    const afterReconcile = await t.query(api.packages.lab.getRunSummary, {
      run_id,
    });
    expect(afterReconcile.current_stage).toBe("rubric_critic");
  });
});
