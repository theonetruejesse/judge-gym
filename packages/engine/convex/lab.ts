import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zAction, zMutation, zQuery } from "./platform/utils";
import { internal } from "./_generated/api";
import {
  LlmStageSchema,
  LlmRequestStatusSchema,
  modelTypeSchema,
  providerSchema,
} from "./models/core";

export const listQueuedRequests: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      request_id: zid("llm_requests"),
      provider: providerSchema,
      model: modelTypeSchema,
      stage: LlmStageSchema,
      experiment_id: zid("experiments").nullable(),
    }),
  ),
  handler: async (ctx) => {
    const queued = await ctx.db
      .query("llm_requests")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    return queued.map((req) => ({
      request_id: req._id,
      provider: req.provider,
      model: req.model,
      stage: req.stage,
      experiment_id: req.experiment_id,
    }));
  },
});

export const listBatchesDueForPolling: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ now: z.number() }),
  returns: z.array(
    z.object({
      batch_id: zid("llm_batches"),
      provider: providerSchema,
      model: modelTypeSchema,
      status: z.string(),
      next_poll_at: z.number().optional(),
    }),
  ),
  handler: async (ctx, { now }) => {
    const batches = await ctx.runQuery(
      internal.domain.llm_calls.llm_batches.listBatchesDueForPolling,
      { now },
    );
    return batches.map((batch: any) => ({
      batch_id: batch._id,
      provider: batch.provider,
      model: batch.model,
      status: batch.status,
      next_poll_at: batch.next_poll_at,
    }));
  },
});

export const createBatchFromQueued: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    provider: providerSchema,
    model: modelTypeSchema,
    max_items: z.number().min(1).max(10000),
  }),
  returns: z.object({ batch_id: zid("llm_batches").nullable() }),
  handler: async (ctx, args) => {
    return ctx.runMutation(
      internal.domain.llm_calls.workflows.batch_queue.createBatchFromQueued,
      args,
    );
  },
});

export const submitBatch: ReturnType<typeof zAction> = zAction({
  args: z.object({
    batch_id: zid("llm_batches"),
    provider: providerSchema,
  }),
  returns: z.object({ submitted: z.number() }),
  handler: async (ctx, args) => {
    return ctx.runAction(
      internal.domain.llm_calls.workflows.batch_submit.submitBatch,
      args,
    );
  },
});

export const pollBatch: ReturnType<typeof zAction> = zAction({
  args: z.object({
    batch_id: zid("llm_batches"),
    provider: providerSchema,
  }),
  returns: z.object({
    status: z.string(),
    next_poll_at: z.number().optional(),
  }),
  handler: async (ctx, args) => {
    return ctx.runAction(
      internal.domain.llm_calls.workflows.batch_poll.pollBatch,
      args,
    );
  },
});

export const getQueueStats: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.object({
    totals: z.record(z.string(), z.number()),
    by_stage: z.record(z.string(), z.record(z.string(), z.number())),
    by_provider_model: z.array(
      z.object({
        provider: providerSchema,
        model: modelTypeSchema,
        queued: z.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const requests = await ctx.db.query("llm_requests").collect();

    const totals: Record<string, number> = {
      queued: 0,
      submitted: 0,
      completed: 0,
      error: 0,
      canceled: 0,
    };

    const byStage = new Map<string, Record<string, number>>();
    const byProviderModel = new Map<string, { provider: string; model: string; queued: number }>();

    for (const req of requests) {
      totals[req.status] = (totals[req.status] ?? 0) + 1;
      if (!byStage.has(req.stage)) {
        byStage.set(req.stage, {
          queued: 0,
          submitted: 0,
          completed: 0,
          error: 0,
          canceled: 0,
        });
      }
      const stageCounts = byStage.get(req.stage)!;
      stageCounts[req.status] = (stageCounts[req.status] ?? 0) + 1;

      if (req.status === "queued") {
        const key = `${req.provider}:${req.model}`;
        const entry = byProviderModel.get(key) ?? {
          provider: req.provider,
          model: req.model,
          queued: 0,
        };
        entry.queued += 1;
        byProviderModel.set(key, entry);
      }
    }

    const byStageObj: Record<string, Record<string, number>> = {};
    for (const [stage, counts] of byStage.entries()) {
      byStageObj[stage] = counts;
    }

    return {
      totals: totals as Record<z.infer<typeof LlmRequestStatusSchema>, number>,
      by_stage: byStageObj as Record<
        z.infer<typeof LlmStageSchema>,
        Record<z.infer<typeof LlmRequestStatusSchema>, number>
      >,
      by_provider_model: Array.from(byProviderModel.values()) as Array<{
        provider: z.infer<typeof providerSchema>;
        model: z.infer<typeof modelTypeSchema>;
        queued: number;
      }>,
    };
  },
});

export const listRuns: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      run_id: zid("runs"),
      experiment_tag: z.string(),
      status: z.string(),
      desired_state: z.string(),
      current_stage: LlmStageSchema.optional(),
      stop_at_stage: LlmStageSchema.optional(),
      updated_at: z.number().optional(),
    }),
  ),
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
    const paused = await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "paused"))
      .collect();
    const pending = await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const all = runs.concat(paused, pending);
    const experiments = new Map<string, string>();

    for (const run of all) {
      if (!experiments.has(run.experiment_id)) {
        const experiment = await ctx.db.get(run.experiment_id);
        experiments.set(run.experiment_id, experiment?.experiment_tag ?? run.experiment_id);
      }
    }

    return all.map((run) => ({
      run_id: run._id,
      experiment_tag: experiments.get(run.experiment_id) ?? run.experiment_id,
      status: run.status,
      desired_state: run.desired_state,
      current_stage: run.current_stage ?? undefined,
      stop_at_stage: run.stop_at_stage ?? undefined,
      updated_at: run.updated_at,
    }));
  },
});
