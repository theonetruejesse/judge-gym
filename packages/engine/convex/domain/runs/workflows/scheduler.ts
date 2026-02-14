import z from "zod";
import { zInternalMutation } from "../../../platform/utils";
import { internal } from "../../../_generated/api";
import { DEFAULT_RUN_POLICY } from "../../../models/core";
import { resolveRunPolicy } from "../../../utils/policy";
import type { Doc } from "../../../_generated/dataModel";
import type { MutationCtx } from "../../../_generated/server";

const SCHEDULER_KEY = "global";
const LOCK_MS = 30_000;
const MIN_DELAY_MS = 500;

export const ensureScheduler = zInternalMutation({
  args: z.object({ reason: z.string().optional() }),
  returns: z.object({ scheduled: z.boolean() }),
  handler: async (ctx) => {
    const now = Date.now();
    let state = await ctx.db
      .query("scheduler_state")
      .withIndex("by_key", (q) => q.eq("key", SCHEDULER_KEY))
      .unique();

    if (!state) {
      const id = await ctx.db.insert("scheduler_state", {
        key: SCHEDULER_KEY,
        locked_until: undefined,
        next_tick_at: undefined,
        updated_at: now,
      });
      state = await ctx.db.get(id);
    }

    if (state?.next_tick_at && state.next_tick_at > now) {
      return { scheduled: false };
    }

    const next_tick_at = now + MIN_DELAY_MS;
    await ctx.db.patch(state!._id, {
      next_tick_at,
      updated_at: now,
    });

    await ctx.scheduler.runAfter(
      MIN_DELAY_MS,
      internal.domain.runs.workflows.scheduler.tick,
      { scheduled_at: next_tick_at },
    );

    return { scheduled: true };
  },
});

export const tick = zInternalMutation({
  args: z.object({ scheduled_at: z.number().optional() }),
  returns: z.object({
    polled: z.number(),
    submitted: z.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const state = await ctx.db
      .query("scheduler_state")
      .withIndex("by_key", (q) => q.eq("key", SCHEDULER_KEY))
      .unique();
    if (!state) {
      return { polled: 0, submitted: 0 };
    }
    if (state.locked_until && state.locked_until > now) {
      return { polled: 0, submitted: 0 };
    }

    await ctx.db.patch(state._id, {
      locked_until: now + LOCK_MS,
      next_tick_at: undefined,
      updated_at: now,
    });

    const running = await ctx.db
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
    const activeRuns = running.concat(paused, pending);

    const policies = [];
    for (const run of activeRuns) {
      try {
        const runConfig = await ctx.runQuery(
          internal.domain.configs.repo.getRunConfig,
          { run_config_id: run.run_config_id },
        );
        policies.push(
          resolveRunPolicy({
            policies: runConfig.config_body.policies,
            team_id: runConfig.config_body.team_id,
          }),
        );
      } catch {
        policies.push(DEFAULT_RUN_POLICY);
      }
    }

    const schedulerPolicy = policies.reduce(
      (acc, policy) => ({
        poll_interval_ms: Math.min(acc.poll_interval_ms, policy.poll_interval_ms),
        max_batch_size: Math.max(acc.max_batch_size, policy.max_batch_size),
        max_new_batches_per_tick: Math.min(
          acc.max_new_batches_per_tick,
          policy.max_new_batches_per_tick,
        ),
        max_poll_per_tick: Math.min(
          acc.max_poll_per_tick,
          policy.max_poll_per_tick,
        ),
      }),
      {
        poll_interval_ms: DEFAULT_RUN_POLICY.poll_interval_ms,
        max_batch_size: DEFAULT_RUN_POLICY.max_batch_size,
        max_new_batches_per_tick: DEFAULT_RUN_POLICY.max_new_batches_per_tick,
        max_poll_per_tick: DEFAULT_RUN_POLICY.max_poll_per_tick,
      },
    );

    const due = (await ctx.runQuery(
      internal.domain.llm_calls.llm_batches.listBatchesDueForPolling,
      { now },
    )) as Doc<"llm_batches">[];

    const pollCounts = new Map<string, number>();
    let polled = 0;

    for (const batch of due) {
      if (polled >= schedulerPolicy.max_poll_per_tick) break;
      const policy = await resolvePolicyForBatch(ctx, batch);
      const key = batch.run_id ?? "none";
      const current = pollCounts.get(key) ?? 0;
      if (current >= policy.max_poll_per_tick) continue;
      pollCounts.set(key, current + 1);
      polled += 1;
      await ctx.scheduler.runAfter(
        0,
        internal.domain.llm_calls.workflows.batch_poll.pollBatch,
        { batch_id: batch._id, provider: batch.provider },
      );
    }

    const providerModels = new Map<string, { provider: string; model: string }>();
    for (const policy of policies) {
      for (const spec of policy.provider_models) {
        for (const model of spec.models) {
          providerModels.set(`${spec.provider}:${model}`, {
            provider: spec.provider,
            model,
          });
        }
      }
    }
    for (const spec of DEFAULT_RUN_POLICY.provider_models) {
      for (const model of spec.models) {
        providerModels.set(`${spec.provider}:${model}`, {
          provider: spec.provider,
          model,
        });
      }
    }

    let submitted = 0;
    for (const { provider, model } of providerModels.values()) {
      if (submitted >= schedulerPolicy.max_new_batches_per_tick) break;
      const { batch_id } = await ctx.runMutation(
        internal.domain.llm_calls.workflows.batch_queue.createBatchFromQueued,
        {
          provider: provider as never,
          model: model as never,
          max_items: schedulerPolicy.max_batch_size,
        },
      );
      if (!batch_id) continue;
      submitted += 1;
      await ctx.scheduler.runAfter(
        0,
        internal.domain.llm_calls.workflows.batch_submit.submitBatch,
        { batch_id, provider: provider as never },
      );
    }

    const nextDelay = Math.max(
      MIN_DELAY_MS,
      schedulerPolicy.poll_interval_ms,
    );
    const nextTickAt = Date.now() + nextDelay;
    await ctx.db.patch(state._id, {
      locked_until: undefined,
      next_tick_at: nextTickAt,
      updated_at: Date.now(),
    });
    await ctx.scheduler.runAfter(
      nextDelay,
      internal.domain.runs.workflows.scheduler.tick,
      { scheduled_at: nextTickAt },
    );

    return { polled, submitted };
  },
});

async function resolvePolicyForBatch(
  ctx: MutationCtx,
  batch: Doc<"llm_batches">,
) {
  if (!batch.run_id) return DEFAULT_RUN_POLICY;
  const run = await ctx.runQuery(internal.domain.runs.repo.getRun, {
    run_id: batch.run_id,
  });
  if (!run?.run_config_id) return DEFAULT_RUN_POLICY;
  const runConfig = await ctx.runQuery(
    internal.domain.configs.repo.getRunConfig,
    { run_config_id: run.run_config_id },
  );
  return resolveRunPolicy({
    policies: runConfig.config_body.policies,
    team_id: runConfig.config_body.team_id,
    provider: batch.provider,
    model: batch.model,
  });
}
