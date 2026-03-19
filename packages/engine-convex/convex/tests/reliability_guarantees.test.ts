import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
import { normalizeOpenAiBatchStatus } from "../platform/providers/openai_batch";
import { __findMockBatchByMetadata, __resetMockProviders, __setMockSubmitMode, __submitMockBatch } from "./provider_services_mock";
import { handleQueuedBatchWorkflow, handleRunningBatchWorkflow } from "../domain/orchestrator/process_workflows";
import { handleBatchError } from "../domain/llm_calls/llm_batch_service";
import { markJobRunning, scheduleJobRun } from "../domain/llm_calls/llm_job_service";

type ConvexTestInstance = ReturnType<typeof convexTest>;

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

function initTest(): ConvexTestInstance {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
}

async function setupRunReadyForScoreGen(t: ConvexTestInstance) {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: "gpt-4.1-mini",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "score gen handoff test",
    },
  );

  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id,
    evidences: [
      {
        title: "Evidence 1",
        url: "https://example.com/evidence-1",
        raw_content: "First evidence paragraph about institutions.",
      },
      {
        title: "Evidence 2",
        url: "https://example.com/evidence-2",
        raw_content: "Second evidence paragraph about institutions.",
      },
    ],
  });

  const evidenceRows = await t.run(async (ctx) => ctx.db.query("evidences").collect());
  const pool = await t.mutation(api.packages.lab.createPool, {
    evidence_ids: evidenceRows.map((row) => row._id),
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

  const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
    experiment_id: experiment.experiment_id,
    target_count: 1,
  });

  await t.run(async (ctx) => {
    const sample = (await ctx.db.query("samples").collect())
      .find((row) => row.run_id === run_id);
    if (!sample) throw new Error("sample_not_found");

    const rubricRequestId = await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: "gpt-4.1-mini",
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
      model: "gpt-4.1-mini",
      concept: "fascism",
      scale_size: 4,
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
        model: "gpt-4.1-mini",
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
      model: "gpt-4.1-mini",
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
    await ctx.db.patch(run_id, {
      status: "running",
      current_stage: "rubric_critic",
      rubric_gen_count: 1,
      rubric_critic_count: 1,
    });
  });

  return { run_id };
}

