import z from "zod";
import {
  LlmRequestsTableSchema,
} from "../../models/llm_calls";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { zid } from "convex-helpers/server/zod4";
import { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";


const CreateLlmRequestArgsSchema = LlmRequestsTableSchema.pick({
  model: true,
  system_prompt: true,
  user_prompt: true,
  custom_key: true,
  attempts: true,
});

type ParsedRequestCustomKey = {
  target_type: "sample" | "sample_evidence" | "evidence";
  target_id: string;
  stage: string;
};

type ResolvedProcessRef = {
  process_type: "run" | "window";
  process_id: string;
};

function parseRequestCustomKey(customKey: string): ParsedRequestCustomKey | null {
  const [targetType, targetId, stage] = customKey.split(":");
  if (!targetId || !stage) return null;
  if (targetType !== "sample" && targetType !== "sample_evidence" && targetType !== "evidence") {
    return null;
  }
  return {
    target_type: targetType,
    target_id: targetId,
    stage,
  };
}

function classifyError(error: string | null | undefined): string {
  const value = String(error ?? "").toLowerCase();
  if (!value) return "unknown";
  if (value.includes("parse")) return "parse_error";
  if (value.includes("timeout")) return "timeout";
  if (value.includes("rate limit") || value.includes("429")) return "rate_limit";
  if (value.includes("too many bytes read") || value.includes("convex") || value.includes("orchestrator")) {
    return "orchestrator_error";
  }
  if (value.includes("provider") || value.includes("api") || value.includes("openai") || value.includes("5xx")) {
    return "api_error";
  }
  return "unknown";
}

async function resolveProcessForTarget(
  ctx: MutationCtx,
  parsed: ParsedRequestCustomKey,
): Promise<ResolvedProcessRef | null> {
  if (parsed.target_type === "sample") {
    const sample = await ctx.db.get(parsed.target_id as Id<"samples">);
    if (!sample) return null;
    return {
      process_type: "run",
      process_id: String(sample.run_id),
    };
  }
  if (parsed.target_type === "sample_evidence") {
    const scoreUnit = await ctx.db.get(parsed.target_id as Id<"sample_evidence_scores">);
    if (!scoreUnit) return null;
    return {
      process_type: "run",
      process_id: String(scoreUnit.run_id),
    };
  }
  const evidence = await ctx.db.get(parsed.target_id as Id<"evidences">);
  if (!evidence) return null;
  return {
    process_type: "window",
    process_id: String(evidence.window_id),
  };
}

async function refreshProcessRequestTargetState(
  ctx: MutationCtx,
  customKey: string,
): Promise<void> {
  const parsed = parseRequestCustomKey(customKey);
  if (!parsed) return;

  const processRef = await resolveProcessForTarget(ctx, parsed);
  if (!processRef) return;

  const requests = await ctx.db
    .query("llm_requests")
    .withIndex("by_custom_key", (q) => q.eq("custom_key", customKey))
    .collect();

  let hasPending = false;
  let oldestPendingTs: number | null = null;
  let maxAttempts = 0;
  let latestErrorClass: string | null = null;
  let latestErrorMessage: string | null = null;
  let latestErrorAttempts = -1;
  let latestErrorTs = -1;

  for (const row of requests) {
    const attempts = row.attempts ?? 0;
    if (attempts > maxAttempts) maxAttempts = attempts;

    if (row.status === "pending") {
      hasPending = true;
      if (oldestPendingTs == null || row._creationTime < oldestPendingTs) {
        oldestPendingTs = row._creationTime;
      }
      continue;
    }

    if (row.status !== "error") continue;
    if (
      attempts > latestErrorAttempts
      || (attempts === latestErrorAttempts && row._creationTime > latestErrorTs)
    ) {
      latestErrorAttempts = attempts;
      latestErrorTs = row._creationTime;
      latestErrorClass = classifyError(row.last_error);
      latestErrorMessage = row.last_error ?? null;
    }
  }

  const existing = await ctx.db
    .query("process_request_targets")
    .withIndex("by_custom_key", (q) => q.eq("custom_key", customKey))
    .first();

  const payload = {
    process_type: processRef.process_type,
    process_id: processRef.process_id,
    target_type: parsed.target_type,
    target_id: parsed.target_id,
    stage: parsed.stage,
    custom_key: customKey,
    has_pending: hasPending,
    oldest_pending_ts: oldestPendingTs,
    max_attempts: maxAttempts,
    latest_error_class: latestErrorClass,
    latest_error_message: latestErrorMessage,
    updated_at_ms: Date.now(),
  } as const;

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return;
  }
  await ctx.db.insert("process_request_targets", payload);
}

export const createLlmRequest = zInternalMutation({
  args: CreateLlmRequestArgsSchema,
  returns: zid("llm_requests"),
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert("llm_requests", {
      ...args,
      job_id: null,
      batch_id: null,
      status: "pending",
      attempts: args.attempts ?? 0,
    });
    await refreshProcessRequestTargetState(ctx, args.custom_key);
    return requestId;
  },
});

export const getLlmRequest = zInternalQuery({
  args: z.object({ request_id: zid("llm_requests") }),
  handler: async (ctx, args): Promise<Doc<"llm_requests">> => {
    const request = await ctx.db.get(args.request_id);
    if (!request) throw new Error("Request not found");
    return request;
  },
});

export const listOrphanedRequests = zInternalQuery({
  args: z.object({}),
  handler: async (ctx): Promise<Doc<"llm_requests">[]> => {
    return ctx.db
      .query("llm_requests")
      .withIndex("by_orphaned", (q) =>
        q.eq("status", "pending")
          .eq("batch_id", null)
          .eq("job_id", null),
      )
      .collect();
  },
});

export const patchRequest = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
    patch: LlmRequestsTableSchema.partial(),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.request_id);
    if (!request) throw new Error("Request not found");
    await ctx.db.patch(args.request_id, args.patch);
    await refreshProcessRequestTargetState(ctx, request.custom_key);
  },
});
