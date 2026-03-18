import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";
import { getRateLimitKeysForModel, rateLimiter } from "../../platform/rate_limiter";
import type { ActionCtx, MutationCtx } from "../../_generated/server";
import type { ModelType } from "../../platform/providers/provider_types";
import { getNextAttemptAt, getNextRunAt } from "../../utils/scheduling";
import {
  resolveApplyHandler,
  resolveErrorHandler,
} from "../orchestrator/target_registry";
import { classifyRequestError } from "./llm_request_repo";

type MutationRunner = Pick<MutationCtx, "runMutation">;
type ActionRunner = Pick<ActionCtx, "runAction" | "runQuery">;
type RateLimitRunner = Parameters<typeof rateLimiter.limit>[0];

function classifyError(error: string | null | undefined): string {
  return classifyRequestError(error);
}

function isTerminalRequestError(error: string | null | undefined): boolean {
  const cls = classifyError(error);
  return cls === "parse_error" || cls === "orchestrator_error";
}

interface MarkBatchEmptyArgs {
  ctx: MutationRunner;
  batch_id: Id<"llm_batches">;
}
export async function markBatchEmpty(args: MarkBatchEmptyArgs) {
  const { ctx, batch_id } = args;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    {
      batch_id,
      patch: {
        status: "error",
        last_error: "empty_batch",
        poll_claim_owner: null,
        poll_claim_expires_at: null,
      },
    },
  );
}

interface MarkBatchRunningArgs {
  ctx: MutationRunner;
  batch: Doc<"llm_batches">;
  batch_ref: string;
  input_file_id?: string;
}
export async function markBatchRunning(args: MarkBatchRunningArgs) {
  const { ctx, batch, batch_ref, input_file_id } = args;
  const attemptIndex = batch.attempt_index;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    {
      batch_id: batch._id,
      patch: {
        status: "running",
        attempt_index: attemptIndex,
        batch_ref,
        input_file_id,
        next_poll_at: getNextRunAt(Date.now()),
        poll_claim_owner: null,
        poll_claim_expires_at: null,
      },
    },
  );
}

