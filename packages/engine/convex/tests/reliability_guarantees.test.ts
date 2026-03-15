import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
import { normalizeOpenAiBatchStatus } from "../platform/providers/openai_batch";
import { __findMockBatchByMetadata, __resetMockProviders, __setMockSubmitMode, __submitMockBatch } from "./provider_services_mock";
import { handleQueuedBatchWorkflow, handleRunningBatchWorkflow } from "../domain/orchestrator/process_workflows";
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

describe("reliability guarantees", () => {
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
