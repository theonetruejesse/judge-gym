import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { ExperimentsTableSchema } from "../../models/experiments";
import { buildRandomTag } from "../../utils/tags";
import type { Id } from "../../_generated/dataModel";

export const CreateExperimentArgsSchema = ExperimentsTableSchema.pick({
  pool_id: true,
  rubric_config: true,
  scoring_config: true,
});

export const createExperiment = zInternalMutation({
  args: CreateExperimentArgsSchema,
  returns: zid("experiments"),
  handler: async (ctx, args) => {
    return ctx.db.insert("experiments", {
      experiment_tag: buildRandomTag(),
      pool_id: args.pool_id,
      rubric_config: args.rubric_config,
      scoring_config: args.scoring_config,
      total_count: 0,
    });
  },
});

export const createPool = zInternalMutation({
  args: z.object({
    pool_tag: z.string().optional(),
    evidence_ids: z.array(zid("evidences")).min(1),
  }),
  returns: zid("pools"),
  handler: async (ctx, args) => {
    const poolTag = args.pool_tag ?? buildRandomTag();
    const existingPool = await ctx.db
      .query("pools")
      .withIndex("by_pool_tag", (q) => q.eq("pool_tag", poolTag))
      .first();
    if (existingPool) throw new Error(`Pool tag already exists: ${poolTag}`);

    const pool_id = await ctx.db.insert("pools", {
      pool_tag: poolTag,
    });

    const insertIds = new Set<Id<"evidences">>(args.evidence_ids);

    for (const evidence_id of insertIds) {
      await ctx.db.insert("pool_evidences", {
        pool_id,
        evidence_id,
      });
    }

    return pool_id;
  },
});

export const getPool = zInternalQuery({
  args: z.object({
    pool_id: zid("pools"),
  }),
  handler: async (ctx, args) => {
    const pool = await ctx.db.get(args.pool_id);
    if (!pool) throw new Error("Pool not found");
    return pool;
  },
});

export const listPools = zInternalQuery({
  args: z.object({}),
  handler: async (ctx) => {
    return ctx.db.query("pools").collect();
  },
});

export const listPoolEvidenceLinks = zInternalQuery({
  args: z.object({
    pool_id: zid("pools"),
  }),
  handler: async (ctx, args) => {
    return ctx.db
      .query("pool_evidences")
      .withIndex("by_pool", (q) => q.eq("pool_id", args.pool_id))
      .collect();
  },
});
