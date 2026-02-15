import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../platform/utils";
import { internal } from "../../../_generated/api";
import type { RunPolicy } from "../../../models/core";
import { modelTypeSchema, providerSchema } from "../../../models/core";
import { ENGINE_SETTINGS } from "../../../settings";
import type { Id } from "../../../_generated/dataModel";
import { selectBatchCandidates } from "./llm_calls_batch_queue_logic";

export const createBatchFromQueued: ReturnType<typeof zInternalMutation> =
  zInternalMutation({
  args: z.object({
    provider: providerSchema,
    model: modelTypeSchema,
    max_items: z.number().min(1).max(10000),
  }),
  returns: z.object({
    batch_id: zid("llm_batches").nullable(),
    run_id: zid("runs").optional(),
  }),
  handler: async (ctx, { provider, model, max_items }) => {
    const now = Date.now();
    const queued = await ctx.db
      .query("llm_requests")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();

    const needRuns = queued.some((req) => req.experiment_id);
    const running = needRuns
      ? await ctx.db
          .query("runs")
          .withIndex("by_status", (q) => q.eq("status", "running"))
          .collect()
      : [];
    const paused = needRuns
      ? await ctx.db
          .query("runs")
          .withIndex("by_status", (q) => q.eq("status", "paused"))
          .collect()
      : [];
    const pending = needRuns
      ? await ctx.db
          .query("runs")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect()
      : [];
    const candidates = running.concat(paused, pending);

    const activeSubmitted = await ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const activeRunning = await ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
    const activeByRun = new Map<string, number>();
    for (const batch of activeSubmitted.concat(activeRunning)) {
      if (!batch.run_id) continue;
      activeByRun.set(batch.run_id, (activeByRun.get(batch.run_id) ?? 0) + 1);
    }

    const policyByRun = new Map<string, RunPolicy>();
    for (const run of candidates) {
      if (policyByRun.has(run._id)) continue;
      const snapshot = run.policy_snapshot ?? ENGINE_SETTINGS.run_policy;
      policyByRun.set(run._id, snapshot);
    }

    const selection = selectBatchCandidates({
      queued,
      runs: candidates.map((run) => ({
        _id: run._id,
        experiment_id: run.experiment_id,
        desired_state: run.desired_state,
        stop_at_stage: run.stop_at_stage,
        updated_at: run.updated_at,
        policy: policyByRun.get(run._id) ?? ENGINE_SETTINGS.run_policy,
        active_batches: activeByRun.get(run._id) ?? 0,
      })),
      provider,
      model,
      max_items,
      now,
    });

    const items = selection.items;
    if (items.length === 0) return { batch_id: null, run_id: undefined };

    const batch_id = (await ctx.runMutation(
      internal.domain.llm_calls.llm_calls_batches.createBatch,
      {
        run_id: selection.run_id as Id<"runs"> | undefined,
        provider: provider as never,
        model: model as never,
        batch_ref: undefined,
        status: "queued",
        completion_window: undefined,
        created_at: Date.now(),
        locked_until: undefined,
        next_poll_at: undefined,
      },
    )) as Id<"llm_batches">;

    for (const [index, req] of items.entries()) {
      const custom_id = `${req._id}:${req.stage}:${index}`;
      const batch_item_id = await ctx.runMutation(
        internal.domain.llm_calls.llm_calls_batches.createBatchItem,
        {
          batch_id,
          request_id: req._id,
          custom_id,
          status: "queued",
          attempt: req.attempt,
          last_error: undefined,
        },
      );

      await ctx.runMutation(
        internal.domain.llm_calls.llm_calls_requests.patchLlmRequest,
        {
        request_id: req._id,
        status: "submitted",
        batch_item_id,
        },
      );
    }

    await ctx.runMutation(internal.domain.llm_calls.llm_calls_batches.patchBatch, {
      batch_id,
      status: "queued",
    });

    return { batch_id, run_id: selection.run_id as Id<"runs"> | undefined };
  },
});
