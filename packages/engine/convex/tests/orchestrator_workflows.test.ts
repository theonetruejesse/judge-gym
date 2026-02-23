import { beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { ENGINE_SETTINGS } from "../settings";
import {
  applyBatchResults,
  handleBatchError,
} from "../domain/llm_calls/llm_batch_service";
import { runJobRequests } from "../domain/llm_calls/llm_job_service";
import {
  handleQueuedBatchWorkflow,
  handleQueuedJobWorkflow,
  handleRunningBatchWorkflow,
  handleRunningJobWorkflow,
  processWorkflow,
} from "../domain/orchestrator/process_workflows";
import type { ModelType } from "../platform/providers/provider_types";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
import { RATE_LIMIT_CONFIGS } from "../platform/rate_limiter";
import { getRateLimitKeysForModel } from "../platform/rate_limiter";
import { rateLimiter } from "../platform/rate_limiter";
import {
  __resetMockProviders,
  __setMockBatchMode,
  __setMockChatMode,
} from "./provider_services_mock";

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

const initTest = () => {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
};

type EvidenceDoc = Doc<"evidences">;
type RequestDoc = Doc<"llm_requests">;

beforeEach(() => {
  __resetMockProviders();
});

function uniqueLabel(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function buildWindowInput(query: string, model: ModelType) {
  return {
    start_date: "2026-01-01",
    end_date: "2026-01-02",
    country: "USA",
    query,
    model,
  };
}

function buildEvidenceBatch(count: number, label: string) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Evidence ${index + 1} (${label})`,
    url: `https://example.com/${label}/${index + 1}`,
    raw_content: `Raw content ${index + 1} for ${label}.`,
  }));
}

async function createWindowWithEvidence(
  t: ReturnType<typeof convexTest>,
  model: ModelType,
  count: number,
  label: string,
) {
  const window_id = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    buildWindowInput(label, model),
  );
  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id,
    evidences: buildEvidenceBatch(count, label),
  });
  return window_id;
}

async function listEvidence(
  t: ReturnType<typeof convexTest>,
  window_id: Id<"windows">,
) {
  return (await t.query(
    internal.domain.window.window_repo.listEvidenceByWindow,
    { window_id },
  )) as EvidenceDoc[];
}

async function startWindowOrchestration(
  t: ReturnType<typeof convexTest>,
  window_id: Id<"windows">,
) {
  await t.mutation(
    internal.domain.window.window_service.startWindowOrchestration,
    { window_id },
  );
}

async function getRequests(
  t: ReturnType<typeof convexTest>,
  requestIds: Array<Id<"llm_requests"> | null>,
) {
  const ids = requestIds.filter(Boolean) as Id<"llm_requests">[];
  const requests = await Promise.all(
    ids.map((request_id) =>
      t.query(internal.domain.llm_calls.llm_request_repo.getLlmRequest, {
        request_id,
      }),
    ),
  );
  return requests as RequestDoc[];
}

function jobCountForPolicy() {
  const policy = ENGINE_SETTINGS.run_policy;
  if (policy.job_fallback_count > 0) return policy.job_fallback_count;
  return Math.max(1, policy.min_batch_size - 1);
}

function batchCountForPolicy() {
  const policy = ENGINE_SETTINGS.run_policy;
  return Math.max(policy.min_batch_size, policy.job_fallback_count + 1);
}

function rateLimitCapacity(key: string): number {
  const config = RATE_LIMIT_CONFIGS[key];
  if (!config) return 1;
  const capacity = config.capacity ?? config.rate ?? 1;
  return Math.ceil(capacity);
}

async function exhaustRateLimit(
  t: ReturnType<typeof convexTest>,
  key: string,
) {
  const count = rateLimitCapacity(key) + 100;
  await rateLimiter.limit(
    { runMutation: t.mutation, runQuery: t.query },
    key,
    { count, reserve: true },
  );
}

function buildJobCtx(
  t: ReturnType<typeof convexTest>,
  handler: (args: { model: ModelType }) => Promise<{
    assistant_output: string;
    input_tokens?: number;
    output_tokens?: number;
  }>,
) {
  return {
    runAction: async (_ref: unknown, args: { model: ModelType }) => handler(args),
    runMutation: t.mutation,
    runQuery: t.query,
  } as Parameters<typeof runJobRequests>[0]["ctx"];
}

function buildWorkflowStep(t: ReturnType<typeof convexTest>) {
  return {
    runAction: t.action,
    runMutation: t.mutation,
    runQuery: t.query,
  };
}

