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
      query: "run reporting test",
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

async function markRunArtifacts(
  t: ConvexTestInstance,
  run_id: Id<"runs">,
  failedSampleCount: number,
) {
  await t.run(async (ctx) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("run_not_found");

    const experiment = await ctx.db.get(run.experiment_id);
    if (!experiment) throw new Error("experiment_not_found");

    const samples = (await ctx.db.query("samples").collect()).filter((sample) => sample.run_id === run_id);
    const scoreTargets = (await ctx.db.query("sample_score_targets").collect()).filter((target) => target.run_id === run_id);
    const requests = (await ctx.db.query("llm_requests").collect()).filter((request) => request.run_id === run_id);

    const failedIds = new Set(samples.slice(0, failedSampleCount).map((sample) => String(sample._id)));
    const rubricRequestBySampleId = new Map(
      requests
        .filter((request) => request.custom_key.endsWith(":rubric_gen"))
        .map((request) => {
          const [, sampleId] = request.custom_key.split(":");
          return [sampleId, request] as const;
        }),
    );

    for (const sample of samples) {
      const rubricRequest = rubricRequestBySampleId.get(String(sample._id));
      if (!rubricRequest) throw new Error("rubric_request_not_found");

      if (failedIds.has(String(sample._id))) {
        await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
          request_id: rubricRequest._id,
          patch: {
            status: "error",
            attempt_index: ENGINE_SETTINGS.run_policy.max_request_attempts,
            last_error: "synthetic rubric failure",
          },
        });
        continue;
      }

      await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: rubricRequest._id,
        patch: {
          status: "success",
          assistant_output: "rubric output",
        },
      });
      const rubricRequestId = rubricRequest._id;
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
    }

    for (const target of scoreTargets) {
      if (failedIds.has(String(target.sample_id))) {
        continue;
      }

      const scoreRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: experiment.scoring_config.model,
          user_prompt: "score gen request",
          custom_key: `sample_score_target:${target._id}:score_gen`,
          attempt_index: 1,
        },
      );
      await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: scoreRequestId,
        patch: {
          status: "success",
          assistant_output: "score output",
        },
      });
      const scoreId = await ctx.db.insert("scores", {
        run_id,
        sample_id: target.sample_id,
        score_target_id: target._id,
        model: experiment.scoring_config.model,
        llm_request_id: scoreRequestId,
        justification: "ok",
        decoded_scores: [1],
      });

      const scoreCriticRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: experiment.scoring_config.model,
          user_prompt: "score critic request",
          custom_key: `sample_score_target:${target._id}:score_critic`,
          attempt_index: 1,
        },
      );
      await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: scoreCriticRequestId,
        patch: {
          status: "success",
          assistant_output: "score critic output",
        },
      });
      const scoreCriticId = await ctx.db.insert("score_critics", {
        run_id,
        sample_id: target.sample_id,
        score_target_id: target._id,
        model: experiment.scoring_config.model,
        llm_request_id: scoreCriticRequestId,
        justification: "ok",
        expert_agreement_prob: 0.8,
      });

      await ctx.db.patch(target._id, {
        score_id: scoreId,
        score_critic_id: scoreCriticId,
      });
    }

    for (const sample of samples) {
      const sampleTargets = scoreTargets.filter((target) => target.sample_id === sample._id);
      const successfulTargets = sampleTargets.filter((target) => !failedIds.has(String(target.sample_id)));
      await ctx.db.patch(sample._id, {
        score_count: successfulTargets.length,
        score_critic_count: successfulTargets.length,
      });
    }

    await ctx.db.patch(run_id, {
      status: "completed",
      current_stage: "score_critic",
      completed_count: Math.max(0, samples.length - failedSampleCount),
    });

    const experimentRuns = (await ctx.db.query("runs").collect()).filter(
      (row) => row.experiment_id === experiment._id,
    );
    const total_count = experimentRuns.reduce(
      (sum, row) => sum + (row.completed_count ?? 0),
      0,
    );
    await ctx.db.patch(experiment._id, {
      total_count,
    });
  });
}

