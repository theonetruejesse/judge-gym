import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { zInternalAction } from "../../utils/custom_fns";
import { ENGINE_SETTINGS } from "../../settings";
import { getRateLimitKeysForModel, rateLimiter } from "../../platform/rate_limiter";
import { pollOpenAiBatch, submitOpenAiBatch } from "../../platform/providers/openai_batch";
import type { ActionCtx } from "../../_generated/server";
import type { BatchWithRequestsResult } from "./llm_batch_repo";
import type { ModelType } from "../../models/_shared";
import { getNextAttemptAt, getNextRunAt, shouldRunAt } from "../../utils/scheduling";

export async function patchEmptyBatch(ctx: ActionCtx, batch_id: Id<"llm_batches">) {
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    { batch_id, patch: { status: "error", last_error: "empty_batch" } },
  );
}

export function buildBatchPayload(requests: Doc<"llm_requests">[]) {
  return requests.map((req) => ({
    custom_key: req.custom_key,
    model: req.model,
    system_prompt: req.system_prompt ?? undefined,
    user_prompt: req.user_prompt,
    max_tokens: ENGINE_SETTINGS.run_policy.max_tokens,
  }));
}

export async function submitBatchAndMarkRunning(
  ctx: ActionCtx,
  batch: Doc<"llm_batches">,
  requests: Doc<"llm_requests">[],
) {
  const now = Date.now();
  const payload = buildBatchPayload(requests);
  const result = await submitOpenAiBatch(payload);
  const attempts = (batch.attempts ?? 0) + 1;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    {
      batch_id: batch._id,
      patch: {
        status: "running",
        batch_ref: result.batch_ref,
        next_poll_at: getNextRunAt(now),
        attempts,
      },
    },
  );
}

export async function handleBatchRateLimitDeferral(
  ctx: ActionCtx,
  batch_id: Id<"llm_batches">,
  model: ModelType,
  requests: Doc<"llm_requests">[],
) {
  const keys = getRateLimitKeysForModel(model, "batch");
  if (!keys) return false;

  const limit = await rateLimiter.limit(ctx, keys.requestsKey, {
    count: requests.length,
  });
  if (limit.ok) return false;

  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    { batch_id, patch: { next_poll_at: limit.retryAfter } },
  );
  return true;
}

export async function scheduleBatchPoll(ctx: ActionCtx, batch_id: Id<"llm_batches">) {
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    { batch_id, patch: { next_poll_at: getNextRunAt(Date.now()) } },
  );
}

interface HandleBatchErrorArgs {
  ctx: ActionCtx;
  batch: Doc<"llm_batches">;
  requests: Doc<"llm_requests">[];
  error: string;
}
export async function handleBatchError(args: HandleBatchErrorArgs) {
  const { ctx, batch, requests, error } = args;
  const attempts = (batch.attempts ?? 0) + 1;
  if (attempts <= ENGINE_SETTINGS.run_policy.max_batch_retries) {
    await ctx.runMutation(
      internal.domain.llm_calls.llm_batch_repo.patchBatch,
      {
        batch_id: batch._id,
        patch: {
          status: "queued",
          batch_ref: undefined,
          attempts,
          last_error: error,
          next_poll_at: getNextRunAt(Date.now()),
        },
      },
    );
    return;
  }
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    {
      batch_id: batch._id,
      patch: {
        status: "error",
        last_error: error,
      },
    },
  );

  for (const req of requests) {
    await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.patchRequest,
      {
        request_id: req._id,
        patch: {
          status: "error",
          last_error: error,
        },
      },
    );
  }
}

