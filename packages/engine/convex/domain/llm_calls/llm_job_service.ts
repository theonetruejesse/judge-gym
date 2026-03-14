import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";
import { getRateLimitKeysForModel, rateLimiter } from "../../platform/rate_limiter";
import type { ActionCtx } from "../../_generated/server";
import { getNextAttemptAt, getNextRunAt, shouldRunAt } from "../../utils/scheduling";
import {
  resolveApplyHandler,
  resolveErrorHandler,
} from "../orchestrator/target_registry";

type MutationRunner = Pick<ActionCtx, "runMutation" | "runQuery">;
type JobRunner = Pick<ActionCtx, "runAction" | "runMutation" | "runQuery">;
type RateLimitRunner = Parameters<typeof rateLimiter.limit>[0];

interface ApplyJobRateLimitUsageArgs {
  ctx: RateLimitRunner;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

async function applyJobRateLimitUsage(args: ApplyJobRateLimitUsageArgs) {
  const { ctx, model, inputTokens, outputTokens } = args;
  const keys = getRateLimitKeysForModel(model, "job");
  if (!keys) return;
  if ((inputTokens ?? 0) > 0) {
    await rateLimiter.limit(ctx, keys.inputKey, { count: inputTokens });
  }
  if ((outputTokens ?? 0) > 0) {
    await rateLimiter.limit(ctx, keys.outputKey, { count: outputTokens });
  }
}

interface MarkJobRunningArgs {
  ctx: MutationRunner;
  job_id: Id<"llm_jobs">;
}

export async function markJobRunning(args: MarkJobRunningArgs) {
  const { ctx, job_id } = args;
  const job = await ctx.runQuery(
    internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
    { job_id },
  );
  await ctx.runMutation(
    internal.domain.llm_calls.llm_job_repo.patchJob,
    {
      job_id,
      patch: {
        status: "running",
        attempt_index: job.job.attempt_index,
      },
    },
  );
}

interface ScheduleJobRunArgs {
  ctx: MutationRunner;
  job_id: Id<"llm_jobs">;
  now: number;
}
export async function scheduleJobRun(args: ScheduleJobRunArgs) {
  const { ctx, job_id, now } = args;
  const job = await ctx.runQuery(
    internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
    { job_id },
  );
  await ctx.runMutation(
    internal.domain.llm_calls.llm_job_repo.patchJob,
    {
      job_id,
      patch: {
        status: "running",
        attempt_index: job.job.attempt_index + 1,
        next_run_at: getNextRunAt(now),
      },
    },
  );
}

interface FinalizeJobArgs {
  ctx: MutationRunner;
  job_id: Id<"llm_jobs">;
  owner: string;
  anyErrors: boolean;
  now: number;
}
export async function finalizeJob(args: FinalizeJobArgs) {
  const { ctx, job_id, owner, anyErrors, now } = args;
  return ctx.runMutation(
    internal.domain.llm_calls.llm_job_repo.finalizeJobIfClaimedAndRunning,
    {
      job_id,
      owner,
      any_errors: anyErrors,
      now,
    },
  );
}

interface DeferRequestForRateLimitArgs {
  ctx: MutationRunner;
  request_id: Id<"llm_requests">;
  retryAfter: number;
}
export async function deferRequestForRateLimit(args: DeferRequestForRateLimitArgs) {
  const { ctx, request_id, retryAfter } = args;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_request_repo.patchRequest,
    {
      request_id,
      patch: {
        next_attempt_at: retryAfter,
      },
    },
  );
}

type RequestOutput = {
  assistant_output: string;
  input_tokens?: number;
  output_tokens?: number;
};
interface ApplyRequestSuccessArgs {
  ctx: MutationRunner;
  req: Doc<"llm_requests">;
  output: RequestOutput;
}
export async function applyRequestSuccess(args: ApplyRequestSuccessArgs) {
  const { ctx, req, output } = args;
  const handler = resolveApplyHandler(req.custom_key);
  if (!handler) throw new Error(`Unsupported target type for result: ${req.custom_key}`);
  await ctx.runMutation(handler, {
    request_id: req._id,
    custom_key: req.custom_key,
    output: output.assistant_output,
    input_tokens: output.input_tokens,
    output_tokens: output.output_tokens,
  });
}

