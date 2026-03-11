import z from "zod";
import {
  LlmRequestsTableSchema,
} from "../../models/llm_calls";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { zid } from "convex-helpers/server/zod4";
import { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { ENGINE_SETTINGS } from "../../settings";


const CreateLlmRequestArgsSchema = LlmRequestsTableSchema.pick({
  model: true,
  system_prompt_id: true,
  user_prompt: true,
  custom_key: true,
  attempt_index: true,
}).extend({
  system_prompt: z.string().optional(),
});

function hashPromptContent(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

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

export function classifyRequestError(error: string | null | undefined): string {
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

async function resolveRunIdForCustomKey(
  ctx: MutationCtx,
  customKey: string,
): Promise<Id<"runs"> | null> {
  const parsed = parseRequestCustomKey(customKey);
  if (!parsed) return null;
  const processRef = await resolveProcessForTarget(ctx, parsed);
  if (!processRef || processRef.process_type !== "run") return null;
  return processRef.process_id as Id<"runs">;
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
  const existing = await ctx.db
    .query("process_request_targets")
    .withIndex("by_custom_key", (q) => q.eq("custom_key", customKey))
    .first();

  if (requests.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return;
  }

  let oldestPendingTs: number | null = null;
  let latestRequest: Doc<"llm_requests"> | null = null;
  let activeRequest: Doc<"llm_requests"> | null = null;
  let successRequest: Doc<"llm_requests"> | null = null;
  let latestErrorRequest: Doc<"llm_requests"> | null = null;
  let historicalErrorCount = 0;

  for (const row of requests) {
    if (!latestRequest || row._creationTime > latestRequest._creationTime) {
      latestRequest = row;
    }

    if (row.status === "pending") {
      if (oldestPendingTs == null || row._creationTime < oldestPendingTs) {
        oldestPendingTs = row._creationTime;
      }
      if (!activeRequest || row._creationTime > activeRequest._creationTime) {
        activeRequest = row;
      }
      continue;
    }

    if (row.status === "success") {
      if (!successRequest || row._creationTime > successRequest._creationTime) {
        successRequest = row;
      }
      continue;
    }

    historicalErrorCount += 1;
    if (!latestErrorRequest || row._creationTime > latestErrorRequest._creationTime) {
      latestErrorRequest = row;
    }
  }

  const attemptCount = requests.length;
  const retryCount = Math.max(0, attemptCount - 1);
  const latestErrorClass = latestErrorRequest
    ? classifyRequestError(latestErrorRequest.last_error)
    : null;
  const latestErrorMessage = latestErrorRequest?.last_error ?? null;
  const resolution = activeRequest
    ? "pending"
    : successRequest
      ? "succeeded"
      : latestErrorRequest
        && (latestErrorRequest.attempt_index ?? 1) >= ENGINE_SETTINGS.run_policy.max_request_attempts
        ? "exhausted"
      : "retryable";

  const basePayload = {
    process_type: processRef.process_type,
    process_id: processRef.process_id,
    target_type: parsed.target_type,
    target_id: parsed.target_id,
    stage: parsed.stage,
    custom_key: customKey,
    resolution,
    active_request_id: activeRequest?._id ?? null,
    latest_request_id: latestRequest?._id ?? null,
    success_request_id: successRequest?._id ?? null,
    latest_error_request_id: latestErrorRequest?._id ?? null,
    attempt_count: attemptCount,
    retry_count: retryCount,
    historical_error_count: historicalErrorCount,
    oldest_pending_ts: oldestPendingTs,
    latest_error_class: latestErrorClass,
    latest_error_message: latestErrorMessage,
  } as const;

  if (existing) {
    const unchanged = existing.process_type === basePayload.process_type
      && existing.process_id === basePayload.process_id
      && existing.target_type === basePayload.target_type
      && existing.target_id === basePayload.target_id
      && existing.stage === basePayload.stage
      && existing.custom_key === basePayload.custom_key
      && existing.resolution === basePayload.resolution
      && existing.active_request_id === basePayload.active_request_id
      && existing.latest_request_id === basePayload.latest_request_id
      && existing.success_request_id === basePayload.success_request_id
      && existing.latest_error_request_id === basePayload.latest_error_request_id
      && existing.attempt_count === basePayload.attempt_count
      && existing.retry_count === basePayload.retry_count
      && existing.historical_error_count === basePayload.historical_error_count
      && existing.oldest_pending_ts === basePayload.oldest_pending_ts
      && existing.latest_error_class === basePayload.latest_error_class
      && existing.latest_error_message === basePayload.latest_error_message;
    if (unchanged) return;
    await ctx.db.patch(existing._id, {
      ...basePayload,
      updated_at_ms: Date.now(),
    });
    return;
  }
  await ctx.db.insert("process_request_targets", {
    ...basePayload,
    updated_at_ms: Date.now(),
  });
}

export const createLlmRequest = zInternalMutation({
  args: CreateLlmRequestArgsSchema,
  returns: zid("llm_requests"),
  handler: async (ctx, args) => {
    const run_id = await resolveRunIdForCustomKey(ctx, args.custom_key);
    let systemPromptId = args.system_prompt_id ?? null;
    if (!systemPromptId && args.system_prompt) {
      const contentHash = hashPromptContent(args.system_prompt);
      const existingTemplate = await ctx.db
        .query("llm_prompt_templates")
        .withIndex("by_content_hash", (q) => q.eq("content_hash", contentHash))
        .first();
      if (existingTemplate && existingTemplate.content === args.system_prompt) {
        systemPromptId = existingTemplate._id;
      } else {
        systemPromptId = await ctx.db.insert("llm_prompt_templates", {
          content_hash: contentHash,
          content: args.system_prompt,
        });
      }
    }
    const requestId = await ctx.db.insert("llm_requests", {
      model: args.model,
      user_prompt: args.user_prompt,
      custom_key: args.custom_key,
      system_prompt_id: systemPromptId,
      run_id,
      job_id: null,
      batch_id: null,
      status: "pending",
      attempt_index: args.attempt_index ?? 1,
    });
    await refreshProcessRequestTargetState(ctx, args.custom_key);
    return requestId;
  },
});

export const resolveRequestPrompts = zInternalQuery({
  args: z.object({
    request_ids: z.array(zid("llm_requests")).min(1),
  }),
  returns: z.array(z.object({
    request_id: zid("llm_requests"),
    system_prompt: z.string().nullable(),
    user_prompt: z.string(),
  })),
  handler: async (ctx, args) => {
    const resolved = [] as Array<{
      request_id: Id<"llm_requests">;
      system_prompt: string | null;
      user_prompt: string;
    }>;

    for (const requestId of args.request_ids) {
      const request = await ctx.db.get(requestId);
      if (!request) {
        throw new Error(`Request not found: ${requestId}`);
      }
      let systemPrompt: string | null = null;
      if (request.system_prompt_id) {
        const template = await ctx.db.get(request.system_prompt_id);
        if (!template) {
          throw new Error(`Prompt template not found for request ${requestId}`);
        }
        systemPrompt = template.content;
      }
      resolved.push({
        request_id: request._id,
        system_prompt: systemPrompt,
        user_prompt: request.user_prompt,
      });
    }

    return resolved;
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
  args: z.object({
    limit: z.number().int().positive().optional(),
  }),
  handler: async (ctx, args): Promise<Doc<"llm_requests">[]> => {
    const query = ctx.db
      .query("llm_requests")
      .withIndex("by_orphaned", (q) =>
        q.eq("status", "pending")
          .eq("batch_id", null)
          .eq("job_id", null),
      );
    return args.limit ? query.take(args.limit) : query.collect();
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
    const patch = { ...args.patch } as Partial<Doc<"llm_requests">>;
    if (patch.custom_key !== undefined) {
      patch.run_id = await resolveRunIdForCustomKey(ctx, patch.custom_key);
    }

    const patchEntries = Object.entries(patch);
    const changedEntries = patchEntries.filter(([key, value]) =>
      (request as Record<string, unknown>)[key] !== value,
    );
    if (changedEntries.length === 0) return;

    await ctx.db.patch(args.request_id, patch);

    const changedKeys = new Set(changedEntries.map(([key]) => key));
    const snapshotRelevant = changedKeys.has("status")
      || changedKeys.has("attempt_index")
      || changedKeys.has("last_error")
      || changedKeys.has("custom_key");
    if (!snapshotRelevant) return;

    const oldCustomKey = request.custom_key;
    const nextCustomKey = (patch.custom_key as string | undefined) ?? oldCustomKey;
    await refreshProcessRequestTargetState(ctx, oldCustomKey);
    if (nextCustomKey !== oldCustomKey) {
      await refreshProcessRequestTargetState(ctx, nextCustomKey);
    }
  },
});