describe("reliability guarantees", () => {
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

  test("normalizes non-completed OpenAI batch states conservatively", () => {
    expect(normalizeOpenAiBatchStatus("validating")).toEqual({ status: "running" });
    expect(normalizeOpenAiBatchStatus("in_progress")).toEqual({ status: "running" });
    expect(normalizeOpenAiBatchStatus("finalizing")).toEqual({ status: "running" });
    expect(normalizeOpenAiBatchStatus("failed")).toEqual({
      status: "error",
      error: "batch_failed",
    });
    expect(normalizeOpenAiBatchStatus("expired")).toEqual({
      status: "error",
      error: "batch_expired",
    });
    expect(normalizeOpenAiBatchStatus("cancelled")).toEqual({
      status: "error",
      error: "batch_cancelled",
    });
    expect(normalizeOpenAiBatchStatus("mystery_state")).toEqual({
      status: "error",
      error: "batch_unknown_status:mystery_state",
    });
  });

  test("scheduler requeues due orphaned requests automatically", async () => {
    vi.useFakeTimers();
    try {
      __resetMockProviders();
      const t = initTest();

      const { window_id } = await t.mutation(
        internal.domain.window.window_repo.createWindow,
        {
          country: "USA",
          model: "gpt-4.1-mini",
          start_date: "2026-03-01",
          end_date: "2026-03-02",
          query: "scheduler orphan request test",
        },
      );

      await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
        window_id,
        evidences: [
          {
            title: "Test evidence",
            url: "https://example.com/test-evidence",
            raw_content: "A short evidence paragraph about policy.",
          },
        ],
      });

      await t.mutation(internal.domain.window.window_service.startWindowOrchestration, {
        window_id,
      });

      const [evidence] = await t.query(
        internal.domain.window.window_repo.listEvidenceByWindow,
        { window_id },
      );
      expect(evidence).not.toBeNull();

      const customKey = `evidence:${evidence!._id}:l1_cleaned`;
      const originalRequest = await t.run(async (ctx) => {
        const requests = await ctx.db.query("llm_requests").collect();
        return requests.find((request) => request.custom_key === customKey) ?? null;
      });
      expect(originalRequest).not.toBeNull();
      expect(originalRequest!.job_id).not.toBeNull();

      await t.mutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: originalRequest!._id,
        patch: {
          job_id: null,
          batch_id: null,
          next_attempt_at: Date.now() - 1,
        },
      });

      const result = await t.mutation(internal.domain.orchestrator.scheduler.runScheduler, {});
      expect(result).toMatchObject({ requeued_orphaned_requests: 1 });

      const repairedRequest = await t.query(
        internal.domain.llm_calls.llm_request_repo.getLlmRequest,
        { request_id: originalRequest!._id },
      );
      expect(repairedRequest.job_id).not.toBeNull();
      expect(repairedRequest.batch_id).toBeNull();

      vi.clearAllTimers();
    } finally {
      vi.useRealTimers();
    }
  });

  test("scheduler auto-recovers retryable requests with no transport", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-12T12:00:00.000Z"));
      __resetMockProviders();
      const t = initTest();

      const { window_id } = await t.mutation(
        internal.domain.window.window_repo.createWindow,
        {
          country: "USA",
          model: "gpt-4.1-mini",
          start_date: "2026-03-01",
          end_date: "2026-03-02",
          query: "scheduler retryable recovery test",
        },
      );

      await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
        window_id,
        evidences: [
          {
            title: "Retryable evidence",
            url: "https://example.com/retryable-evidence",
            raw_content: "A short evidence paragraph about policy.",
          },
        ],
      });

      await t.mutation(internal.domain.window.window_service.startWindowOrchestration, {
        window_id,
      });

      const [evidence] = await t.query(
        internal.domain.window.window_repo.listEvidenceByWindow,
        { window_id },
      );
      expect(evidence).not.toBeNull();

      const customKey = `evidence:${evidence!._id}:l1_cleaned`;
      const originalRequest = await t.run(async (ctx) => {
        const requests = await ctx.db.query("llm_requests").collect();
        return requests.find((request) => request.custom_key === customKey) ?? null;
      });
      expect(originalRequest).not.toBeNull();
      expect(originalRequest!.job_id).not.toBeNull();

      await t.mutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: originalRequest!._id,
        patch: {
          status: "error",
          last_error: "Your request couldn't be completed. Try again later.",
          job_id: null,
          batch_id: null,
          next_attempt_at: Date.now() - 1,
        },
      });

      await t.mutation(internal.domain.llm_calls.llm_job_repo.patchJob, {
        job_id: originalRequest!.job_id!,
        patch: {
          status: "error",
          next_run_at: undefined,
          run_claim_owner: null,
          run_claim_expires_at: null,
        },
      });

      vi.advanceTimersByTime(5);

      const stuck = await t.query(api.packages.codex.getStuckWork, {
        process_type: "window",
        older_than_ms: 1,
        limit: 20,
      });
      expect(stuck.items.some((item: { reason: string }) => item.reason === "retryable_no_transport")).toBe(true);

      const result = await t.mutation(internal.domain.orchestrator.scheduler.runScheduler, {});
      expect(result).toMatchObject({ recovered_retryable_requests: 1 });

      const targetState = await t.run(async (ctx) => {
        const rows = await ctx.db.query("process_request_targets").collect();
        return rows.find((row) => row.custom_key === customKey) ?? null;
      });
      expect(targetState?.resolution).toBe("pending");
      expect(targetState?.active_request_id).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("startScheduler debounces repeated kickoff requests", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
      const t = initTest();

      await t.mutation(internal.domain.orchestrator.scheduler.startScheduler, {});
      await t.mutation(internal.domain.orchestrator.scheduler.startScheduler, {});

      const locks = await t.run(async (ctx) => {
        const rows = await ctx.db.query("scheduler_locks").collect();
        return rows.filter((row) => row.lock_key === "scheduler_lock");
      });

      expect(locks).toHaveLength(1);
      expect(locks[0]?.status).toBe("idle");
      expect(locks[0]?.heartbeat_ts_ms).toBe(Date.parse("2026-03-09T12:00:00.000Z"));
    } finally {
      vi.useRealTimers();
    }
  });

  test("retry batch creation wakes the scheduler", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-15T21:45:00.000Z"));
      const t = initTest();

      const requestId = await t.mutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: "gpt-4.1",
          user_prompt: "Retry me.",
          custom_key: "sample_score_target:target_1:score_gen",
          attempt_index: 1,
        },
      );

      const batchId = await t.mutation(
        internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
        {
          provider: "openai",
          model: "gpt-4.1",
          custom_key: "run:test_run:score_gen",
          attempt_index: 1,
        },
      );

      await t.mutation(
        internal.domain.llm_calls.llm_batch_repo.assignRequestsToBatch,
        {
          request_ids: [requestId],
          batch_id: batchId,
        },
      );

      const { batch, requests } = await t.query(
        internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
        { batch_id: batchId },
      );

      await handleBatchError({
        ctx: {
          runMutation: t.mutation,
        } as never,
        batch,
        requests,
        error: "retryable:timeout:Your request timed out.",
      });

      const lockRows = await t.run(async (ctx) =>
        ctx.db.query("scheduler_locks").collect(),
      );
      expect(lockRows.some((row) => row.lock_key === "scheduler_lock")).toBe(true);

      const batches = await t.run(async (ctx) =>
        ctx.db.query("llm_batches").collect(),
      );
      expect(batches.some((row) => row._id !== batchId && row.status === "queued" && row.attempt_index === 2)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("queued-only backlog without scheduler is reported as stuck", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-15T21:50:00.000Z"));
      const t = initTest();

      await t.mutation(
        internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
        {
          provider: "openai",
          model: "gpt-4.1",
          custom_key: "run:test_run:score_gen",
          attempt_index: 1,
        },
      );

      const stuck = await t.query(api.packages.codex.getStuckWork, {
        process_type: "run",
        older_than_ms: 1,
        limit: 20,
      });

      expect(stuck.items.some((item: { reason: string }) => item.reason === "scheduler_not_running")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("job reschedule creates a new attempt row", async () => {
    const t = initTest();

    const job_id = await t.mutation(
      internal.domain.llm_calls.llm_job_repo.createLlmJob,
      {
        provider: "openai",
        model: "gpt-4.1-mini",
        custom_key: "run:test:rubric_gen",
      },
    );

    await markJobRunning({
      ctx: {
        runMutation: t.mutation,
        runQuery: t.query,
      } as never,
      job_id,
    });
    const jobAfterFirstRun = await t.run(async (ctx) => ctx.db.get(job_id));
    expect(jobAfterFirstRun?.attempt_index).toBe(1);

    await scheduleJobRun({
      ctx: {
        runMutation: t.mutation,
        runQuery: t.query,
      } as never,
      job_id,
      now: Date.now(),
      anyErrors: false,
    });
    const jobs = await t.run(async (ctx) => ctx.db.query("llm_jobs").collect());
    const matchingJobs = jobs.filter((job) => job.custom_key === "run:test:rubric_gen");
    expect(matchingJobs).toHaveLength(2);
    const originalJob = matchingJobs.find((job) => job._id === job_id);
    const retryJob = matchingJobs.find((job) => job._id !== job_id);
    expect(originalJob?.attempt_index).toBe(1);
    expect(originalJob?.status).toBe("success");
    expect(retryJob?.attempt_index).toBe(2);
    expect(retryJob?.status).toBe("running");
  });

  test("enqueueRunStage chunks score generation fanout and schedules continuation", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-16T05:40:00.000Z"));
      const t = initTest();
      const { run_id } = await setupRunReadyForScoreGen(t);
      await t.run(async (ctx) => {
        await ctx.db.patch(run_id, {
          current_stage: "score_gen",
          rubric_critic_count: 1,
        });
      });

      const firstChunk = await t.mutation(
        internal.domain.runs.run_service.enqueueRunStage,
        {
          run_id,
          stage: "score_gen",
          reason: "test_chunking",
          max_requests: 1,
          start_scheduler: false,
        },
      );

      expect(firstChunk.outcome).toBe("enqueued");
      expect(firstChunk.enqueued_requests).toBe(1);
      expect(firstChunk.has_more).toBe(true);
      expect(firstChunk.route).toBe("job");

      const initialScoreRequests = await t.run(async (ctx) => {
        return (await ctx.db.query("llm_requests").collect())
          .filter((request) => request.custom_key.endsWith(":score_gen")).length;
      });
      expect(initialScoreRequests).toBe(1);

      await t.finishAllScheduledFunctions(() => {
        vi.runAllTimers();
      });

      const finalScoreRequests = await t.run(async (ctx) => {
        return (await ctx.db.query("llm_requests").collect())
          .filter((request) => request.custom_key.endsWith(":score_gen")).length;
      });
      expect(finalScoreRequests).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("getStuckWork flags completed-stage handoff stalls with no transport", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-16T05:45:00.000Z"));
      const t = initTest();
      const { run_id } = await setupRunReadyForScoreGen(t);

      vi.advanceTimersByTime(5);

      const stuck = await t.query(api.packages.codex.getStuckWork, {
        process_type: "run",
        older_than_ms: 1,
        limit: 20,
      });

      expect(stuck.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            process_id: String(run_id),
            reason: "stage_transition_no_transport",
          }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test("repairRunStageTransport reattaches pending stage work pinned to an error batch", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-16T22:15:00.000Z"));
      const t = initTest();
      const { run_id } = await setupRunReadyForScoreGen(t);

      const { requestId, batchId } = await t.run(async (ctx) => {
        const scoreTargets = (await ctx.db.query("sample_score_targets").collect())
          .filter((row) => row.run_id === run_id);
        const scoreTarget = scoreTargets[0];
        if (!scoreTarget) {
          throw new Error("score_target_not_found");
        }

        const requestId = await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.createLlmRequest,
          {
            model: "gpt-4.1-mini",
            user_prompt: "score critic request",
            custom_key: `sample_score_target:${scoreTarget._id}:score_critic`,
            attempt_index: 1,
          },
        );
        const batchId = await ctx.runMutation(
          internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
          {
            provider: "openai",
            model: "gpt-4.1-mini",
            custom_key: `run:${run_id}:score_critic`,
            attempt_index: 1,
          },
        );
        await ctx.runMutation(
          internal.domain.llm_calls.llm_batch_repo.assignRequestsToBatch,
          {
            request_ids: [requestId],
            batch_id: batchId,
          },
        );
        await ctx.runMutation(
          internal.domain.llm_calls.llm_batch_repo.patchBatch,
          {
            batch_id: batchId,
            patch: {
              status: "error",
              last_error: "batch_failed",
            },
          },
        );
        await ctx.db.patch(run_id, {
          status: "running",
          current_stage: "score_critic",
          score_gen_count: 1,
          score_critic_count: 0,
        });

        return { requestId, batchId };
      });

      vi.advanceTimersByTime(5);

      const stuck = await t.query(api.packages.codex.getStuckWork, {
        process_type: "run",
        older_than_ms: 1,
        limit: 20,
      });
      expect(stuck.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            process_id: String(run_id),
            reason: "pending_requests_on_dead_transport",
          }),
        ]),
      );

      const healPlan = await t.mutation(api.packages.codex.autoHealProcess, {
        process_type: "run",
        process_id: String(run_id),
        dry_run: true,
        older_than_ms: 1,
        max_actions: 20,
      });
      expect(healPlan.planned_actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "repair_stage_transport",
            process_type: "run",
            process_id: String(run_id),
            stage: "score_critic",
          }),
        ]),
      );

      const dryRepair = await t.mutation(api.packages.codex.repairRunStageTransport, {
        run_id,
        dry_run: true,
        start_scheduler: false,
      });
      expect(dryRepair).toMatchObject({
        outcome: "repaired",
        repaired_request_count: 1,
        pending_request_count: 1,
        detached_batch_ids: [String(batchId)],
      });

      const liveRepair = await t.mutation(api.packages.codex.repairRunStageTransport, {
        run_id,
        dry_run: false,
        start_scheduler: false,
      });
      expect(liveRepair).toMatchObject({
        outcome: "repaired",
        repaired_request_count: 1,
        pending_request_count: 1,
        detached_batch_ids: [String(batchId)],
        scheduler_started: false,
      });

      const repairedRequest = await t.query(
        internal.domain.llm_calls.llm_request_repo.getLlmRequest,
        { request_id: requestId },
      );
      expect(repairedRequest._id).toEqual(requestId);
      expect(repairedRequest.batch_id).toBeNull();
      expect(repairedRequest.job_id).not.toBeNull();

      const queuedJob = await t.run(async (ctx) => {
        return repairedRequest.job_id ? ctx.db.get(repairedRequest.job_id) : null;
      });
      expect(queuedJob?.status).toBe("queued");

      const scoreCriticRequests = await t.run(async (ctx) => {
        return (await ctx.db.query("llm_requests").collect())
          .filter((request) => request.custom_key.endsWith(":score_critic"));
      });
      expect(scoreCriticRequests).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });


  test("recovers submitting batches after unknown submit outcome", async () => {
    __resetMockProviders();
    const t = initTest();
    const step = {
      runQuery: t.query,
      runMutation: t.mutation,
      runAction: async (_ref: unknown, args: Record<string, unknown>) => {
        if ("requests" in args && "metadata" in args) {
          return __submitMockBatch(
            args.requests as never,
            args.metadata as { engine_batch_id: string; engine_submission_id: string },
          );
        }
        if ("metadata" in args) {
          return __findMockBatchByMetadata(
            args.metadata as { engine_batch_id: string; engine_submission_id: string },
          );
        }
        throw new Error("unsupported_mock_action");
      },
    };

    const { window_id } = await t.mutation(
      internal.domain.window.window_repo.createWindow,
      {
        country: "USA",
        model: "gpt-4.1-mini",
        start_date: "2026-03-01",
        end_date: "2026-03-02",
        query: "batch submit recovery test",
      },
    );

    await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_id,
      evidences: [
        {
          title: "Batch recovery evidence",
          url: "https://example.com/batch-recovery",
          raw_content: "A short evidence paragraph about reliability.",
        },
      ],
    });

    const [evidence] = await t.query(
      internal.domain.window.window_repo.listEvidenceByWindow,
      { window_id },
    );
    expect(evidence).not.toBeNull();

    const request_id = await t.mutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: "gpt-4.1-mini",
        user_prompt: "Clean this evidence.",
        custom_key: `evidence:${evidence!._id}:l1_cleaned`,
      },
    );

    const batch_id = await t.mutation(
      internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
      {
        provider: "openai",
        model: "gpt-4.1-mini",
        custom_key: `window:${window_id}:l1_cleaned`,
      },
    );

    await t.mutation(internal.domain.llm_calls.llm_batch_repo.assignRequestsToBatch, {
      request_ids: [request_id],
      batch_id,
    });

    __setMockSubmitMode("unknown_outcome");
    await expect(
      handleQueuedBatchWorkflow(step as never, { batch_id }),
    ).rejects.toThrow("mock_submit_unknown_outcome");

    const submittingBatch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(submittingBatch.batch.status).toBe("submitting");
    expect(submittingBatch.batch.batch_ref ?? null).toBeNull();
    expect(submittingBatch.batch.submission_id).toBeTruthy();

    __setMockSubmitMode("success");

    await handleRunningBatchWorkflow(step as never, { batch_id });

    const recoveredBatch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(recoveredBatch.batch.status).toBe("running");
    expect(recoveredBatch.batch.batch_ref).toBeTruthy();
    expect(recoveredBatch.batch.input_file_id).toBeTruthy();
    expect(recoveredBatch.batch.submission_id).toBe(submittingBatch.batch.submission_id);
  });

  test("finds superseding successful batch for a stale submitting sibling", async () => {
    const t = initTest();

    const staleBatchId = await t.mutation(
      internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
      {
        provider: "openai",
        model: "gpt-4.1-mini",
        custom_key: "run:test:score_gen",
      },
    );

    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id: staleBatchId,
      patch: {
        status: "submitting",
        submission_id: "sub_stale",
      },
    });

    const liveBatchId = await t.mutation(
      internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
      {
        provider: "openai",
        model: "gpt-4.1-mini",
        custom_key: "run:test:score_gen",
      },
    );

    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id: liveBatchId,
      patch: {
        status: "success",
        batch_ref: "batch_live",
      },
    });

    const superseding = await t.query(
      internal.domain.llm_calls.llm_batch_repo.findSupersedingBatch,
      {
        batch_id: staleBatchId,
        custom_key: "run:test:score_gen",
      },
    );

    expect(superseding).not.toBeNull();
    expect(superseding?.batch_id).toBe(liveBatchId);
    expect(superseding?.status).toBe("success");
    expect(superseding?.batch_ref).toBe("batch_live");
  });

  test("deduplicates identical system prompts into one template row", async () => {
    const t = initTest();

    const { window_id } = await t.mutation(
      internal.domain.window.window_repo.createWindow,
      {
        country: "USA",
        model: "gpt-4.1-mini",
        start_date: "2026-03-01",
        end_date: "2026-03-02",
        query: "prompt template dedupe test",
      },
    );

    await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_id,
      evidences: [
        {
          title: "Prompt template evidence A",
          url: "https://example.com/prompt-template-a",
          raw_content: "Evidence A.",
        },
        {
          title: "Prompt template evidence B",
          url: "https://example.com/prompt-template-b",
          raw_content: "Evidence B.",
        },
      ],
    });

    const evidences = await t.query(
      internal.domain.window.window_repo.listEvidenceByWindow,
      { window_id },
    );
    expect(evidences).toHaveLength(2);

    const systemPrompt = "Shared system prompt body";
    const requestA = await t.mutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: "gpt-4.1-mini",
        system_prompt: systemPrompt,
        user_prompt: "User prompt A",
        custom_key: `evidence:${evidences[0]!._id}:l1_cleaned`,
      },
    );
    const requestB = await t.mutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: "gpt-4.1-mini",
        system_prompt: systemPrompt,
        user_prompt: "User prompt B",
        custom_key: `evidence:${evidences[1]!._id}:l1_cleaned`,
      },
    );

    const [storedA, storedB, templates] = await Promise.all([
      t.query(internal.domain.llm_calls.llm_request_repo.getLlmRequest, {
        request_id: requestA,
      }),
      t.query(internal.domain.llm_calls.llm_request_repo.getLlmRequest, {
        request_id: requestB,
      }),
      t.run(async (ctx) => ctx.db.query("llm_prompt_templates").collect()),
    ]);

    expect(storedA.system_prompt_id).toBeTruthy();
    expect(storedA.system_prompt_id).toBe(storedB.system_prompt_id);
    expect(templates).toHaveLength(1);
    expect(templates[0]?.content).toBe(systemPrompt);
  });

});
