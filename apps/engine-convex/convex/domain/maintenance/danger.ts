import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { DataModel, Doc } from "../../_generated/dataModel";
import { zInternalMutation } from "../../utils/custom_fns";

const tableNames = [
  "llm_prompt_templates",
  "llm_attempts",
  "llm_attempt_payloads",
  "process_observability",
  "windows",
  "window_runs",
  "evidences",
  "pools",
  "pool_evidences",
  "bundle_plans",
  "bundle_plan_items",
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

const RunDeleteSummarySchema = z.object({
  runs: z.number(),
  samples: z.number(),
  sample_score_targets: z.number(),
  sample_score_target_items: z.number(),
  rubrics: z.number(),
  rubric_critics: z.number(),
  scores: z.number(),
  score_critics: z.number(),
  llm_attempts: z.number(),
  llm_attempt_payloads: z.number(),
  process_observability: z.number(),
});

type RunDeleteSummary = z.infer<typeof RunDeleteSummarySchema>;

function zeroRunDeleteSummary(): RunDeleteSummary {
  return {
    runs: 0,
    samples: 0,
    sample_score_targets: 0,
    sample_score_target_items: 0,
    rubrics: 0,
    rubric_critics: 0,
    scores: 0,
    score_critics: 0,
    llm_attempts: 0,
    llm_attempt_payloads: 0,
    process_observability: 0,
  };
}

async function deleteDocs(
  ctx: any,
  docs: Array<{ _id: unknown }>,
) {
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
}

async function listRunPayloads(
  ctx: any,
  attempts: Doc<"llm_attempts">[],
) {
  const payloadGroups = await Promise.all(
    attempts.map((attempt) =>
      ctx.db
        .query("llm_attempt_payloads")
        .withIndex("by_attempt", (q: any) => q.eq("attempt_id", attempt._id))
        .collect(),
    ),
  );
  return payloadGroups.flat();
}

async function listRunArtifacts(
  ctx: any,
  run_id: Doc<"runs">["_id"],
) {
  const [
    samples,
    scoreTargets,
    rubrics,
    rubricCritics,
    scores,
    scoreCritics,
    attempts,
    observabilityRows,
  ] = await Promise.all([
    ctx.db.query("samples").withIndex("by_run", (q: any) => q.eq("run_id", run_id)).collect(),
    ctx.db.query("sample_score_targets").withIndex("by_run", (q: any) => q.eq("run_id", run_id)).collect(),
    ctx.db.query("rubrics").withIndex("by_run", (q: any) => q.eq("run_id", run_id)).collect(),
    ctx.db.query("rubric_critics").withIndex("by_run", (q: any) => q.eq("run_id", run_id)).collect(),
    ctx.db.query("scores").withIndex("by_run", (q: any) => q.eq("run_id", run_id)).collect(),
    ctx.db.query("score_critics").withIndex("by_run", (q: any) => q.eq("run_id", run_id)).collect(),
    ctx.db
      .query("llm_attempts")
      .withIndex("by_process", (q: any) => q.eq("process_kind", "run").eq("process_id", String(run_id)))
      .collect(),
    ctx.db
      .query("process_observability")
      .withIndex("by_process", (q: any) => q.eq("process_type", "run").eq("process_id", String(run_id)))
      .collect(),
  ]);

  const [scoreTargetItems, payloads] = await Promise.all([
    Promise.all(
      scoreTargets.map((target: Doc<"sample_score_targets">) =>
        ctx.db
          .query("sample_score_target_items")
          .withIndex("by_score_target", (q: any) => q.eq("score_target_id", target._id))
          .collect(),
      ),
    ).then((groups) => groups.flat()),
    listRunPayloads(ctx, attempts),
  ]);

  return {
    samples,
    scoreTargets,
    scoreTargetItems,
    rubrics,
    rubricCritics,
    scores,
    scoreCritics,
    attempts,
    payloads,
    observabilityRows,
  };
}

async function deleteSingleRunData(
  ctx: any,
  args: {
    run_id: Doc<"runs">["_id"];
    isDryRun: boolean;
    allow_active: boolean;
  },
) {
  const trace_id = `run:${args.run_id}`;
  const run = await ctx.db.get(args.run_id);
  if (!run) {
    return {
      trace_id,
      deleted: zeroRunDeleteSummary(),
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

  const artifacts = await listRunArtifacts(ctx, args.run_id);
  const deleted = {
    runs: 1,
    samples: artifacts.samples.length,
    sample_score_targets: artifacts.scoreTargets.length,
    sample_score_target_items: artifacts.scoreTargetItems.length,
    rubrics: artifacts.rubrics.length,
    rubric_critics: artifacts.rubricCritics.length,
    scores: artifacts.scores.length,
    score_critics: artifacts.scoreCritics.length,
    llm_attempts: artifacts.attempts.length,
    llm_attempt_payloads: artifacts.payloads.length,
    process_observability: artifacts.observabilityRows.length,
  } satisfies RunDeleteSummary;

  if (!args.isDryRun) {
    await deleteDocs(ctx, artifacts.payloads);
    await deleteDocs(ctx, artifacts.observabilityRows);
    await deleteDocs(ctx, artifacts.scoreCritics);
    await deleteDocs(ctx, artifacts.scores);
    await deleteDocs(ctx, artifacts.rubricCritics);
    await deleteDocs(ctx, artifacts.rubrics);
    await deleteDocs(ctx, artifacts.scoreTargetItems);
    await deleteDocs(ctx, artifacts.scoreTargets);
    await deleteDocs(ctx, artifacts.samples);
    await deleteDocs(ctx, artifacts.attempts);
    await ctx.db.delete(run._id);
  }

  return {
    trace_id,
    deleted,
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
    const tables: Array<{ name: TableName; count: number }> = [];
    for (const tableName of tableNames) {
      const docs = await ctx.db.query(tableName).collect();
      tables.push({ name: tableName, count: docs.length });
      if (!args.isDryRun) {
        await deleteDocs(ctx, docs as Array<{ _id: unknown }>);
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
      await deleteDocs(ctx, docs as Array<{ _id: unknown }>);
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
    let total_deleted = 0;

    for (const tableName of tableNames) {
      const docs = await ctx.db.query(tableName).take(args.limitPerTable);
      if (!args.isDryRun) {
        await deleteDocs(ctx, docs as Array<{ _id: unknown }>);
      }
      total_deleted += docs.length;
      tables.push({
        name: tableName,
        deleted_count: docs.length,
        has_more: docs.length === args.limitPerTable,
      });
    }

    return {
      isDryRun: args.isDryRun,
      limitPerTable: args.limitPerTable,
      total_deleted,
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
    deleted: RunDeleteSummarySchema,
  }),
  handler: async (ctx, args) => {
    const result = await deleteSingleRunData(ctx, args);
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
    deleted: RunDeleteSummarySchema,
  }),
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", args.experiment_id))
      .collect();

    const deleted = zeroRunDeleteSummary();
    for (const run of runs) {
      const result = await deleteSingleRunData(ctx, {
        run_id: run._id,
        isDryRun: args.isDryRun,
        allow_active: args.allow_active,
      });
      deleted.runs += result.deleted.runs;
      deleted.samples += result.deleted.samples;
      deleted.sample_score_targets += result.deleted.sample_score_targets;
      deleted.sample_score_target_items += result.deleted.sample_score_target_items;
      deleted.rubrics += result.deleted.rubrics;
      deleted.rubric_critics += result.deleted.rubric_critics;
      deleted.scores += result.deleted.scores;
      deleted.score_critics += result.deleted.score_critics;
      deleted.llm_attempts += result.deleted.llm_attempts;
      deleted.llm_attempt_payloads += result.deleted.llm_attempt_payloads;
      deleted.process_observability += result.deleted.process_observability;
    }

    if (!args.isDryRun) {
      await ctx.db.patch(args.experiment_id, { total_count: 0 });
    }

    return {
      experiment_id: args.experiment_id,
      isDryRun: args.isDryRun,
      runs_found: runs.length,
      deleted,
    };
  },
});
