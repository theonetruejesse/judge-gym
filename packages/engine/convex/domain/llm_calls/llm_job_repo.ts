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
  args: z.object({}),
  handler: async (ctx): Promise<ActiveJobsResult> => {
    const queued = await ctx.db
      .query("llm_jobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    const running = await ctx.db
      .query("llm_jobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
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