async function markRunThroughRubricCritic(
  t: ConvexTestInstance,
  run_id: Id<"runs">,
) {
  await t.run(async (ctx) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("run_not_found");

    const experiment = await ctx.db.get(run.experiment_id);
    if (!experiment) throw new Error("experiment_not_found");

    const samples = (await ctx.db.query("samples").collect()).filter((sample) => sample.run_id === run_id);
    const requests = (await ctx.db.query("llm_requests").collect()).filter((request) => request.run_id === run_id);

    const rubricRequestBySampleId = new Map(
      requests
        .filter((request) => request.custom_key.endsWith(":rubric_gen"))
        .map((request) => {
          const [, sampleId] = request.custom_key.split(":");
          return [sampleId, request] as const;
        }),
    );

    for (const sample of samples) {
      const rubricRequest = rubricRequestBySampleId.get(String(sample._id));
      if (!rubricRequest) throw new Error("rubric_request_not_found");

      await ctx.runMutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: rubricRequest._id,
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
        llm_request_id: rubricRequest._id,
        justification: "ok",
        stages: [
          { stage_number: 1, label: "Weak", criteria: ["a", "b", "c"] },
          { stage_number: 2, label: "Medium", criteria: ["a", "b", "c"] },
          { stage_number: 3, label: "Strong", criteria: ["a", "b", "c"] },
          { stage_number: 4, label: "Max", criteria: ["a", "b", "c"] },
        ],
        label_mapping: {},
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
    }
  });
}

