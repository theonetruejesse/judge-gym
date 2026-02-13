import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../../platform/utils";
import { batchAdapterRegistry } from "../../../platform/utils/batch_registry";
import { internal } from "../../../_generated/api";
import {
  DEFAULT_RUN_POLICY,
  providerSchema,
  type RunPolicy,
} from "../../../models/core";
import type { Doc } from "../../../_generated/dataModel";
import { computeRetryDecision } from "./batch_poll_logic";

const LOCK_MS = 60_000;

async function getPolicyForBatch(ctx: any, batch: Doc<"llm_batches">) {
  if (!batch.run_id) return DEFAULT_RUN_POLICY;
  const run = await ctx.db.get(batch.run_id);
  return run?.policy ?? DEFAULT_RUN_POLICY;
}

export const pollBatch: ReturnType<typeof zInternalAction> = zInternalAction({
  args: z.object({
    batch_id: zid("llm_batches"),
    provider: providerSchema,
  }),
  returns: z.object({
    status: z.string(),
    next_poll_at: z.number().optional(),
  }),
  handler: async (ctx, { batch_id, provider }) => {
    const batch = (await ctx.runQuery(internal.domain.llm_calls.llm_batches.getBatch, {
      batch_id,
    })) as Doc<"llm_batches">;
    if (!batch.batch_ref) throw new Error("Batch has no batch_ref");

    const now = Date.now();
    if (batch.locked_until && batch.locked_until > now) {
      return {
        status: batch.status,
        next_poll_at: batch.next_poll_at,
      };
    }

    await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatch, {
      batch_id: batch._id,
      locked_until: now + LOCK_MS,
    });

    const adapter = batchAdapterRegistry[provider as keyof typeof batchAdapterRegistry];
    const poll = await adapter.pollBatch(batch.batch_ref);
    const policy = await getPolicyForBatch(ctx, batch);

    if (poll.status === "running") {
      const next_poll_at = now + policy.poll_interval_ms;
      await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatch, {
        batch_id: batch._id,
        status: "running",
        next_poll_at,
        locked_until: undefined,
      });
      return { status: "running", next_poll_at };
    }

    if (poll.status === "error") {
      const items = await ctx.runQuery(internal.domain.llm_calls.llm_batches.listBatchItems, {
        batch_id: batch._id,
      });
      const retryCutoff = policy.max_batch_retries;
      for (const item of items) {
        await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatchItem, {
          batch_item_id: item._id,
          status: "error",
          last_error: poll.error ?? "batch_failed",
        });
        const req = await ctx.runQuery(internal.domain.llm_calls.llm_requests.getLlmRequest, {
          request_id: item.request_id,
        });
        const decision = computeRetryDecision({
          attempt: req.attempt ?? 0,
          max_retries: retryCutoff,
          now,
          backoff_ms: policy.retry_backoff_ms,
          error: poll.error ?? "batch_failed",
        });
        await ctx.runMutation(internal.domain.llm_calls.llm_requests.patchLlmRequest, {
          request_id: item.request_id,
          status: decision.status,
          attempt: decision.attempt,
          last_error: decision.last_error,
          batch_item_id: undefined,
          next_retry_at: decision.next_retry_at,
        });
      }
      await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatch, {
        batch_id: batch._id,
        status: "error",
        next_poll_at: undefined,
        locked_until: undefined,
      });
      return { status: "error" };
    }

    await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatch, {
      batch_id: batch._id,
      status: "completed",
      next_poll_at: undefined,
      locked_until: undefined,
    });

    if (poll.status === "completed" && poll.results) {
      await ctx.runMutation(internal.domain.llm_calls.workflows.batch_finalize.finalizeBatch, {
        batch_id: batch._id,
        provider,
        results: poll.results,
      });
    }

    return { status: "completed" };
  },
});
