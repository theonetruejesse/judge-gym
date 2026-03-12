import z from "zod";
import { zInternalMutation } from "../../utils/custom_fns";
import { zid } from "convex-helpers/server/zod4";
import type { DataModel, Doc } from "../../_generated/dataModel";

const tableNames = [
  "llm_prompt_templates",
  "llm_batches",
  "llm_jobs",
  "llm_requests",
  "process_request_targets",
  "process_observability",
  "scheduler_locks",
  "windows",
  "evidences",
  "pools",
  "pool_evidences",
  "experiments",
  "runs",
  "samples",
  "rubrics",
  "rubric_critics",
  "scores",
  "score_critics",
  "sample_score_targets",
  "sample_score_target_items",
] as const satisfies ReadonlyArray<keyof DataModel>;

type TableName = (typeof tableNames)[number];
const tableNameEnum = z.enum(tableNames);

type TableDeletePlan = {
  name: TableName;
  count: number;
};

export const nukeTables = zInternalMutation({
  args: z.object({
    isDryRun: z.boolean().default(true),
  }),
  returns: z.object({
    isDryRun: z.boolean(),
    tables: z.array(
      z.object({
        name: tableNameEnum,
        count: z.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const tables: TableDeletePlan[] = [];

    for (const tableName of tableNames) {
      const docs = await ctx.db.query(tableName).collect();
      tables.push({ name: tableName, count: docs.length });

      if (!args.isDryRun) {
        for (const doc of docs as Doc<TableName>[]) {
          await ctx.db.delete(doc._id);
        }
      }
    }

    return { isDryRun: args.isDryRun, tables };
  },
});

export const nukeTableChunk = zInternalMutation({
  args: z.object({
    table: tableNameEnum,
    limit: z.number().int().min(1).max(10000).default(2000),
    isDryRun: z.boolean().default(true),
  }),
  returns: z.object({
    table: tableNameEnum,
    isDryRun: z.boolean(),
    requested_limit: z.number(),
    deleted_count: z.number(),
    has_more: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const docs = await ctx.db.query(args.table).take(args.limit);
    if (!args.isDryRun) {
      for (const doc of docs as Doc<TableName>[]) {
        await ctx.db.delete(doc._id);
      }
    }
    return {
      table: args.table,
      isDryRun: args.isDryRun,
      requested_limit: args.limit,
      deleted_count: docs.length,
      has_more: docs.length === args.limit,
    };
  },
});

export const nukeTablesPass = zInternalMutation({
  args: z.object({
    limitPerTable: z.number().int().min(1).max(10000).default(2000),
    isDryRun: z.boolean().default(true),
  }),
  returns: z.object({
    isDryRun: z.boolean(),
    limitPerTable: z.number(),
    total_deleted: z.number(),
    tables: z.array(
      z.object({
        name: tableNameEnum,
        deleted_count: z.number(),
        has_more: z.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const tables: Array<{ name: TableName; deleted_count: number; has_more: boolean }> = [];
    let totalDeleted = 0;

    for (const tableName of tableNames) {
      const docs = await ctx.db.query(tableName).take(args.limitPerTable);
      if (!args.isDryRun) {
        for (const doc of docs as Doc<TableName>[]) {
          await ctx.db.delete(doc._id);
        }
      }
      totalDeleted += docs.length;
      tables.push({
        name: tableName,
        deleted_count: docs.length,
        has_more: docs.length === args.limitPerTable,
      });
    }

    return {
      isDryRun: args.isDryRun,
      limitPerTable: args.limitPerTable,
      total_deleted: totalDeleted,
      tables,
    };
  },
});

export const deleteRunData = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    isDryRun: z.boolean().default(true),
    allow_active: z.boolean().default(false),
  }),
  returns: z.object({
    isDryRun: z.boolean(),
    run_id: zid("runs"),
    trace_id: z.string(),
      deleted: z.object({
        runs: z.number(),
        samples: z.number(),
        sample_score_targets: z.number(),
        sample_score_target_items: z.number(),
        rubrics: z.number(),
        rubric_critics: z.number(),
      scores: z.number(),
      score_critics: z.number(),
      llm_batches: z.number(),
      llm_jobs: z.number(),
      llm_requests: z.number(),
      process_request_targets: z.number(),
      process_observability: z.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const traceId = `run:${args.run_id}`;
    const isDryRun = args.isDryRun;

    const run = await ctx.db.get(args.run_id);
    if (!run) {
      return {
        isDryRun,
        run_id: args.run_id,
        trace_id: traceId,
        deleted: {
          runs: 0,
          samples: 0,
          sample_score_targets: 0,
          sample_score_target_items: 0,
          rubrics: 0,
          rubric_critics: 0,
          scores: 0,
          score_critics: 0,
          llm_batches: 0,
          llm_jobs: 0,
          llm_requests: 0,
          process_request_targets: 0,
          process_observability: 0,
        },
      };
    }

    const activeStatuses = new Set<Doc<"runs">["status"]>([
      "start",
      "queued",
      "running",
      "paused",
    ]);
    if (activeStatuses.has(run.status) && !args.allow_active) {
      throw new Error(
        `Refusing to delete active run ${args.run_id} with status=${run.status}. `
        + "Pass allow_active=true to override.",
      );
    }

    const [
      samples,
      scoreTargets,
      scoreTargetItems,
      rubrics,
      rubricCritics,
      scores,
      scoreCritics,
      runRequests,
      runTargetStateRows,
      processObservabilityRows,
      allBatches,
      allJobs,
    ] = await Promise.all([
      ctx.db.query("samples").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).collect(),
      ctx.db.query("sample_score_targets").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).collect(),
      ctx.db.query("sample_score_target_items").collect(),
      ctx.db.query("rubrics").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).collect(),
      ctx.db.query("rubric_critics").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).collect(),
      ctx.db.query("scores").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).collect(),
      ctx.db.query("score_critics").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).collect(),
      ctx.db.query("llm_requests").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).collect(),
      ctx.db.query("process_request_targets").withIndex("by_process", (q) =>
        q.eq("process_type", "run").eq("process_id", String(args.run_id)),
      ).collect(),
      ctx.db.query("process_observability").withIndex("by_process", (q) =>
        q.eq("process_type", "run").eq("process_id", String(args.run_id)),
      ).collect(),
      ctx.db.query("llm_batches").collect(),
      ctx.db.query("llm_jobs").collect(),
    ]);

    const runBatches = allBatches.filter((batch) => batch.custom_key.startsWith(`${traceId}:`));
    const runJobs = allJobs.filter((job) => job.custom_key.startsWith(`${traceId}:`));

    if (!isDryRun) {
      const docsToDelete = [
        ...scoreCritics,
        ...scores,
        ...rubricCritics,
        ...rubrics,
        ...scoreTargetItems.filter((item) => scoreTargets.some((target) => target._id === item.score_target_id)),
        ...scoreTargets,
        ...samples,
        ...runRequests,
        ...runBatches,
        ...runJobs,
        ...runTargetStateRows,
        ...processObservabilityRows,
        run,
      ];
      for (const doc of docsToDelete) {
        await ctx.db.delete(doc._id);
      }
    }

    return {
      isDryRun,
      run_id: args.run_id,
      trace_id: traceId,
      deleted: {
        runs: 1,
        samples: samples.length,
        sample_score_targets: scoreTargets.length,
        sample_score_target_items: scoreTargetItems.filter((item) =>
          scoreTargets.some((target) => target._id === item.score_target_id),
        ).length,
        rubrics: rubrics.length,
        rubric_critics: rubricCritics.length,
        scores: scores.length,
        score_critics: scoreCritics.length,
        llm_batches: runBatches.length,
        llm_jobs: runJobs.length,
        llm_requests: runRequests.length,
        process_request_targets: runTargetStateRows.length,
        process_observability: processObservabilityRows.length,
      },
    };
  },
});