interface ApplyRequestErrorArgs {
  ctx: MutationRunner;
  req: Doc<"llm_requests">;
  error: string;
  attemptIndex: number;
  now: number;
}
export async function applyRequestError(args: ApplyRequestErrorArgs) {
  const { ctx, req, error, attemptIndex, now } = args;
  if (attemptIndex < ENGINE_SETTINGS.run_policy.max_request_attempts) {
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

    if (req.job_id) {
      await ctx.runMutation(
        internal.domain.llm_calls.llm_job_repo.assignRequestsToJob,
        { request_ids: [retryRequestId], job_id: req.job_id },
      );
    }

    await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.patchRequest,
      {
        request_id: retryRequestId,
        patch: { next_attempt_at: getNextAttemptAt(now) },
      },
    );

    return true;
  }
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
  return false;
}

interface RunJobRequestsArgs {
  ctx: JobRunner;
  requests: Doc<"llm_requests">[];
  now: number;
  heartbeat?: () => Promise<void>;
}
export async function runJobRequests(args: RunJobRequestsArgs) {
  const { ctx, requests, now, heartbeat } = args;
  let anyPending = false;
  let anyErrors = false;
  const runnable: Doc<"llm_requests">[] = [];
  for (const req of requests) {
    if (req.status !== "pending") continue;
    if (!shouldRunAt(req.next_attempt_at, now)) {
      anyPending = true;
      continue;
    }
    runnable.push(req);
  }

  // Reserve request rate-limit capacity sequentially to avoid hot-row OCC
  // conflicts on the shared `rateLimits` table under concurrent workers.
  const admitted: Doc<"llm_requests">[] = [];
  for (const req of runnable) {
    const keys = getRateLimitKeysForModel(req.model, "job");
    if (!keys) {
      admitted.push(req);
      continue;
    }
    try {
      const limit = await rateLimiter.limit(ctx, keys.requestsKey, {
        throws: false,
      });
      if (!limit.ok) {
        await deferRequestForRateLimit({
          ctx,
          request_id: req._id,
          retryAfter: limit.retryAfter,
        });
        anyPending = true;
        continue;
      }
      admitted.push(req);
    } catch {
      await deferRequestForRateLimit({
        ctx,
        request_id: req._id,
        retryAfter: getNextAttemptAt(now),
      });
      anyPending = true;
    }
  }

  const processRequest = async (req: Doc<"llm_requests">) => {
    try {
      await heartbeat?.();
      const [resolvedPrompt] = await ctx.runQuery(
        internal.domain.llm_calls.llm_request_repo.resolveRequestPrompts,
        { request_ids: [req._id] },
      );
      const output = await ctx.runAction(
        internal.platform.providers.provider_services.openAiChatAction,
        {
          model: req.model,
          system_prompt: resolvedPrompt?.system_prompt ?? undefined,
          user_prompt: resolvedPrompt?.user_prompt ?? req.user_prompt,
          max_tokens: ENGINE_SETTINGS.run_policy.max_tokens,
        },
      );

      await applyJobRateLimitUsage({
        ctx,
        model: req.model,
        inputTokens: output.input_tokens,
        outputTokens: output.output_tokens,
      });

      await applyRequestSuccess({ ctx, req, output });
      await heartbeat?.();
    } catch (error: any) {
      const attemptIndex = req.attempt_index ?? 1;
      const didRetry = await applyRequestError({
        ctx,
        req,
        error: error?.message ?? "provider_error",
        attemptIndex,
        now,
      });
      if (didRetry) {
        anyPending = true;
      } else {
        anyErrors = true;
      }
      await heartbeat?.();
    }
  };

  let nextIndex = 0;
  const workerCount = Math.min(
    admitted.length,
    Math.max(1, ENGINE_SETTINGS.run_policy.job_request_concurrency),
  );
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < admitted.length) {
      const index = nextIndex;
      nextIndex += 1;
      await processRequest(admitted[index]!);
    }
  });
  await Promise.all(workers);

  return { anyPending, anyErrors };
}
