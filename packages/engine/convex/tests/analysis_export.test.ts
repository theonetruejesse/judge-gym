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

async function setupCompletedRun(t: ConvexTestInstance) {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: "gpt-4.1-mini",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "analysis export test",
    },
  );

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id,
    evidences: [
      {
        title: "Evidence A",
        url: "https://example.com/a",
        raw_content: "Evidence A raw text",
      },
      {
        title: "Evidence B",
        url: "https://example.com/b",
        raw_content: "Evidence B raw text",
      },
    ],
  });

  const evidenceRows = await t.query(api.packages.lab.listEvidenceByWindow, {
    window_id,
  });
  const pool = await t.mutation(api.packages.lab.createPool, {
    pool_tag: "analysis-export-pool",
    evidence_ids: evidenceRows.map((row: { evidence_id: Id<"evidences"> }) => row.evidence_id),
  });
  const experiment = await t.mutation(api.packages.lab.initExperiment, {
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
        evidence_view: "l0_raw",
        randomizations: ["shuffle_rubric_order"],
        evidence_bundle_size: 2,
      },
    },
    pool_id: pool.pool_id,
  });

  const run_id = await t.mutation(
    internal.domain.runs.run_repo.createRun,
    {
      experiment_id: experiment.experiment_id,
      target_count: 2,
    },
  );

  await t.run(async (ctx) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("run_not_found");
    const exp = await ctx.db.get(run.experiment_id);
    if (!exp) throw new Error("experiment_not_found");

    const samples = (await ctx.db
      .query("samples")
      .collect())
      .filter((sample) => sample.run_id === run_id)
      .sort((a, b) => a._creationTime - b._creationTime);
    const scoreTargets = (await ctx.db
      .query("sample_score_targets")
      .collect())
      .filter((target) => target.run_id === run_id)
      .sort((a, b) => a._creationTime - b._creationTime);

    for (const [index, sample] of samples.entries()) {
      const rubricRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: exp.rubric_config.model,
          user_prompt: `rubric request ${index}`,
          custom_key: `sample:${sample._id}:rubric_gen`,
          attempt_index: 1,
        },
      );
      const rubricId = await ctx.db.insert("rubrics", {
        run_id,
        sample_id: sample._id,
        model: exp.rubric_config.model,
        concept: exp.rubric_config.concept,
        scale_size: exp.rubric_config.scale_size,
        llm_request_id: rubricRequestId,
        justification: `rubric justification ${index}`,
        stages: [
          { stage_number: 1, label: "Weak", criteria: ["a", "b", "c"] },
          { stage_number: 2, label: "Moderate", criteria: ["a", "b", "c"] },
          { stage_number: 3, label: "Strong", criteria: ["a", "b", "c"] },
          { stage_number: 4, label: "Extreme", criteria: ["a", "b", "c"] },
        ],
        label_mapping: { A: 1, B: 2, C: 3, D: 4 },
      });

      const rubricCriticRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: exp.rubric_config.model,
          user_prompt: `rubric critic request ${index}`,
          custom_key: `sample:${sample._id}:rubric_critic`,
          attempt_index: 1,
        },
      );
      const rubricCriticId = await ctx.db.insert("rubric_critics", {
        run_id,
        sample_id: sample._id,
        model: exp.rubric_config.model,
        llm_request_id: rubricCriticRequestId,
        justification: `rubric critic justification ${index}`,
        expert_agreement_prob: {
          observability_score: 0.9 - (index * 0.1),
          discriminability_score: 0.8 - (index * 0.1),
        },
      });

      await ctx.db.patch(sample._id, {
        rubric_id: rubricId,
        rubric_critic_id: rubricCriticId,
        score_count: 1,
        score_critic_count: 1,
      });
    }

    for (const [index, target] of scoreTargets.entries()) {
      const scoreRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: exp.scoring_config.model,
          user_prompt: `score request ${index}`,
          custom_key: `sample_score_target:${target._id}:score_gen`,
          attempt_index: 1,
        },
      );
      const scoreId = await ctx.db.insert("scores", {
        run_id,
        sample_id: target.sample_id,
        score_target_id: target._id,
        model: exp.scoring_config.model,
        llm_request_id: scoreRequestId,
        justification: `score justification ${index}`,
        decoded_scores: index === 0 ? [2, 4] : [],
      });

      const scoreCriticRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: exp.scoring_config.model,
          user_prompt: `score critic request ${index}`,
          custom_key: `sample_score_target:${target._id}:score_critic`,
          attempt_index: 1,
        },
      );
      const scoreCriticId = await ctx.db.insert("score_critics", {
        run_id,
        sample_id: target.sample_id,
        score_target_id: target._id,
        model: exp.scoring_config.model,
        llm_request_id: scoreCriticRequestId,
        justification: `score critic justification ${index}`,
        expert_agreement_prob: 0.7 + (index * 0.1),
      });

      await ctx.db.patch(target._id, {
        score_id: scoreId,
        score_critic_id: scoreCriticId,
      });
    }

    await ctx.db.patch(run_id, {
      status: "completed",
      completed_count: samples.length,
      current_stage: "score_critic",
      rubric_gen_count: samples.length,
      rubric_critic_count: samples.length,
      score_gen_count: scoreTargets.length,
      score_critic_count: scoreTargets.length,
    });
  });

  const experimentRow = await t.run(async (ctx) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("run_not_found");
    const experimentDoc = await ctx.db.get(run.experiment_id);
    if (!experimentDoc) throw new Error("experiment_not_found");
    return experimentDoc;
  });

  return {
    experiment_id: experiment.experiment_id as Id<"experiments">,
    experiment_tag: experimentRow.experiment_tag,
    run_id,
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

describe("analysis export package", () => {
  test("returns normalized experiment summaries and manifest", async () => {
    const t = initTest();
    const setup = await setupCompletedRun(t);

    const experiments = await t.query(
      api.packages.analysis.listAnalysisExperiments,
      {},
    );

    expect(experiments).toHaveLength(1);
    expect(experiments[0]?.experiment_tag).toBe(setup.experiment_tag);
    expect(experiments[0]?.latest_completed_run_id).toBe(setup.run_id);
    expect(experiments[0]?.completed_run_count).toBe(1);
    expect(experiments[0]?.model_id).toBe("gpt-4.1-mini");
    expect(experiments[0]?.evidence_bundle_size).toBe(2);

    const manifest = await t.query(
      api.packages.analysis.getAnalysisManifest,
      { experiment_tag: setup.experiment_tag },
    );

    expect(manifest.export_schema_version).toBe(1);
    expect(manifest.run.run_id).toBe(setup.run_id);
    expect(manifest.counts.responses).toBe(2);
    expect(manifest.counts.rubrics).toBe(2);
    expect(manifest.counts.evidence).toBe(2);
    expect(manifest.counts.samples).toBe(2);
    expect(manifest.experiment.scale_size).toBe(4);
    expect(manifest.experiment.randomizations).toEqual(["shuffle_rubric_order"]);
  });

  test("exports response, rubric, evidence, and sample rows with analysis-ready fields", async () => {
    const t = initTest();
    const setup = await setupCompletedRun(t);

    const responses = await t.query(
      api.packages.analysis.listAnalysisResponses,
      {
        run_id: setup.run_id,
        pagination: { limit: 1 },
      },
    );

    expect(responses.total_count).toBe(2);
    expect(responses.is_done).toBe(false);
    expect(responses.continue_cursor).toBe("1");
    expect(responses.page[0]?.evidence_labels).toEqual(["E1", "E2"]);
    expect(responses.page[0]?.decoded_scores).toEqual([2, 4]);
    expect(responses.page[0]?.abstained).toBe(false);

    const secondResponses = await t.query(
      api.packages.analysis.listAnalysisResponses,
      {
        run_id: setup.run_id,
        pagination: { limit: 2, cursor: responses.continue_cursor },
      },
    );
    expect(secondResponses.page[0]?.decoded_scores).toEqual([]);
    expect(secondResponses.page[0]?.abstained).toBe(true);
    expect(secondResponses.page[0]?.score_expert_agreement_prob).toBeCloseTo(0.8);

    const rubrics = await t.query(
      api.packages.analysis.listAnalysisRubrics,
      { run_id: setup.run_id },
    );
    expect(rubrics.total_count).toBe(2);
    expect(rubrics.page[0]?.observability_score).toBe(0.9);
    expect(rubrics.page[0]?.stages).toHaveLength(4);

    const evidences = await t.query(
      api.packages.analysis.listAnalysisEvidence,
      { run_id: setup.run_id },
    );
    expect(evidences.total_count).toBe(2);
    expect(evidences.page.map((row: { label: string }) => row.label)).toEqual(["E1", "E2"]);

    const samples = await t.query(
      api.packages.analysis.listAnalysisSamples,
      { run_id: setup.run_id },
    );
    expect(samples.total_count).toBe(2);
    expect(samples.page[0]?.sample_ordinal).toBe(1);
    expect(samples.page[0]?.score_target_total).toBe(1);
  });

  test("rejects manifest export for non-completed runs", async () => {
    const t = initTest();
    const { experiment_id } = await setupCompletedRun(t);
    const runningRunId = await t.mutation(
      internal.domain.runs.run_repo.createRun,
      {
        experiment_id,
        target_count: 1,
      },
    );

    await expect(
      t.query(api.packages.analysis.getAnalysisManifest, {
        run_id: runningRunId,
      }),
    ).rejects.toThrow("completed run");
  });
});