describe("scheduler decision tree", () => {
  test("startScheduler is idempotent", async () => {
    vi.useFakeTimers();
    const t = initTest();
    await t.mutation(internal.domain.orchestrator.scheduler.startScheduler, {});
    await t.mutation(internal.domain.orchestrator.scheduler.startScheduler, {});

    const scheduled = await t.run(async (ctx) => {
      return ctx.db.system.query("_scheduled_functions").collect();
    });

    const pendingRuns = scheduled.filter(
      (row) =>
        (row.name === "domain/orchestrator/scheduler:runScheduler" ||
          row.name === "domain/orchestrator/scheduler.js:runScheduler") &&
        row.completedTime == null,
    );

    expect(pendingRuns.length).toBe(1);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("runScheduler starts due workflows only", async () => {
    vi.useFakeTimers();
    const t = initTest();
    const now = Date.now();

    const queuedJob = await t.mutation(
      internal.domain.llm_calls.llm_job_repo.createLlmJob,
      {
        provider: "openai",
        model: "gpt-4.1",
        custom_key: "job:queued",
      },
    );

    const runningJob = await t.mutation(
      internal.domain.llm_calls.llm_job_repo.createLlmJob,
      {
        provider: "openai",
        model: "gpt-4.1",
        custom_key: "job:running",
      },
    );
    await t.mutation(internal.domain.llm_calls.llm_job_repo.patchJob, {
      job_id: runningJob,
      patch: { status: "running", next_run_at: now - 1000 },
    });

    const futureJob = await t.mutation(
      internal.domain.llm_calls.llm_job_repo.createLlmJob,
      {
        provider: "openai",
        model: "gpt-4.1",
        custom_key: "job:future",
      },
    );
    await t.mutation(internal.domain.llm_calls.llm_job_repo.patchJob, {
      job_id: futureJob,
      patch: { status: "running", next_run_at: now + 60000 },
    });

    const queuedBatch = await t.mutation(
      internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
      {
        provider: "openai",
        model: "gpt-4.1",
        custom_key: "batch:queued",
      },
    );

    const runningBatch = await t.mutation(
      internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
      {
        provider: "openai",
        model: "gpt-4.1",
        custom_key: "batch:running",
      },
    );
    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id: runningBatch,
      patch: { status: "running", next_poll_at: now - 1000, batch_ref: "ref" },
    });

    const futureBatch = await t.mutation(
      internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
      {
        provider: "openai",
        model: "gpt-4.1",
        custom_key: "batch:future",
      },
    );
    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id: futureBatch,
      patch: { status: "running", next_poll_at: now + 60000, batch_ref: "ref" },
    });

    const workflow = processWorkflow as unknown as {
      start: (...args: any[]) => Promise<unknown>;
    };
    const originalStart = workflow.start;
    const started: Array<{ ref: unknown; args: any; opts: any }> = [];

    workflow.start = async (_ctx, ref, args, opts) => {
      started.push({ ref, args, opts });
      return null;
    };

    try {
      await t.mutation(internal.domain.orchestrator.scheduler.runScheduler, {});
    } finally {
      workflow.start = originalStart;
    }

    const jobStarts = started
      .map((call) => call.args?.job_id)
      .filter(Boolean) as Id<"llm_jobs">[];
    const batchStarts = started
      .map((call) => call.args?.batch_id)
      .filter(Boolean) as Id<"llm_batches">[];

    expect(jobStarts).toContain(queuedJob);
    expect(jobStarts).toContain(runningJob);
    expect(batchStarts).toContain(queuedBatch);
    expect(batchStarts).toContain(runningBatch);

    expect(jobStarts).not.toContain(futureJob);
    expect(batchStarts).not.toContain(futureBatch);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("runScheduler reports orphaned requests", async () => {
    vi.useFakeTimers();
    const t = initTest();

    await t.mutation(internal.domain.llm_calls.llm_request_repo.createLlmRequest, {
      model: "gpt-4.1",
      system_prompt: "system",
      user_prompt: "user",
      custom_key: "evidence:orphan:l1_cleaned",
    });

    const workflow = processWorkflow as unknown as {
      start: (...args: any[]) => Promise<unknown>;
    };
    const originalStart = workflow.start;
    workflow.start = async () => null;

    try {
      const result = await t.mutation(
        internal.domain.orchestrator.scheduler.runScheduler,
        {},
      );
      expect(result?.orphaned_requests).toBe(1);
    } finally {
      workflow.start = originalStart;
    }

    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

describe("workflow execution", () => {
  test("processQueuedJobWorkflow completes when requests succeed", async () => {
    const t = initTest();
    __setMockChatMode("success");

    const model: ModelType = "gpt-4.1";
    const count = jobCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("queued_job_success"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );
    const job_id = requests[0].job_id as Id<"llm_jobs">;

    await handleQueuedJobWorkflow(buildWorkflowStep(t), { job_id });

    const job = await t.query(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id },
    );
    expect(job.job.status).toBe("success");

    const updated = await getRequests(
      t,
      requests.map((req) => req._id),
    );
    updated.forEach((req) => {
      expect(req.status).toBe("success");
    });
  });

  test("processQueuedJobWorkflow schedules retry when rate limited", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = jobCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("queued_job_rate_limit"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );
    const job_id = requests[0].job_id as Id<"llm_jobs">;

    const keys = getRateLimitKeysForModel(model, "job");
    if (!keys) throw new Error("Expected rate limit keys for model");
    await exhaustRateLimit(t, keys.requestsKey);

    await handleQueuedJobWorkflow(buildWorkflowStep(t), { job_id });

    const job = await t.query(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id },
    );
    expect(job.job.status).toBe("running");
    expect(job.job.next_run_at).toBeDefined();

    const updated = await getRequests(
      t,
      requests.map((req) => req._id),
    );
    updated.forEach((req) => {
      expect(req.status).toBe("pending");
      expect(req.next_attempt_at).toBeDefined();
    });
  });

  test("processRunningJobWorkflow skips when next_run_at is future", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = jobCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("running_job_skip"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );
    const job_id = requests[0].job_id as Id<"llm_jobs">;

    await t.mutation(internal.domain.llm_calls.llm_job_repo.patchJob, {
      job_id,
      patch: {
        status: "running",
        next_run_at: Date.now() + 60_000,
      },
    });

    await handleRunningJobWorkflow(buildWorkflowStep(t), { job_id });

    const job = await t.query(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id },
    );
    expect(job.job.status).toBe("running");
  });

  test("processQueuedBatchWorkflow marks empty batches", async () => {
    const t = initTest();
    const batch_id = await t.mutation(
      internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
      {
        provider: "openai",
        model: "gpt-4.1",
        custom_key: "batch:empty",
      },
    );

    await handleQueuedBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const batch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(batch.batch.status).toBe("error");
    expect(batch.batch.last_error).toBe("empty_batch");
  });

  test("processQueuedBatchWorkflow defers when rate limited", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("queued_batch_rate_limit"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );
    const batch_id = requests[0].batch_id as Id<"llm_batches">;

    const keys = getRateLimitKeysForModel(model, "batch");
    if (!keys) throw new Error("Expected batch rate limit keys");
    await exhaustRateLimit(t, keys.requestsKey);

    await handleQueuedBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const batch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(batch.batch.status).toBe("queued");
    expect(batch.batch.next_poll_at).toBeDefined();
  });

  test("processQueuedBatchWorkflow submits and marks running", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("queued_batch_submit"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );
    const batch_id = requests[0].batch_id as Id<"llm_batches">;

    await handleQueuedBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const batch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(batch.batch.status).toBe("running");
    expect(batch.batch.batch_ref).toBeDefined();
  });

  test("processRunningBatchWorkflow reschedules when provider running", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("running_batch_reschedule"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );
    const batch_id = requests[0].batch_id as Id<"llm_batches">;

    await handleQueuedBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const runningBatch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id,
      patch: {
        status: "running",
        next_poll_at: Date.now() - 1,
        batch_ref: runningBatch.batch.batch_ref,
      },
    });

    __setMockBatchMode("running");

    await handleRunningBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const updated = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(updated.batch.status).toBe("running");
    expect(updated.batch.next_poll_at).toBeDefined();
  });

  test("processRunningBatchWorkflow handles provider error", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("running_batch_error"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );
    const batch_id = requests[0].batch_id as Id<"llm_batches">;

    await handleQueuedBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const runningBatch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id,
      patch: {
        status: "running",
        attempts: 0,
        next_poll_at: Date.now() - 1,
        batch_ref: runningBatch.batch.batch_ref,
      },
    });

    __setMockBatchMode("error");

    await handleRunningBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const updated = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(updated.batch.status).toBe("queued");
    expect(updated.batch.last_error).toBeDefined();
  });

  test("processRunningBatchWorkflow completes batch and marks success", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("running_batch_success"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );
    const batch_id = requests[0].batch_id as Id<"llm_batches">;

    await handleQueuedBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const runningBatch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id,
      patch: {
        status: "running",
        next_poll_at: Date.now() - 1,
        batch_ref: runningBatch.batch.batch_ref,
      },
    });

    __setMockBatchMode("completed");

    await handleRunningBatchWorkflow(buildWorkflowStep(t), { batch_id });

    const updated = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(updated.batch.status).toBe("success");
  });
});

