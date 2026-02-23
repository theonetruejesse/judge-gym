import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { ENGINE_SETTINGS } from "../settings";
import {
  isBatchableModel,
  type ModelType,
} from "../platform/providers/provider_types";
import {
  resolveApplyHandler,
  resolveRequeueHandler,
} from "../domain/orchestrator/target_registry";

const initTest = () => convexTest(schema, buildModules());

type EvidenceDoc = Doc<"evidences">;
type RequestDoc = Doc<"llm_requests">;

type Stage = "l1_cleaned" | "l2_neutralized" | "l3_abstracted";

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
  const ids = requestIds.filter((id): id is Id<"llm_requests"> => Boolean(id));
  const requests = await Promise.all(
    ids.map((request_id) =>
      t.query(internal.domain.llm_calls.llm_request_repo.getLlmRequest, {
        request_id,
      }),
    ),
  );
  return requests as RequestDoc[];
}

async function getLatestRequestsForStage(
  t: ReturnType<typeof convexTest>,
  evidences: EvidenceDoc[],
  stage: Stage,
) {
  const requests = await Promise.all(
    evidences.map(async (evidence) => {
      const custom_key = `evidence:${evidence._id}:${stage}`;
      const list = await t.query(
        internal.domain.llm_calls.llm_request_repo.listRequestsByCustomKey,
        { custom_key },
      );
      if (list.length === 0) return null;
      return list.reduce((best, req) => {
        const bestAttempts = best.attempts ?? 0;
        const nextAttempts = req.attempts ?? 0;
        return nextAttempts >= bestAttempts ? req : best;
      });
    }),
  );
  return requests.filter(Boolean) as RequestDoc[];
}

async function forceRequestError(
  t: ReturnType<typeof convexTest>,
  request: RequestDoc,
  error?: string,
  options?: { terminal?: boolean },
) {
  const attempts = options?.terminal
    ? ENGINE_SETTINGS.run_policy.max_request_attempts
    : (request.attempts ?? 0) + 1;
  await t.mutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
    request_id: request._id,
    patch: {
      status: "error",
      attempts,
      last_error: error ?? "forced_error",
    },
  });
  await t.mutation(internal.domain.window.window_service.handleRequestError, {
    request_id: request._id,
    custom_key: request.custom_key,
  });
}