interface MarkBatchSubmittingArgs {
  ctx: MutationRunner;
  batch_id: Id<"llm_batches">;
  owner: string;
  now: number;
  lease_ms: number;
  submission_id: string;
}
export async function markBatchSubmitting(args: MarkBatchSubmittingArgs) {
  const { ctx, batch_id, owner, now, lease_ms, submission_id } = args;
  return ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.markBatchSubmitting,
    {
      batch_id,
      owner,
      now,
      lease_ms,
      submission_id,
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
        poll_claim_owner: null,
        poll_claim_expires_at: null,
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
    {
      batch_id,
      patch: {
        next_poll_at,
        poll_claim_owner: null,
        poll_claim_expires_at: null,
      },
    },
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
  const currentAttemptIndex = batch.attempt_index;
  const forceTerminal = String(error).toLowerCase().includes("terminal:")
    || isTerminalRequestError(error);
  if (!forceTerminal && currentAttemptIndex <= ENGINE_SETTINGS.run_policy.max_batch_retries) {
    const retryRequestIds: Id<"llm_requests">[] = [];
    const nextAttemptIndex = currentAttemptIndex + 1;

    for (const req of requests) {
      if (req.status !== "pending") continue;
      const attemptIndex = req.attempt_index ?? 1;
      if (attemptIndex < ENGINE_SETTINGS.run_policy.max_request_attempts) {
        await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.patchRequest,
          {
            request_id: req._id,
            patch: {
              status: "error",
              last_error: error,
              batch_id: null,
              job_id: null,
            },
          },
        );

        const nextAttempt = attemptIndex + 1;
        const retryRequestId = await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.createLlmRequest,
          {
            model: req.model,
            system_prompt_id: req.system_prompt_id ?? null,
            user_prompt: req.user_prompt,
            custom_key: req.custom_key,
            attempt_index: nextAttempt,
          },
        );
        retryRequestIds.push(retryRequestId);
        continue;
      }

      await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.patchRequest,
        {
          request_id: req._id,
          patch: {
            status: "error",
            last_error: error,
            batch_id: null,
            job_id: null,
          },
        },
      );

      const handler = resolveErrorHandler(req.custom_key);
      if (handler) {
        await ctx.runMutation(handler, {
          request_id: req._id,
          custom_key: req.custom_key,
        });
      }
    }

    if (retryRequestIds.length > 0) {
      const retryBatchId = await ctx.runMutation(
        internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
        {
          provider: batch.provider,
          model: batch.model,
          custom_key: batch.custom_key,
          attempt_index: nextAttemptIndex,
        },
      );
      await ctx.runMutation(
        internal.domain.llm_calls.llm_batch_repo.assignRequestsToBatch,
        {
          request_ids: retryRequestIds,
          batch_id: retryBatchId,
        },
      );
    }
    await ctx.runMutation(
      internal.domain.llm_calls.llm_batch_repo.patchBatch,
      {
        batch_id: batch._id,
        patch: {
          status: "error",
          last_error: error,
          next_poll_at: undefined,
          poll_claim_owner: null,
          poll_claim_expires_at: null,
        },
      },
    );
    if (retryRequestIds.length > 0) {
      await ctx.runMutation(
        internal.domain.orchestrator.scheduler.startScheduler,
        {},
      );
    }
    return;
  }
  await ctx.runMutation(
    internal.domain.llm_calls.llm_batch_repo.patchBatch,
    {
      batch_id: batch._id,
      patch: {
        status: "error",
        last_error: error,
        input_file_id: undefined,
        poll_claim_owner: null,
        poll_claim_expires_at: null,
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
    const handler = resolveErrorHandler(req.custom_key);
    if (handler) {
      await ctx.runMutation(handler, {
        request_id: req._id,
        custom_key: req.custom_key,
      });
    }
  }
}


interface SubmitBatchArgs {
  ctx: ActionRunner;
  requests: Doc<"llm_requests">[];
  batch_id: Id<"llm_batches">;
  submission_id: string;
}
export async function submitBatch(args: SubmitBatchArgs) {
  const { ctx, requests, batch_id, submission_id } = args;
  const resolvedPrompts = await ctx.runQuery(
    internal.domain.llm_calls.llm_request_repo.resolveRequestPrompts,
    { request_ids: requests.map((req) => req._id) },
  ) as Array<{
    request_id: Id<"llm_requests">;
    system_prompt: string | null;
    user_prompt: string;
  }>;
  const promptByRequestId = new Map(
    resolvedPrompts.map((row: {
      request_id: Id<"llm_requests">;
      system_prompt: string | null;
      user_prompt: string;
    }): [Id<"llm_requests">, {
      request_id: Id<"llm_requests">;
      system_prompt: string | null;
      user_prompt: string;
    }] => [row.request_id, row]),
  );
  const payload = requests.map((req) => ({
    custom_key: req.custom_key,
    model: req.model,
    system_prompt: promptByRequestId.get(req._id)?.system_prompt ?? undefined,
    user_prompt: promptByRequestId.get(req._id)?.user_prompt ?? req.user_prompt,
    max_tokens: ENGINE_SETTINGS.run_policy.max_tokens,
  }));
  const result = await ctx.runAction(
    internal.platform.providers.provider_services.submitOpenAiBatchAction,
    {
      requests: payload,
      metadata: {
        engine_batch_id: String(batch_id),
        engine_submission_id: submission_id,
      },
    },
  );
  return result;
}

interface RecoverSubmittedBatchArgs {
  ctx: ActionRunner;
  batch_id: Id<"llm_batches">;
  submission_id: string;
}
export async function recoverSubmittedBatch(args: RecoverSubmittedBatchArgs) {
  const { ctx, batch_id, submission_id } = args;
  return ctx.runAction(
    internal.platform.providers.provider_services.findOpenAiBatchByMetadataAction,
    {
      metadata: {
        engine_batch_id: String(batch_id),
        engine_submission_id: submission_id,
      },
    },
  );
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
  heartbeat?: () => Promise<void>;
}
export async function applyBatchResults(args: ApplyBatchResultsArgs) {
  const { ctx, requests, results, now, heartbeat } = args;
  const resultRowsByKey = new Map<string, BatchResult[]>();
  for (const row of results) {
    const current = resultRowsByKey.get(row.custom_key) ?? [];
    current.push(row);
    resultRowsByKey.set(row.custom_key, current);
  }

  let totalInput = 0;
  let totalOutput = 0;
  let missingResultCount = 0;
  let processedCount = 0;

  for (const req of requests) {
    if (processedCount % 10 === 0) {
      await heartbeat?.();
    }
    processedCount += 1;
    if (req.status !== "pending") continue;
    const matchingRows = resultRowsByKey.get(req.custom_key) ?? [];
    const row = matchingRows.shift();

    if (!row) {
      missingResultCount += 1;
      const attemptIndex = req.attempt_index ?? 1;
      if (attemptIndex < ENGINE_SETTINGS.run_policy.max_request_attempts) {
        await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.patchRequest,
          {
            request_id: req._id,
            patch: {
              status: "error",
              last_error: "missing_batch_result",
            },
          },
        );

        const nextAttempt = attemptIndex + 1;
        const retryRequestId = await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.createLlmRequest,
          {
            model: req.model,
            system_prompt_id: req.system_prompt_id ?? null,
            user_prompt: req.user_prompt,
            custom_key: req.custom_key,
            attempt_index: nextAttempt,
          },
        );

        await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.patchRequest,
          {
            request_id: retryRequestId,
            patch: {
              next_attempt_at: getNextAttemptAt(now),
            },
          },
        );

        await ctx.runMutation(
          internal.domain.orchestrator.scheduler.requeueRequest,
          { request_id: retryRequestId },
        );
      } else {
        await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.patchRequest,
          {
            request_id: req._id,
            patch: {
              status: "error",
              last_error: "missing_batch_result",
            },
          },
        );
        const handler = resolveErrorHandler(req.custom_key);
        if (handler) {
          await ctx.runMutation(handler, {
            request_id: req._id,
            custom_key: req.custom_key,
          });
        }
      }
      continue;
    }

    if (row.status === "completed" && row.output) {
      totalInput += row.output.input_tokens ?? 0;
      totalOutput += row.output.output_tokens ?? 0;

      const handler = resolveApplyHandler(req.custom_key);
      if (!handler) throw new Error(`Unsupported target type for result: ${req.custom_key}`);

      try {
        await ctx.runMutation(handler, {
          request_id: req._id,
          custom_key: req.custom_key,
          output: row.output.assistant_output,
          input_tokens: row.output.input_tokens,
          output_tokens: row.output.output_tokens,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attemptIndex = req.attempt_index ?? 1;
        const terminal = isTerminalRequestError(message);
        if (!terminal && attemptIndex < ENGINE_SETTINGS.run_policy.max_request_attempts) {
          await ctx.runMutation(
            internal.domain.llm_calls.llm_request_repo.patchRequest,
            {
              request_id: req._id,
              patch: {
                status: "error",
                last_error: message,
              },
            },
          );

          const nextAttempt = attemptIndex + 1;
          const retryRequestId = await ctx.runMutation(
            internal.domain.llm_calls.llm_request_repo.createLlmRequest,
            {
              model: req.model,
              system_prompt_id: req.system_prompt_id ?? null,
              user_prompt: req.user_prompt,
              custom_key: req.custom_key,
              attempt_index: nextAttempt,
            },
          );

          await ctx.runMutation(
            internal.domain.llm_calls.llm_request_repo.patchRequest,
            {
              request_id: retryRequestId,
              patch: {
                next_attempt_at: getNextAttemptAt(now),
              },
            },
          );

          await ctx.runMutation(
            internal.domain.orchestrator.scheduler.requeueRequest,
            { request_id: retryRequestId },
          );
        } else {
          await ctx.runMutation(
            internal.domain.llm_calls.llm_request_repo.patchRequest,
            {
              request_id: req._id,
              patch: {
                status: "error",
                last_error: message,
              },
            },
          );
          const errorHandler = resolveErrorHandler(req.custom_key);
          if (errorHandler) {
            await ctx.runMutation(errorHandler, {
              request_id: req._id,
              custom_key: req.custom_key,
            });
          }
        }
      }

      continue;
    }

    const attemptIndex = req.attempt_index ?? 1;
    const terminal = isTerminalRequestError(row.error ?? "provider_error");
    if (!terminal && attemptIndex < ENGINE_SETTINGS.run_policy.max_request_attempts) {
      await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.patchRequest,
        {
          request_id: req._id,
          patch: {
            status: "error",
            last_error: row.error ?? "provider_error",
          },
        },
      );

      const nextAttempt = attemptIndex + 1;
      const retryRequestId = await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.createLlmRequest,
        {
          model: req.model,
          system_prompt_id: req.system_prompt_id ?? null,
          user_prompt: req.user_prompt,
          custom_key: req.custom_key,
          attempt_index: nextAttempt,
        },
      );

      await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.patchRequest,
        {
          request_id: retryRequestId,
          patch: {
            next_attempt_at: getNextAttemptAt(now),
          },
        },
      );

      await ctx.runMutation(
        internal.domain.orchestrator.scheduler.requeueRequest,
        { request_id: retryRequestId },
      );
    } else {
      await ctx.runMutation(
        internal.domain.llm_calls.llm_request_repo.patchRequest,
        {
          request_id: req._id,
          patch: {
            status: "error",
            last_error: row.error ?? "provider_error",
          },
        },
      );
      const handler = resolveErrorHandler(req.custom_key);
      if (handler) {
        await ctx.runMutation(handler, {
          request_id: req._id,
          custom_key: req.custom_key,
        });
      }
    }
  }

  return { totalInput, totalOutput, missingResultCount };
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
