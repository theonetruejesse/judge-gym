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
const activeTests: ConvexTestInstance[] = [];

function initTest(): ConvexTestInstance {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  activeTests.push(t);
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
    vi.useFakeTimers();
    process.env.AXIOM_DATASET = "judge-gym-test";
    process.env.AXIOM_TOKEN = "test-token";
    process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT = "1";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
  });

  afterEach(async () => {
    while (activeTests.length > 0) {
      const t = activeTests.pop();
      if (!t) continue;
      await t.finishAllScheduledFunctions(() => {
        vi.runAllTimers();
      });
    }
    vi.useRealTimers();
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

  test("score-stage apply uses score artifacts without patching sample_score_targets", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 1,
    });

    const { sample_id, score_target_id } = await t.run(async (ctx) => {
      await ctx.db.patch(run_id, {
        status: "running",
        current_stage: "score_gen",
      });

      const run = await ctx.db.get(run_id);
      if (!run) throw new Error("run_not_found");
      const experiment = await ctx.db.get(run.experiment_id);
      if (!experiment) throw new Error("experiment_not_found");

      const sample = (await ctx.db.query("samples").collect())
        .find((row) => row.run_id === run_id);
      if (!sample) throw new Error("sample_not_found");

      const rubricRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: experiment.rubric_config.model,
          user_prompt: "rubric request",
          custom_key: `sample:${sample._id}:rubric_gen`,
          attempt_index: 1,
        },
      );
      await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: rubricRequestId,
        patch: {
          status: "success",
          assistant_output: "rubric output",
        },
      });

      const rubricId = await ctx.db.insert("rubrics", {
        run_id,
        sample_id: sample._id,
        model: experiment.rubric_config.model,
        concept: experiment.rubric_config.concept,
        scale_size: experiment.rubric_config.scale_size,
        llm_request_id: rubricRequestId,
        justification: "ok",
        stages: [
          { stage_number: 1, label: "Weak", criteria: ["a", "b", "c"] },
          { stage_number: 2, label: "Medium", criteria: ["a", "b", "c"] },
          { stage_number: 3, label: "Strong", criteria: ["a", "b", "c"] },
          { stage_number: 4, label: "Max", criteria: ["a", "b", "c"] },
        ],
        label_mapping: {
          A: 1,
        },
      });

      const rubricCriticRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: experiment.rubric_config.model,
          user_prompt: "rubric critic request",
          custom_key: `sample:${sample._id}:rubric_critic`,
          attempt_index: 1,
        },
      );
      await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: rubricCriticRequestId,
        patch: {
          status: "success",
          assistant_output: "rubric critic output",
        },
      });
      const rubricCriticId = await ctx.db.insert("rubric_critics", {
        run_id,
        sample_id: sample._id,
        model: experiment.rubric_config.model,
        llm_request_id: rubricCriticRequestId,
        justification: "ok",
        expert_agreement_prob: {
          observability_score: 0.9,
          discriminability_score: 0.8,
        },
      });

      await ctx.db.patch(sample._id, {
        rubric_id: rubricId,
        rubric_critic_id: rubricCriticId,
      });

      const scoreTarget = (await ctx.db.query("sample_score_targets").collect())
        .find((row) => row.run_id === run_id && row.sample_id === sample._id);
      if (!scoreTarget) throw new Error("score_target_not_found");
      return {
        sample_id: sample._id,
        score_target_id: scoreTarget._id,
      };
    });

    const score_request_id = await t.mutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: "gpt-4.1-mini",
        user_prompt: "score request",
        custom_key: `sample_score_target:${score_target_id}:score_gen`,
        attempt_index: 1,
      },
    );

    await t.mutation(internal.domain.runs.run_service.applyRequestResult, {
      request_id: score_request_id,
      custom_key: `sample_score_target:${score_target_id}:score_gen`,
      output: [
        "Reasoning about the evidence.",
        "VERDICT: A",
      ].join("\n"),
    });

    await t.run(async (ctx) => {
      const scoreTarget = await ctx.db.get(score_target_id);
      const sample = await ctx.db.get(sample_id);
      const scores = await ctx.db.query("scores").collect();
      expect(scoreTarget?.score_id).toBeNull();
      expect(sample?.score_count).toBe(1);
      expect(
        scores.some((score) => score.score_target_id === score_target_id),
      ).toBe(true);
    });

    const score_critic_request_id = await t.mutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: "gpt-4.1-mini",
        user_prompt: "score critic request",
        custom_key: `sample_score_target:${score_target_id}:score_critic`,
        attempt_index: 1,
      },
    );

    await t.mutation(internal.domain.runs.run_service.applyRequestResult, {
      request_id: score_critic_request_id,
      custom_key: `sample_score_target:${score_target_id}:score_critic`,
      output: [
        "Reasoning about agreement.",
        "EXPERT_AGREEMENT: 0.8",
      ].join("\n"),
    });

    await t.run(async (ctx) => {
      const scoreTarget = await ctx.db.get(score_target_id);
      const sample = await ctx.db.get(sample_id);
      const critics = await ctx.db.query("score_critics").collect();
      expect(scoreTarget?.score_critic_id).toBeNull();
      expect(sample?.score_critic_count).toBe(1);
      expect(
        critics.some((critic) => critic.score_target_id === score_target_id),
      ).toBe(true);
    });

    const summary = await t.query(api.packages.lab.getRunSummary, {
      run_id,
    });
    expect(summary.stage_counts).toEqual({
      rubric_gen: 1,
      rubric_critic: 1,
      score_gen: 1,
      score_critic: 1,
    });
  });
});
