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

type RunDeleteSummary = {
  runs: number;
  samples: number;
  sample_score_targets: number;
  sample_score_target_items: number;
  rubrics: number;
  rubric_critics: number;
  scores: number;
  score_critics: number;
  llm_batches: number;
  llm_jobs: number;
  llm_requests: number;
  process_request_targets: number;
  process_observability: number;
};

async function deleteSingleRunData(
  ctx: any,
  args: {
    run_id: Doc<"runs">["_id"];
    isDryRun: boolean;
    allow_active: boolean;
  },
): Promise<{
  trace_id: string;
  deleted: RunDeleteSummary;
}> {
  const traceId = `run:${args.run_id}`;
  const isDryRun = args.isDryRun;

  const run = await ctx.db.get(args.run_id);
  if (!run) {
    return {
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
    ctx.db.query("samples").withIndex("by_run", (q: any) => q.eq("run_id", args.run_id)).collect(),
    ctx.db.query("sample_score_targets").withIndex("by_run", (q: any) => q.eq("run_id", args.run_id)).collect(),
    ctx.db.query("sample_score_target_items").collect(),
    ctx.db.query("rubrics").withIndex("by_run", (q: any) => q.eq("run_id", args.run_id)).collect(),
    ctx.db.query("rubric_critics").withIndex("by_run", (q: any) => q.eq("run_id", args.run_id)).collect(),
    ctx.db.query("scores").withIndex("by_run", (q: any) => q.eq("run_id", args.run_id)).collect(),
    ctx.db.query("score_critics").withIndex("by_run", (q: any) => q.eq("run_id", args.run_id)).collect(),
    ctx.db.query("llm_requests").withIndex("by_run", (q: any) => q.eq("run_id", args.run_id)).collect(),
    ctx.db.query("process_request_targets").withIndex("by_process", (q: any) =>
      q.eq("process_type", "run").eq("process_id", String(args.run_id)),
    ).collect(),
    ctx.db.query("process_observability").withIndex("by_process", (q: any) =>
      q.eq("process_type", "run").eq("process_id", String(args.run_id)),
    ).collect(),
    ctx.db.query("llm_batches").collect(),
    ctx.db.query("llm_jobs").collect(),
  ]);

  const runBatches = allBatches.filter((batch: Doc<"llm_batches">) => batch.custom_key.startsWith(`${traceId}:`));
  const runJobs = allJobs.filter((job: Doc<"llm_jobs">) => job.custom_key.startsWith(`${traceId}:`));
  const ownedScoreTargetItems = scoreTargetItems.filter((item: Doc<"sample_score_target_items">) =>
    scoreTargets.some((target: Doc<"sample_score_targets">) => target._id === item.score_target_id),
  );

  if (!isDryRun) {
    const docsToDelete = [
      ...scoreCritics,
      ...scores,
      ...rubricCritics,
      ...rubrics,
      ...ownedScoreTargetItems,
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
    trace_id: traceId,
    deleted: {
      runs: 1,
      samples: samples.length,
      sample_score_targets: scoreTargets.length,
      sample_score_target_items: ownedScoreTargetItems.length,
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
}

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
    const result = await deleteSingleRunData(ctx, {
      run_id: args.run_id,
      isDryRun: args.isDryRun,
      allow_active: args.allow_active,
    });

    return {
      isDryRun: args.isDryRun,
      run_id: args.run_id,
      trace_id: result.trace_id,
      deleted: result.deleted,
    };
  },
});

export const deleteExperimentRunData = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    isDryRun: z.boolean().default(true),
    allow_active: z.boolean().default(false),
  }),
  returns: z.object({
    experiment_id: zid("experiments"),
    isDryRun: z.boolean(),
    runs_found: z.number(),
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
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", args.experiment_id))
      .collect();

    const aggregate = {
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
    };

    for (const run of runs) {
      const result = await deleteSingleRunData(ctx, {
        run_id: run._id,
        isDryRun: args.isDryRun,
        allow_active: args.allow_active,
      });
      aggregate.runs += result.deleted.runs;
      aggregate.samples += result.deleted.samples;
      aggregate.sample_score_targets += result.deleted.sample_score_targets;
      aggregate.sample_score_target_items += result.deleted.sample_score_target_items;
      aggregate.rubrics += result.deleted.rubrics;
      aggregate.rubric_critics += result.deleted.rubric_critics;
      aggregate.scores += result.deleted.scores;
      aggregate.score_critics += result.deleted.score_critics;
      aggregate.llm_batches += result.deleted.llm_batches;
      aggregate.llm_jobs += result.deleted.llm_jobs;
      aggregate.llm_requests += result.deleted.llm_requests;
      aggregate.process_request_targets += result.deleted.process_request_targets;
      aggregate.process_observability += result.deleted.process_observability;
    }

    if (!args.isDryRun) {
      await ctx.db.patch(args.experiment_id, { total_count: 0 });
    }

    return {
      experiment_id: args.experiment_id,
      isDryRun: args.isDryRun,
      runs_found: runs.length,
      deleted: aggregate,
    };
  },
});
