import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { LlmBatchesTableSchema } from "../../models/llm_calls";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import type { Doc } from "../../_generated/dataModel";

const CreateLlmBatchArgsSchema = LlmBatchesTableSchema.pick({
  provider: true,
  model: true,
  custom_key: true,
});

export const createLlmBatch = zInternalMutation({
  args: CreateLlmBatchArgsSchema,
  returns: zid("llm_batches"),
  handler: async (ctx, args) => {
    return ctx.db.insert("llm_batches", {
      ...args,
      status: "queued",
      attempt_index: 1,
    });
  },
});

export const assignRequestsToBatch = zInternalMutation({
  args: z.object({
    request_ids: z.array(zid("llm_requests")),
    batch_id: zid("llm_batches"),
  }),
  handler: async (ctx, args) => {
    for (const requestId of args.request_ids) {
      await ctx.db.patch(requestId, { batch_id: args.batch_id });
    }
  },
});

export type ActiveBatchesResult = {
  queued_batches: Doc<"llm_batches">[];
  running_batches: Doc<"llm_batches">[];
};

export const listActiveBatches = zInternalQuery({
  args: z.object({
    queued_limit: z.number().int().positive().optional(),
    running_limit: z.number().int().positive().optional(),
  }),
  handler: async (ctx, args): Promise<ActiveBatchesResult> => {
    const queuedQuery = ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "queued"));
    const runningQuery = ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "running"));
    const submittingQuery = ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "submitting"));
    const finalizingQuery = ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "finalizing"));
    const [queued, running, submitting, finalizing] = await Promise.all([
      args.queued_limit ? queuedQuery.take(args.queued_limit) : queuedQuery.collect(),
      args.running_limit ? runningQuery.take(args.running_limit) : runningQuery.collect(),
      args.running_limit ? submittingQuery.take(args.running_limit) : submittingQuery.collect(),
      args.running_limit ? finalizingQuery.take(args.running_limit) : finalizingQuery.collect(),
    ]);
    return {
      queued_batches: queued,
      running_batches: running.concat(submitting, finalizing),
    };
  },
});

export type BatchWithRequestsResult = {
  batch: Doc<"llm_batches">;
  requests: Doc<"llm_requests">[];
};
export const getBatchWithRequests = zInternalQuery({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, args): Promise<BatchWithRequestsResult> => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) throw new Error("Batch not found");
    const requests = await ctx.db
      .query("llm_requests")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", args.batch_id))
      .collect();
    return { batch, requests };
  },
});

export const patchBatch = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    patch: LlmBatchesTableSchema.partial(),
  }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.batch_id, args.patch);
  },
});

export const claimRunningBatchForPoll = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().min(1),
  }),
  returns: z.object({
    claimed: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { claimed: false };
    if (
      batch.status !== "submitting"
      && batch.status !== "running"
      && batch.status !== "finalizing"
    ) {
      return { claimed: false };
    }

    const claimOwner = batch.poll_claim_owner ?? null;
    const claimExpiresAt = batch.poll_claim_expires_at ?? null;
    const claimActive = claimOwner !== null
      && claimExpiresAt !== null
      && claimExpiresAt > args.now;

    if (claimActive && claimOwner !== args.owner) {
      return { claimed: false };
    }

    await ctx.db.patch(args.batch_id, {
      poll_claim_owner: args.owner,
      poll_claim_expires_at: args.now + args.lease_ms,
    });

    return { claimed: true };
  },
});

export const markBatchSubmitting = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().min(1),
    submission_id: z.string(),
  }),
  returns: z.object({
    ok: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { ok: false };
    if (batch.status !== "queued" && batch.status !== "submitting") {
      return { ok: false };
    }
    if (batch.poll_claim_owner !== args.owner) return { ok: false };
    await ctx.db.patch(args.batch_id, {
      status: "submitting",
      attempt_index: batch.attempt_index,
      submission_id: batch.submission_id ?? args.submission_id,
      submitting_at: batch.submitting_at ?? args.now,
      next_poll_at: args.now,
      poll_claim_owner: args.owner,
      poll_claim_expires_at: args.now + args.lease_ms,
    });
    return { ok: true };
  },
});