function expectedRoute(model: ModelType, count: number): "batch" | "job" {
  const policy = ENGINE_SETTINGS.run_policy;
  if (!isBatchableModel(model)) return "job";
  if (count < policy.min_batch_size) return "job";
  if (count <= policy.job_fallback_count) return "job";
  return "batch";
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

describe("target registry", () => {
  test("resolves handlers for evidence keys", () => {
    const apply = resolveApplyHandler("evidence:abc:l1_cleaned");
    const requeue = resolveRequeueHandler("evidence:abc:l1_cleaned");
    expect(apply).not.toBeNull();
    expect(requeue).not.toBeNull();
  });

  test("returns null for unknown target types", () => {
    expect(resolveApplyHandler("unknown:abc:l1_cleaned")).toBeNull();
    expect(resolveRequeueHandler("unknown:abc:l1_cleaned")).toBeNull();
  });
});

describe("orchestrator edge cases", () => {
  test("routes batchable small windows to jobs", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = jobCountForPolicy();
    expect(expectedRoute(model, count)).toBe("job");

    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("job_route"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getLatestRequestsForStage(
      t,
      evidences,
      "l1_cleaned",
    );

    expect(requests.length).toBe(count);
    const jobIds = new Set(requests.map((req) => req.job_id));
    const batchIds = new Set(requests.map((req) => req.batch_id));
    expect(batchIds.size).toBe(1);
    expect(batchIds.has(null)).toBe(true);
    expect(jobIds.has(null)).toBe(false);
    expect(jobIds.size).toBe(1);

    const requestByKey = new Map(requests.map((req) => [req.custom_key, req] as const));
    evidences.forEach((evidence) => {
      const req = requestByKey.get(`evidence:${evidence._id}:l1_cleaned`);
      expect(req).toBeDefined();
      expect(req?.custom_key).toBe(`evidence:${evidence._id}:l1_cleaned`);
      expect(req?.model).toBe(model);
    });
  });

  test("routes batchable large windows to batches", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    expect(expectedRoute(model, count)).toBe("batch");

    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("batch_route"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getLatestRequestsForStage(
      t,
      evidences,
      "l1_cleaned",
    );

    expect(requests.length).toBe(count);
    const jobIds = new Set(requests.map((req) => req.job_id));
    const batchIds = new Set(requests.map((req) => req.batch_id));
    expect(jobIds.size).toBe(1);
    expect(jobIds.has(null)).toBe(true);
    expect(batchIds.has(null)).toBe(false);
    expect(batchIds.size).toBe(1);
  });

  test("non-batchable models always route to jobs", async () => {
    const t = initTest();
    const model: ModelType = "gpt-5.2-chat";
    const count = batchCountForPolicy();
    expect(expectedRoute(model, count)).toBe("job");

    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("non_batchable"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getLatestRequestsForStage(
      t,
      evidences,
      "l1_cleaned",
    );

    expect(requests.length).toBe(count);
    const jobIds = new Set(requests.map((req) => req.job_id));
    const batchIds = new Set(requests.map((req) => req.batch_id));
    expect(batchIds.size).toBe(1);
    expect(batchIds.has(null)).toBe(true);
    expect(jobIds.has(null)).toBe(false);
    expect(jobIds.size).toBe(1);
  });

  test("partial results do not advance stages until complete", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = 3;
    const label = uniqueLabel("partial_results");

    const window_id = await createWindowWithEvidence(t, model, count, label);
    await startWindowOrchestration(t, window_id);

    let evidences = await listEvidence(t, window_id);
    const requests = await getLatestRequestsForStage(
      t,
      evidences,
      "l1_cleaned",
    );
    const firstRequest = requests[0];

    await t.mutation(internal.domain.window.window_service.applyRequestResult, {
      request_id: firstRequest._id,
      custom_key: firstRequest.custom_key,
      output: `cleaned output for ${label} (partial)`,
      input_tokens: 5,
      output_tokens: 10,
    });

    const windowAfterPartial = await t.query(
      internal.domain.window.window_repo.getWindow,
      { window_id },
    );
    expect(windowAfterPartial.current_stage).toBe("l1_cleaned");

    for (const request of requests.slice(1)) {
      await t.mutation(
        internal.domain.window.window_service.applyRequestResult,
        {
          request_id: request._id,
          custom_key: request.custom_key,
          output: `cleaned output for ${label} (${request._id})`,
        },
      );
    }

    const windowAfterFull = await t.query(
      internal.domain.window.window_repo.getWindow,
      { window_id },
    );
    expect(windowAfterFull.current_stage).toBe("l2_neutralized");

    evidences = await listEvidence(t, window_id);
    evidences.forEach((row) => {
      expect(row.l1_cleaned_content).not.toBeNull();
    });

    const updatedRequest = await t.query(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: firstRequest._id },
    );
    expect(updatedRequest.status).toBe("success");
    expect(updatedRequest.input_tokens).toBe(5);
    expect(updatedRequest.output_tokens).toBe(10);
  });

  test("partial failures advance with successful evidence only", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = 3;
    const label = uniqueLabel("partial_failures");

    const window_id = await createWindowWithEvidence(t, model, count, label);
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getLatestRequestsForStage(
      t,
      evidences,
      "l1_cleaned",
    );

    const failedRequest = requests[0];
    await forceRequestError(t, failedRequest, undefined, { terminal: true });

    for (const request of requests.slice(1)) {
      await t.mutation(
        internal.domain.window.window_service.applyRequestResult,
        {
          request_id: request._id,
          custom_key: request.custom_key,
          output: `cleaned output for ${label} (${request._id})`,
        },
      );
    }

    const windowAfter = await t.query(
      internal.domain.window.window_repo.getWindow,
      { window_id },
    );
    expect(windowAfter.current_stage).toBe("l2_neutralized");
    expect(windowAfter.status).toBe("running");

    const evidenceAfter = await listEvidence(t, window_id);
    const failedEvidenceId = failedRequest.custom_key.split(":")[1];
    const failedEvidence = evidenceAfter.find(
      (row) => row._id === failedEvidenceId,
    );
    expect(failedEvidence?.l2_request_id ?? null).toBeNull();

    const succeeded = evidenceAfter.filter(
      (row) => row._id !== failedEvidenceId,
    );
    succeeded.forEach((row) => {
      expect(row.l1_cleaned_content).not.toBeNull();
    });

    const pendingL2 = await Promise.all(
      succeeded.map((row) =>
        t.query(
          internal.domain.llm_calls.llm_request_repo.listPendingRequestsByCustomKey,
          { custom_key: `evidence:${row._id}:l2_neutralized` },
        ),
      ),
    );
    pendingL2.forEach((rows) => {
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  test("window errors when all evidence fails", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = 2;
    const label = uniqueLabel("all_fail");

    const window_id = await createWindowWithEvidence(t, model, count, label);
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getLatestRequestsForStage(
      t,
      evidences,
      "l1_cleaned",
    );

    for (const request of requests) {
      await forceRequestError(t, request, undefined, { terminal: true });
    }

    const windowAfter = await t.query(
      internal.domain.window.window_repo.getWindow,
      { window_id },
    );
    expect(windowAfter.status).toBe("error");
  });

  test("enqueue stage is idempotent once request ids exist", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = 2;
    const label = uniqueLabel("idempotent");

    const window_id = await createWindowWithEvidence(t, model, count, label);
    await startWindowOrchestration(t, window_id);

    const evidencesBefore = await listEvidence(t, window_id);
    const requestsBefore = await getLatestRequestsForStage(
      t,
      evidencesBefore,
      "l1_cleaned",
    );
    const requestIdsBefore = requestsBefore.map((req) => req._id);

    await t.mutation(internal.domain.window.window_service.enqueueWindowStage, {
      window_id,
      stage: "l1_cleaned" as Stage,
    });

    const evidencesAfter = await listEvidence(t, window_id);
    const requestsAfter = await getLatestRequestsForStage(
      t,
      evidencesAfter,
      "l1_cleaned",
    );
    const requestIdsAfter = requestsAfter.map((req) => req._id);

    expect(requestIdsAfter).toEqual(requestIdsBefore);
  });

  test("requeue moves batch requests onto jobs", async () => {
    const t = initTest();
    const model: ModelType = "gpt-4.1";
    const count = batchCountForPolicy();
    expect(expectedRoute(model, count)).toBe("batch");

    const window_id = await createWindowWithEvidence(
      t,
      model,
      count,
      uniqueLabel("requeue"),
    );
    await startWindowOrchestration(t, window_id);

    const evidences = await listEvidence(t, window_id);
    const requests = await getLatestRequestsForStage(
      t,
      evidences,
      "l1_cleaned",
    );

    const request = requests[0];
    expect(request.batch_id).toBeDefined();

    await t.mutation(internal.domain.orchestrator.scheduler.requeueRequest, {
      request_id: request._id,
    });

    const updated = await t.query(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: request._id },
    );
    expect(updated.batch_id).toBeNull();
    expect(updated.job_id).toBeDefined();

    const job = await t.query(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id: updated.job_id! },
    );
    expect(job.job.custom_key).toBe(`window:${window_id}:l1_cleaned`);
  });
});
