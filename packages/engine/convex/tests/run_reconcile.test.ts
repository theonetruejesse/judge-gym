import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
import { ENGINE_SETTINGS } from "../settings";

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
      query: "run reconcile test",
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

async function markRunWithExhaustedRubricCriticTarget(
  t: ConvexTestInstance,
  run_id: Id<"runs">,
) {
  await t.run(async (ctx) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("run_not_found");

    const experiment = await ctx.db.get(run.experiment_id);
    if (!experiment) throw new Error("experiment_not_found");

    const samples = (await ctx.db.query("samples").collect()).filter((sample) => sample.run_id === run_id);
    expect(samples).toHaveLength(2);

    for (const sample of samples) {
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
        label_mapping: {},
      });

      await ctx.db.patch(sample._id, {
        rubric_id: rubricId,
      });
    }

    const successfulSample = samples[0]!;
    const exhaustedSample = samples[1]!;

    const successfulCriticRequestId = await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: experiment.rubric_config.model,
        user_prompt: "rubric critic request",
        custom_key: `sample:${successfulSample._id}:rubric_critic`,
        attempt_index: 1,
      },
    );
    await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
      request_id: successfulCriticRequestId,
      patch: {
        status: "success",
        assistant_output: "rubric critic output",
      },
    });
    const rubricCriticId = await ctx.db.insert("rubric_critics", {
      run_id,
      sample_id: successfulSample._id,
      model: experiment.rubric_config.model,
      llm_request_id: successfulCriticRequestId,
      justification: "ok",
      expert_agreement_prob: {
        observability_score: 0.9,
        discriminability_score: 0.8,
      },
    });
    await ctx.db.patch(successfulSample._id, {
      rubric_critic_id: rubricCriticId,
    });

    const exhaustedCriticRequestId = await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: experiment.rubric_config.model,
        user_prompt: "rubric critic request",
        custom_key: `sample:${exhaustedSample._id}:rubric_critic`,
        attempt_index: ENGINE_SETTINGS.run_policy.max_request_attempts,
      },
    );
    await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
      request_id: exhaustedCriticRequestId,
      patch: {
        status: "error",
        last_error: "Your request timed out.",
      },
    });
  });
}

describe("run reconcile", () => {
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

  test("reconcileRunStage terminalizes partially exhausted rubric_critic stages", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 2,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(run_id, {
        status: "running",
        current_stage: "rubric_gen",
      });
    });

    await markRunWithExhaustedRubricCriticTarget(t, run_id);

    const rubricGen = await t.mutation(internal.domain.runs.run_service.reconcileRunStage, {
      run_id,
      stage: "rubric_gen",
    });
    expect(rubricGen.outcome).toBe("advanced");

    const rubricCritic = await t.mutation(internal.domain.runs.run_service.reconcileRunStage, {
      run_id,
      stage: "rubric_critic",
    });
    expect(rubricCritic.outcome).toBe("terminal_error");
    expect(rubricCritic.completed).toBe(1);
    expect(rubricCritic.failed).toBe(1);

    const summary = await t.query(api.packages.lab.getRunSummary, {
      run_id,
    });
    expect(summary.status).toBe("error");
    expect(summary.current_stage).toBe("rubric_critic");
    expect(summary.stage_counts).toEqual({
      rubric_gen: 2,
      rubric_critic: 1,
      score_gen: 0,
      score_critic: 0,
    });
  });
});