export const findSupersedingBatch = zInternalQuery({
  args: z.object({
    batch_id: zid("llm_batches"),
    custom_key: z.string(),
  }),
  returns: z.object({
    batch_id: zid("llm_batches"),
    status: z.enum(["running", "finalizing", "success"]),
    batch_ref: z.string(),
  }).nullable(),
  handler: async (ctx, args) => {
    const [running, finalizing, success] = await Promise.all([
      ctx.db
        .query("llm_batches")
        .withIndex("by_custom_key_status", (q) => q.eq("custom_key", args.custom_key).eq("status", "running"))
        .collect(),
      ctx.db
        .query("llm_batches")
        .withIndex("by_custom_key_status", (q) => q.eq("custom_key", args.custom_key).eq("status", "finalizing"))
        .collect(),
      ctx.db
        .query("llm_batches")
        .withIndex("by_custom_key_status", (q) => q.eq("custom_key", args.custom_key).eq("status", "success"))
        .collect(),
    ]);

    const candidate = [...running, ...finalizing, ...success]
      .filter((row) => row._id !== args.batch_id && typeof row.batch_ref === "string" && row.batch_ref.length > 0)
      .sort((left, right) => right._creationTime - left._creationTime)[0];

    if (!candidate || !candidate.batch_ref) return null;
    return {
      batch_id: candidate._id,
      status: candidate.status as "running" | "finalizing" | "success",
      batch_ref: candidate.batch_ref,
    };
  },
});

export const claimQueuedBatchForSubmit = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().min(1),
  }),
  returns: z.object({
    claimed: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { claimed: false };
    if (batch.status !== "queued") return { claimed: false };

    const claimOwner = batch.poll_claim_owner ?? null;
    const claimExpiresAt = batch.poll_claim_expires_at ?? null;
    const claimActive = claimOwner !== null
      && claimExpiresAt !== null
      && claimExpiresAt > args.now;

    if (claimActive && claimOwner !== args.owner) {
      return { claimed: false };
    }

    await ctx.db.patch(args.batch_id, {
      poll_claim_owner: args.owner,
      poll_claim_expires_at: args.now + args.lease_ms,
    });

    return { claimed: true };
  },
});

export const markBatchFinalizing = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().min(1),
  }),
  returns: z.object({
    ok: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { ok: false };
    if (batch.status !== "running" && batch.status !== "finalizing") {
      return { ok: false };
    }
    if (batch.poll_claim_owner !== args.owner) return { ok: false };

    await ctx.db.patch(args.batch_id, {
      status: "finalizing",
      poll_claim_owner: args.owner,
      poll_claim_expires_at: args.now + args.lease_ms,
      next_poll_at: args.now,
    });

    return { ok: true };
  },
});

export const releaseBatchPollClaim = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return;
    if (batch.poll_claim_owner !== args.owner) return;
    await ctx.db.patch(args.batch_id, {
      poll_claim_owner: null,
      poll_claim_expires_at: null,
    });
  },
});

export const renewBatchPollClaim = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().positive(),
  }),
  returns: z.object({
    renewed: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch || batch.poll_claim_owner !== args.owner) return { renewed: false };
    if (
      batch.status !== "queued"
      && batch.status !== "submitting"
      && batch.status !== "running"
      && batch.status !== "finalizing"
    ) {
      return { renewed: false };
    }
    await ctx.db.patch(args.batch_id, {
      poll_claim_expires_at: args.now + args.lease_ms,
    });
    return { renewed: true };
  },
});

export const releaseExpiredBatchPollClaim = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    now: z.number(),
  }),
  returns: z.object({
    released: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { released: false };
    const claimOwner = batch.poll_claim_owner ?? null;
    const claimExpiresAt = batch.poll_claim_expires_at ?? null;
    if (claimOwner == null || claimExpiresAt == null) return { released: false };
    if (claimExpiresAt > args.now) return { released: false };

    await ctx.db.patch(args.batch_id, {
      poll_claim_owner: null,
      poll_claim_expires_at: null,
    });
    return { released: true };
  },
});

export const nudgeBatchPollNow = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    now: z.number(),
  }),
  returns: z.object({
    nudged: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { nudged: false };
    if (
      batch.status !== "submitting"
      && batch.status !== "running"
      && batch.status !== "finalizing"
    ) {
      return { nudged: false };
    }
    await ctx.db.patch(args.batch_id, { next_poll_at: args.now });
    return { nudged: true };
  },
});