type BatchResult = {
  custom_key: string;
  status: "completed" | "error";
  output?: {
    assistant_output: string;
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: string;
};
interface ApplyBatchResultsArgs {
  ctx: ActionCtx;
  requests: Doc<"llm_requests">[];
  results: Array<BatchResult>;
  now: number;
}
export async function applyBatchResults(args: ApplyBatchResultsArgs) {
  const { ctx, requests, results, now } = args;
  const requestByKey = new Map(
    requests.map((req) => [req.custom_key, req] as const),
  );

  let totalInput = 0;
  let totalOutput = 0;

  for (const row of results) {
    const req = requestByKey.get(row.custom_key);
    if (!req) continue;

    if (row.status === "completed" && row.output) {
      totalInput += row.output.input_tokens ?? 0;
      totalOutput += row.output.output_tokens ?? 0;
      await ctx.runMutation(
        internal.domain.window.window_service.applyRequestResult,
        {
          request_id: req._id,
          custom_key: req.custom_key,
          output: row.output.assistant_output,
          input_tokens: row.output.input_tokens,
          output_tokens: row.output.output_tokens,
        },
      );
      continue;
    }

    const attempts = (req.attempts ?? 0) + 1;
    if (attempts < ENGINE_SETTINGS.run_policy.max_request_attempts) {
      await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.patchRequest,
        {
          request_id: req._id,
          patch: {
            status: "pending",
            attempts,
            last_error: row.error ?? "provider_error",
            next_attempt_at: getNextAttemptAt(now),
          },
        },
      );
      await ctx.runMutation(
        internal.domain.orchestrator.scheduler.requeueRequest,
        { request_id: req._id },
      );
    } else {
      await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.patchRequest,
        {
          request_id: req._id,
          patch: {
            status: "error",
            attempts,
            last_error: row.error ?? "provider_error",
          },
        },
      );
    }
  }

  return { totalInput, totalOutput };
}

interface ApplyBatchRateLimitUsageArgs {
  ctx: ActionCtx;
  model: ModelType;
  totalInput: number;
  totalOutput: number;
}
export async function applyBatchRateLimitUsage(args: ApplyBatchRateLimitUsageArgs) {
  const { ctx, model, totalInput, totalOutput } = args;
  const keys = getRateLimitKeysForModel(model, "batch");
  if (!keys) return;
  if (totalInput > 0) await rateLimiter.limit(ctx, keys.inputKey, { count: totalInput });
  if (totalOutput > 0) await rateLimiter.limit(ctx, keys.outputKey, { count: totalOutput });
}

export async function markBatchSuccess(ctx: ActionCtx, batch_id: Id<"llm_batches">) {
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    {
      batch_id,
      patch: {
        status: "success",
        next_poll_at: undefined,
      },
    },
  );
}


export const processQueuedBatch = zInternalAction({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, args) => {
    const { batch, requests } = (await ctx.runQuery(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id: args.batch_id },
    )) as BatchWithRequestsResult;

    if (batch.status !== "queued") return;

    if (requests.length === 0) {
      await patchEmptyBatch(ctx, batch._id);
      return;
    }

    const shouldDefer = await handleBatchRateLimitDeferral(
      ctx,
      batch._id,
      batch.model,
      requests,
    );
    if (shouldDefer) return;

    await submitBatchAndMarkRunning(ctx, batch, requests);
  },
});


export const processRunningBatch = zInternalAction({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, args) => {
    const { batch, requests } = (await ctx.runQuery(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id: args.batch_id },
    )) as BatchWithRequestsResult;

    if (batch.status !== "running") return;
    if (!shouldRunAt(batch.next_poll_at, Date.now())) return;
    if (!batch.batch_ref) return;

    const result = await pollOpenAiBatch(batch.batch_ref);

    if (result.status === "running") {
      await scheduleBatchPoll(ctx, batch._id);
      return;
    }
    if (result.status === "error") {
      await handleBatchError({
        ctx,
        batch,
        requests,
        error: result.error,
      });
      return;
    }

    const counters = await applyBatchResults({
      ctx,
      requests,
      results: result.results,
      now: Date.now(),
    });
    await applyBatchRateLimitUsage({
      ctx,
      model: batch.model,
      totalInput: counters.totalInput,
      totalOutput: counters.totalOutput,
    });

    await markBatchSuccess(ctx, batch._id);
  },
});