describe("job execution edge cases", () => {
  test("runJobRequests retries when provider fails", async () => {
    const t = initTest();
    const request_id = await t.mutation(
      internal.domain.llm_calls.llm_request_repo.createLlmRequest,
      {
        model: "gpt-4.1",
        system_prompt: "system",
        user_prompt: "user",
        custom_key: "evidence:fake:l1_cleaned",
      },
    );

    const request = await t.query(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id },
    );

    const ctx = buildJobCtx(t, async () => {
      throw new Error("provider_error");
    });

    const result = await runJobRequests({
      ctx,
      requests: [request],
      now: Date.now(),
    });

    expect(result.anyPending).toBe(true);
    expect(result.anyErrors).toBe(false);

    const updated = await t.query(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id },
    );
    expect(updated.status).toBe("pending");
    expect(updated.attempts).toBe(1);
    expect(updated.next_attempt_at).toBeDefined();
  });

  test("runJobRequests marks terminal failures and errors the window", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = jobCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("job_terminal"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );

    for (const req of requests) {
      await t.mutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
        request_id: req._id,
        patch: {
          attempts: ENGINE_SETTINGS.run_policy.max_request_attempts - 1,
        },
      });
    }

    const ctx = buildJobCtx(t, async () => {
      throw new Error("provider_error");
    });

    const refreshed = await getRequests(
      t,
      requests.map((req) => req._id),
    );

    await runJobRequests({
      ctx,
      requests: refreshed,
      now: Date.now(),
    });

    const window = await t.query(internal.domain.window.window_repo.getWindow, {
      window_id,
    });
    expect(window.status).toBe("error");

    const updated = await getRequests(
      t,
      requests.map((req) => req._id),
    );
    updated.forEach((req) => {
      expect(req.status).toBe("error");
    });
  });
});