describe("run reporting", () => {
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

  test("startRunFlow marks persisted runs as running", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const started = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 1,
    });

    const run = await t.query(internal.domain.runs.run_repo.getRun, {
      run_id: started.run_id,
    });
    expect(run.status).toBe("running");
    expect(run.current_stage).toBe("rubric_gen");
    expect(run.completed_count).toBe(0);

    const experiments = await t.query(api.packages.lab.listExperiments, {});
    const experiment = experiments.find((row: { experiment_id: Id<"experiments"> }) => row.experiment_id === experiment_id);
    expect(experiment?.status).toBe("running");
    expect(experiment?.total_count).toBe(0);
    expect(experiment?.latest_run?.status).toBe("running");
    expect(experiment?.latest_run?.completed_count).toBe(0);
    expect(experiment?.latest_run?.has_failures).toBe(false);
  });

  test("getRunSummary surfaces partial failures and listExperiments flags them", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const started = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 3,
    });
    await markRunArtifacts(t, started.run_id, 1);

    const summary = await t.query(api.packages.lab.getRunSummary, {
      run_id: started.run_id,
    });
    expect(summary.status).toBe("completed");
    expect(summary.completed_count).toBe(2);
    expect(summary.has_failures).toBe(true);
    expect(summary.failed_stage_count).toBe(4);
    expect(summary.stages).toEqual([
      { stage: "rubric_gen", status: "completed", total: 3, completed: 2, failed: 1 },
      { stage: "rubric_critic", status: "completed", total: 3, completed: 2, failed: 1 },
      { stage: "score_gen", status: "completed", total: 3, completed: 2, failed: 1 },
      { stage: "score_critic", status: "completed", total: 3, completed: 2, failed: 1 },
    ]);

    const experiments = await t.query(api.packages.lab.listExperiments, {});
    const experiment = experiments.find((row: { experiment_id: Id<"experiments"> }) => row.experiment_id === experiment_id);
    expect(experiment?.total_count).toBe(2);
    expect(experiment?.latest_run?.completed_count).toBe(2);
    expect(experiment?.latest_run?.has_failures).toBe(true);

    const experimentSummary = await t.query(api.packages.lab.getExperimentSummary, {
      experiment_id,
    });
    expect(experimentSummary.total_count).toBe(2);
    expect(experimentSummary.latest_run?.completed_count).toBe(2);
    expect(experimentSummary.latest_run?.has_failures).toBe(true);

    const diagnostics = await t.query(api.packages.lab.getRunDiagnostics, {
      run_id: started.run_id,
    });
    expect(diagnostics.experiment_tag).toBeDefined();
    expect(diagnostics.score_target_estimate).toEqual({
      per_sample: 1,
      total_for_run: 3,
    });
    expect(diagnostics.request_counts.error).toBe(1);
    expect(diagnostics.request_counts.historical_error).toBe(1);
    expect(diagnostics.request_counts.terminal_failed_targets).toBe(1);
    expect(diagnostics.failed_requests).toEqual([
      expect.objectContaining({
        custom_key: expect.stringContaining(":rubric_gen"),
        last_error: "synthetic rubric failure",
      }),
    ]);
    expect(diagnostics.terminal_failed_targets).toEqual([
      expect.objectContaining({
        stage: "rubric_gen",
        attempt_count: 1,
        error_message: "synthetic rubric failure",
        sample_ordinal: 0,
      }),
    ]);
    expect(diagnostics.terminal_failed_target_summary).toEqual([
      {
        stage: "rubric_gen",
        count: 1,
        sample_ordinals: [0],
      },
    ]);
    expect(diagnostics.terminal_stage_rollup).toEqual({
      rubric_gen: { completed: 2, failed: 1, pending: 0 },
      rubric_critic: { completed: 2, failed: 1, pending: 0 },
      score_gen: { completed: 2, failed: 1, pending: 0 },
      score_critic: { completed: 2, failed: 1, pending: 0 },
    });
    expect(diagnostics.artifact_counts.sample_score_targets).toBe(3);

    const codexDiagnostics = await t.query(api.packages.codex.getRunDiagnostics, {
      run_id: started.run_id,
    });
    expect(codexDiagnostics.terminal_failed_target_summary).toEqual([
      {
        stage: "rubric_gen",
        count: 1,
        sample_ordinals: [0],
      },
    ]);
  });

  test("getRunSummary keeps clean runs failure-free", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const started = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 2,
    });
    await markRunArtifacts(t, started.run_id, 0);

    const summary = await t.query(api.packages.lab.getRunSummary, {
      run_id: started.run_id,
    });
    expect(summary.status).toBe("completed");
    expect(summary.completed_count).toBe(2);
    expect(summary.has_failures).toBe(false);
    expect(summary.failed_stage_count).toBe(0);
    expect(summary.stages.every((stage: { failed: number }) => stage.failed === 0)).toBe(true);

    const experiments = await t.query(api.packages.lab.listExperiments, {});
    const experiment = experiments.find((row: { experiment_id: Id<"experiments"> }) => row.experiment_id === experiment_id);
    expect(experiment?.total_count).toBe(2);
    expect(experiment?.latest_run?.completed_count).toBe(2);
    expect(experiment?.latest_run?.has_failures).toBe(false);
  });

  test("experiment total_count aggregates completed_count across runs", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const first = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 3,
    });
    await markRunArtifacts(t, first.run_id, 1);

    const second = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 2,
    });
    await markRunArtifacts(t, second.run_id, 0);

    const experimentSummary = await t.query(api.packages.lab.getExperimentSummary, {
      experiment_id,
    });
    expect(experimentSummary.total_count).toBe(4);
    expect(experimentSummary.latest_run?.completed_count).toBe(2);
  });

  test("backfillRunCompletedCounts repairs stale run completed_count values", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const started = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 2,
    });
    await markRunArtifacts(t, started.run_id, 0);

    await t.run(async (ctx) => {
      await ctx.db.patch(started.run_id, {
        completed_count: 0,
      });
    });

    const dryRun = await t.mutation(api.packages.codex.backfillRunCompletedCounts, {
      dry_run: true,
      run_ids: [started.run_id],
    });
    expect(dryRun.updated).toBe(1);
    expect(dryRun.rows).toEqual([
      expect.objectContaining({
        run_id: started.run_id,
        previous_completed_count: 0,
        computed_completed_count: 2,
        changed: true,
      }),
    ]);

    const applied = await t.mutation(api.packages.codex.backfillRunCompletedCounts, {
      dry_run: false,
      run_ids: [started.run_id],
    });
    expect(applied.updated).toBe(1);

    const summary = await t.query(api.packages.lab.getRunSummary, {
      run_id: started.run_id,
    });
    expect(summary.completed_count).toBe(2);
  });

  test("backfillExperimentTotalCounts repairs stale experiment total_count values", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const started = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 2,
    });
    await markRunArtifacts(t, started.run_id, 0);

    await t.run(async (ctx) => {
      await ctx.db.patch(experiment_id, {
        total_count: 0,
      });
    });

    const dryRun = await t.mutation(api.packages.codex.backfillExperimentTotalCounts, {
      dry_run: true,
      experiment_ids: [experiment_id],
    });
    expect(dryRun.updated).toBe(1);
    expect(dryRun.rows).toEqual([
      expect.objectContaining({
        experiment_id,
        previous_total_count: 0,
        computed_total_count: 2,
        changed: true,
      }),
    ]);

    const applied = await t.mutation(api.packages.codex.backfillExperimentTotalCounts, {
      dry_run: false,
      experiment_ids: [experiment_id],
    });
    expect(applied.updated).toBe(1);

    const experimentSummary = await t.query(api.packages.lab.getExperimentSummary, {
      experiment_id,
    });
    expect(experimentSummary.total_count).toBe(2);
  });

  test("backfillSampleScoreCounts repairs sample score aggregation fields", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const started = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 2,
    });
    await markRunArtifacts(t, started.run_id, 0);

    const samples = await t.run(async (ctx) =>
      ctx.db.query("samples").collect(),
    );
    const targetSamples = samples.filter((sample) => sample.run_id === started.run_id);

    await t.run(async (ctx) => {
      for (const sample of targetSamples) {
        await ctx.db.patch(sample._id, {
          score_count: 0,
          score_critic_count: 0,
        });
      }
    });

    const dryRun = await t.mutation(api.packages.codex.backfillSampleScoreCounts, {
      dry_run: true,
      sample_ids: targetSamples.map((sample) => sample._id),
    });
    expect(dryRun.updated).toBe(2);
    expect(dryRun.rows.every((row: typeof dryRun.rows[number]) => row.computed_score_count === 1)).toBe(true);
    expect(dryRun.rows.every((row: typeof dryRun.rows[number]) => row.computed_score_critic_count === 1)).toBe(true);

    const applied = await t.mutation(api.packages.codex.backfillSampleScoreCounts, {
      dry_run: false,
      sample_ids: targetSamples.map((sample) => sample._id),
    });
    expect(applied.updated).toBe(2);

    const refreshedSamples = await t.run(async (ctx) =>
      ctx.db.query("samples").collect(),
    );
    const refreshedTargets = refreshedSamples.filter((sample) => sample.run_id === started.run_id);
    expect(refreshedTargets.every((sample) => sample.score_count === 1)).toBe(true);
    expect(refreshedTargets.every((sample) => sample.score_critic_count === 1)).toBe(true);
  });

  test("pause_after pauses after rubric_critic and persists stage counters", async () => {
    const t = initTest();
    const { experiment_id } = await setupExperiment(t);

    const started = await t.mutation(api.packages.lab.startExperimentRun, {
      experiment_id,
      target_count: 2,
      pause_after: "rubric_critic",
    });
    await markRunThroughRubricCritic(t, started.run_id);

    await t.mutation(internal.domain.runs.run_service.reconcileRunStage, {
      run_id: started.run_id,
      stage: "rubric_gen",
    });
    await t.mutation(internal.domain.runs.run_service.reconcileRunStage, {
      run_id: started.run_id,
      stage: "rubric_critic",
    });

    const summary = await t.query(api.packages.lab.getRunSummary, {
      run_id: started.run_id,
    });
    expect(summary.status).toBe("paused");
    expect(summary.current_stage).toBe("rubric_critic");
    expect(summary.pause_after).toBe("rubric_critic");
    expect(summary.stage_counts).toEqual({
      rubric_gen: 2,
      rubric_critic: 2,
      score_gen: 0,
      score_critic: 0,
    });
  });
});
