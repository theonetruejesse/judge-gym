import z from "zod";
import type { Doc } from "../../_generated/dataModel";
import { zid } from "convex-helpers/server/zod4";
import { LlmJobsTableSchema } from "../../models/llm_calls";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";

const CreateLlmJobArgsSchema = LlmJobsTableSchema.pick({
  provider: true,
  model: true,
  custom_key: true,
});

export const createLlmJob = zInternalMutation({
  args: CreateLlmJobArgsSchema,
  returns: zid("llm_jobs"),
  handler: async (ctx, args) => {
    return ctx.db.insert("llm_jobs", {
      ...args,
      status: "queued",
      attempt_index: 1,
      run_claim_owner: null,
      run_claim_expires_at: null,
    });
  },
});

export const assignRequestsToJob = zInternalMutation({
  args: z.object({
    request_ids: z.array(zid("llm_requests")),
    job_id: zid("llm_jobs"),
  }),
  handler: async (ctx, args) => {
    for (const requestId of args.request_ids) {
      await ctx.db.patch(requestId, { job_id: args.job_id });
    }
  },
});

export type ActiveJobsResult = {
  queued_jobs: Doc<"llm_jobs">[];
  running_jobs: Doc<"llm_jobs">[];
};

export const listActiveJobs = zInternalQuery({
  args: z.object({
    queued_limit: z.number().int().positive().optional(),
    running_limit: z.number().int().positive().optional(),
  }),
  handler: async (ctx, args): Promise<ActiveJobsResult> => {
    const queuedQuery = ctx.db
      .query("llm_jobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"));
    const runningQuery = ctx.db
      .query("llm_jobs")
      .withIndex("by_status", (q) => q.eq("status", "running"));
    const [queued, running] = await Promise.all([
      args.queued_limit ? queuedQuery.take(args.queued_limit) : queuedQuery.collect(),
      args.running_limit ? runningQuery.take(args.running_limit) : runningQuery.collect(),
    ]);
    return {
      queued_jobs: queued,
      running_jobs: running,
    };
  },
});

export const getJobWithRequests = zInternalQuery({
  args: z.object({ job_id: zid("llm_jobs") }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.job_id);
    if (!job) throw new Error("Job not found");
    const requests = await ctx.db
      .query("llm_requests")
      .withIndex("by_job_id", (q) => q.eq("job_id", args.job_id))
      .collect();
    return { job, requests };
  },
});

export const patchJob = zInternalMutation({
  args: z.object({
    job_id: zid("llm_jobs"),
    patch: LlmJobsTableSchema.partial(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.job_id, args.patch);
    return null;
  },
});

export const claimQueuedJobForRun = zInternalMutation({
  args: z.object({
    job_id: zid("llm_jobs"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().positive(),
  }),
  returns: z.object({
    claimed: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.job_id);
    if (!job || job.status !== "queued") return { claimed: false };

    const hasActiveClaim = job.run_claim_owner != null
      && job.run_claim_expires_at != null
      && job.run_claim_expires_at > args.now;
    if (hasActiveClaim && job.run_claim_owner !== args.owner) {
      return { claimed: false };
    }

    await ctx.db.patch(args.job_id, {
      run_claim_owner: args.owner,
      run_claim_expires_at: args.now + args.lease_ms,
    });
    return { claimed: true };
  },
});

export const claimRunningJobForRun = zInternalMutation({
  args: z.object({
    job_id: zid("llm_jobs"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().positive(),
  }),
  returns: z.object({
    claimed: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.job_id);
    if (!job || job.status !== "running") return { claimed: false };

    const hasActiveClaim = job.run_claim_owner != null
      && job.run_claim_expires_at != null
      && job.run_claim_expires_at > args.now;
    if (hasActiveClaim && job.run_claim_owner !== args.owner) {
      return { claimed: false };
    }

    await ctx.db.patch(args.job_id, {
      run_claim_owner: args.owner,
      run_claim_expires_at: args.now + args.lease_ms,
    });
    return { claimed: true };
  },
});

export const releaseJobRunClaim = zInternalMutation({
  args: z.object({
    job_id: zid("llm_jobs"),
    owner: z.string(),
  }),
  returns: z.object({
    released: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.job_id);
    if (!job) return { released: false };
    if (job.run_claim_owner !== args.owner) return { released: false };
    await ctx.db.patch(args.job_id, {
      run_claim_owner: null,
      run_claim_expires_at: null,
    });
    return { released: true };
  },
});

export const renewJobRunClaim = zInternalMutation({
  args: z.object({
    job_id: zid("llm_jobs"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().positive(),
  }),
  returns: z.object({
    renewed: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.job_id);
    if (!job || job.run_claim_owner !== args.owner) return { renewed: false };
    if (job.status !== "queued" && job.status !== "running") {
      return { renewed: false };
    }
    await ctx.db.patch(args.job_id, {
      run_claim_expires_at: args.now + args.lease_ms,
    });
    return { renewed: true };
  },
});

export const finalizeJobIfClaimedAndRunning = zInternalMutation({
  args: z.object({
    job_id: zid("llm_jobs"),
    owner: z.string(),
    any_errors: z.boolean(),
    now: z.number(),
  }),
  returns: z.object({
    finalized: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.job_id);
    if (!job || job.status !== "running") return { finalized: false };

    const hasValidClaim = job.run_claim_owner === args.owner
      && job.run_claim_expires_at != null
      && job.run_claim_expires_at > args.now;
    if (!hasValidClaim) return { finalized: false };

    await ctx.db.patch(args.job_id, {
      status: args.any_errors ? "error" : "success",
      next_run_at: undefined,
      run_claim_owner: null,
      run_claim_expires_at: null,
    });
    return { finalized: true };
  },
});
