import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";
import { getRateLimitKeysForModel, rateLimiter } from "../../platform/rate_limiter";
import type { ActionCtx } from "../../_generated/server";
import { getNextAttemptAt, getNextRunAt, shouldRunAt } from "../../utils/scheduling";

interface MarkJobRunningArgs {
  ctx: ActionCtx;
  job_id: Id<"llm_jobs">;
}

export async function markJobRunning(args: MarkJobRunningArgs) {
  const { ctx, job_id } = args;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_job_repo.patchJob,
    {
      job_id,
      patch: { status: "running" },
    },
  );
}

interface ScheduleJobRunArgs {
  ctx: ActionCtx;
  job_id: Id<"llm_jobs">;
  now: number;
}
export async function scheduleJobRun(args: ScheduleJobRunArgs) {
  const { ctx, job_id, now } = args;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_job_repo.patchJob,
    {
      job_id,
      patch: {
        status: "running",
        next_run_at: getNextRunAt(now),
      },
    },
  );
}

interface FinalizeJobArgs {
  ctx: ActionCtx;
  job_id: Id<"llm_jobs">;
  anyErrors: boolean;
}
export async function finalizeJob(args: FinalizeJobArgs) {
  const { ctx, job_id, anyErrors } = args;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_job_repo.patchJob,
    {
      job_id,
      patch: {
        status: anyErrors ? "error" : "success",
        next_run_at: undefined,
      },
    },
  );
}

interface DeferRequestForRateLimitArgs {
  ctx: ActionCtx;
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
  ctx: ActionCtx;
  req: Doc<"llm_requests">;
  output: RequestOutput;
}
export async function applyRequestSuccess(args: ApplyRequestSuccessArgs) {
  const { ctx, req, output } = args;
  await ctx.runMutation(
    internal.domain.window.window_service.applyRequestResult,
    {
      request_id: req._id,
      custom_key: req.custom_key,
      output: output.assistant_output,
      input_tokens: output.input_tokens,
      output_tokens: output.output_tokens,
    },
  );
}

interface ApplyRequestErrorArgs {
  ctx: ActionCtx;
  request_id: Id<"llm_requests">;
  error: string;
  attempts: number;
  now: number;
}
export async function applyRequestError(args: ApplyRequestErrorArgs) {
  const { ctx, request_id, error, attempts, now } = args;
  if (attempts < ENGINE_SETTINGS.run_policy.max_request_attempts) {
    await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.patchRequest,
      {
        request_id,
        patch: {
          status: "pending",
          attempts,
          last_error: error,
          next_attempt_at: getNextAttemptAt(now),
        },
      },
    );
    return true;
  }
  await ctx.runMutation(
    internal.domain.llm_calls.llm_request_repo.patchRequest,
    {
      request_id,
      patch: {
        status: "error",
        attempts,
        last_error: error,
      },
    },
  );
  return false;
}

interface RunJobRequestsArgs {
  ctx: ActionCtx;
  requests: Doc<"llm_requests">[];
  now: number;
}
export async function runJobRequests(args: RunJobRequestsArgs) {
  const { ctx, requests, now } = args;
  let anyPending = false;
  let anyErrors = false;
  for (const req of requests) {
    if (req.status !== "pending") continue;
    if (!shouldRunAt(req.next_attempt_at, now)) {
      anyPending = true;
      continue;
    }

    const keys = getRateLimitKeysForModel(req.model, "job");
    if (keys) {
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
    }

    try {
      const output = await ctx.runAction(
        internal.platform.providers.provider_services.openAiChatAction,
        {
          model: req.model,
          system_prompt: req.system_prompt ?? undefined,
          user_prompt: req.user_prompt,
          max_tokens: ENGINE_SETTINGS.run_policy.max_tokens,
        },
      );

      await applyRequestSuccess({ ctx, req, output });
    } catch (error: any) {
      const attempts = (req.attempts ?? 0) + 1;
      const didRetry = await applyRequestError({
        ctx,
        request_id: req._id,
        error: error?.message ?? "provider_error",
        attempts,
        now,
      });
      if (didRetry) {
        anyPending = true;
      } else {
        anyErrors = true;
      }
    }
  }

  return { anyPending, anyErrors };
}
