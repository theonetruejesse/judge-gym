import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";
import { getRateLimitKeysForModel, rateLimiter } from "../../platform/rate_limiter";
import type { ActionCtx, MutationCtx } from "../../_generated/server";
import type { ModelType } from "../../models/_shared";
import { getNextAttemptAt, getNextRunAt } from "../../utils/scheduling";

type MutationRunner = Pick<MutationCtx, "runMutation">;
type ActionRunner = Pick<ActionCtx, "runAction">;
type RateLimitRunner = Parameters<typeof rateLimiter.limit>[0];

interface MarkBatchEmptyArgs {
  ctx: MutationRunner;
  batch_id: Id<"llm_batches">;
}
export async function markBatchEmpty(args: MarkBatchEmptyArgs) {
  const { ctx, batch_id } = args;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    { batch_id, patch: { status: "error", last_error: "empty_batch" } },
  );
}

interface MarkBatchRunningArgs {
  ctx: MutationRunner;
  batch: Doc<"llm_batches">;
  batch_ref: string;
}
export async function markBatchRunning(args: MarkBatchRunningArgs) {
  const { ctx, batch, batch_ref } = args;
  const attempts = (batch.attempts ?? 0) + 1;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    {
      batch_id: batch._id,
      patch: {
        status: "running",
        batch_ref,
        next_poll_at: getNextRunAt(Date.now()),
        attempts,
      },
    },
  );
}

interface MarkBatchSuccessArgs {
  ctx: MutationRunner;
  batch_id: Id<"llm_batches">;
}
export async function markBatchSuccess(args: MarkBatchSuccessArgs) {
  const { ctx, batch_id } = args;
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


interface ScheduleBatchPollArgs {
  ctx: MutationRunner;
  batch_id: Id<"llm_batches">;
  next_poll_at: number;
}
export async function scheduleBatchPoll(args: ScheduleBatchPollArgs) {
  const { ctx, batch_id, next_poll_at } = args;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    { batch_id, patch: { next_poll_at } },
  );
}

interface HandleBatchErrorArgs {
  ctx: MutationRunner;
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


interface SubmitBatchArgs {
  ctx: ActionRunner;
  requests: Doc<"llm_requests">[];
}
export async function submitBatch(args: SubmitBatchArgs) {
  const { ctx, requests } = args;
  const payload = requests.map((req) => ({
    custom_key: req.custom_key,
    model: req.model,
    system_prompt: req.system_prompt ?? undefined,
    user_prompt: req.user_prompt,
    max_tokens: ENGINE_SETTINGS.run_policy.max_tokens,
  }))
  const result = await ctx.runAction(
    internal.platform.providers.provider_services.submitOpenAiBatchAction,
    { requests: payload },
  );
  return result;
}


interface CheckBatchRateLimitArgs {
  ctx: RateLimitRunner;
  model: ModelType;
  requests: Doc<"llm_requests">[];
}
export async function checkBatchRateLimit(args: CheckBatchRateLimitArgs) {
  const { ctx, model, requests } = args;
  const keys = getRateLimitKeysForModel(model, "batch");
  if (!keys) return null;

  const limit = await rateLimiter.limit(ctx, keys.requestsKey, {
    count: requests.length,
  });
  return limit.ok ? null : limit.retryAfter;
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
  ctx: MutationRunner;
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
  ctx: RateLimitRunner;
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