describe("batch execution edge cases", () => {
  test("applyBatchResults requeues failed rows and keeps successes", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("batch_partial"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );

    const [failed, ...rest] = requests;
    const results = [
      {
        custom_key: failed.custom_key,
        status: "error" as const,
        error: "provider_error",
      },
      ...rest.map((req, index) => ({
        custom_key: req.custom_key,
        status: "completed" as const,
        output: {
          assistant_output: `ok_${index}`,
          input_tokens: 10,
          output_tokens: 5,
        },
      })),
    ];

    await applyBatchResults({
      ctx: { runMutation: t.mutation },
      requests,
      results,
      now: Date.now(),
    });

    const updatedFailed = await t.query(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: failed._id },
    );

    expect(updatedFailed.status).toBe("pending");
    expect(updatedFailed.job_id).not.toBeNull();
    expect(updatedFailed.batch_id).toBeNull();
    expect(updatedFailed.next_attempt_at).toBeDefined();

    const successRequest = rest[0];
    if (successRequest) {
      const updatedSuccess = await t.query(
        internal.domain.llm_calls.llm_request_repo.getLlmRequest,
        { request_id: successRequest._id },
      );
      expect(updatedSuccess.status).toBe("success");
    }

    const window = await t.query(internal.domain.window.window_repo.getWindow, {
      window_id,
    });
    expect(window.status).toBe("running");
  });

  test("handleBatchError requeues before max retries", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("batch_retry"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );

    const batch_id = requests[0].batch_id as Id<"llm_batches">;
    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id,
      patch: { attempts: 0 },
    });

    const latestBatch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );

    await handleBatchError({
      ctx: { runMutation: t.mutation },
      batch: latestBatch.batch,
      requests: latestBatch.requests,
      error: "provider_error",
    });

    const updatedBatch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );

    expect(updatedBatch.batch.status).toBe("queued");
    expect(updatedBatch.batch.batch_ref ?? null).toBeNull();
    expect(updatedBatch.batch.next_poll_at).toBeDefined();
  });

  test("handleBatchError errors window after max retries", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("batch_terminal"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getRequests(
      t,
      evidences.map((row) => row.l1_request_id),
    );

    const batch_id = requests[0].batch_id as Id<"llm_batches">;
    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id,
      patch: { attempts: ENGINE_SETTINGS.run_policy.max_batch_retries },
    });

    const batchWithRequests = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );

    await handleBatchError({
      ctx: { runMutation: t.mutation },
      batch: batchWithRequests.batch,
      requests: batchWithRequests.requests,
      error: "provider_error",
    });

    const updatedBatch = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    expect(updatedBatch.batch.status).toBe("error");

    const updatedRequests = await Promise.all(
      requests.map((req) =>
        t.query(internal.domain.llm_calls.llm_request_repo.getLlmRequest, {
          request_id: req._id,
        }),
      ),
    );
    updatedRequests.forEach((req) => {
      expect(req.status).toBe("error");
    });

    const window = await t.query(internal.domain.window.window_repo.getWindow, {
      window_id,
    });
    expect(window.status).toBe("error");
  });
});
