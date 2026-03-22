import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { DataModel, Doc } from "../../_generated/dataModel";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";

const tableNames = [
  "llm_prompt_templates",
  "llm_batch_executions",
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
  llm_batch_executions: z.number(),
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
    llm_batch_executions: 0,
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
    batchExecutions,
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
      .query("llm_batch_executions")
      .withIndex("by_process_stage", (q: any) => q.eq("process_kind", "run").eq("process_id", String(run_id)))
      .collect(),
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
    ctx.db
      .query("sample_score_target_items")
      .withIndex("by_run", (q: any) => q.eq("run_id", run_id))
      .collect(),
    ctx.db
      .query("llm_attempt_payloads")
      .withIndex("by_process", (q: any) => q.eq("process_kind", "run").eq("process_id", String(run_id)))
      .collect(),
  ]);

  return {
    samples,
    scoreTargets,
    scoreTargetItems,
    rubrics,
    rubricCritics,
    scores,
    scoreCritics,
    batchExecutions,
    attempts,
    payloads,
    observabilityRows,
  };
}

async function deleteChunk(
  ctx: any,
  table: keyof DataModel,
  docs: Array<{ _id: unknown }>,
) {
  await deleteDocs(ctx, docs);
  return docs.length;
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
    llm_batch_executions: artifacts.batchExecutions.length,
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
    await deleteDocs(ctx, artifacts.batchExecutions);
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

export const deleteRunDataPass = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    limit_per_table: z.number().int().min(1).max(1000).default(250),
    isDryRun: z.boolean().default(true),
    allow_active: z.boolean().default(false),
  }),
  returns: z.object({
    trace_id: z.string(),
    run_exists: z.boolean(),
    has_more: z.boolean(),
    deleted: RunDeleteSummarySchema,
  }),
  handler: async (ctx, args) => {
    const trace_id = `run:${args.run_id}`;
    const run = await ctx.db.get(args.run_id);
    if (!run) {
      return {
        trace_id,
        run_exists: false,
        has_more: false,
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

    const deleted = zeroRunDeleteSummary();
    const limit = args.limit_per_table;
    const heavyArtifactLimit = Math.max(1, Math.min(limit, 2));
    const payloadLimit = Math.max(1, Math.min(limit, 5));
    const attemptLimit = Math.max(1, Math.min(limit, 5));

    const batchExecutions = await ctx.db
      .query("llm_batch_executions")
      .withIndex("by_process_stage", (q) => q.eq("process_kind", "run").eq("process_id", String(args.run_id)))
      .take(limit);
    deleted.llm_batch_executions += batchExecutions.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "llm_batch_executions", batchExecutions as Array<{ _id: unknown }>);
    }

    const payloads = await ctx.db
      .query("llm_attempt_payloads")
      .withIndex("by_process", (q) => q.eq("process_kind", "run").eq("process_id", String(args.run_id)))
      .take(payloadLimit);
    deleted.llm_attempt_payloads += payloads.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "llm_attempt_payloads", payloads as Array<{ _id: unknown }>);
    }

    const observabilityRows = await ctx.db
      .query("process_observability")
      .withIndex("by_process", (q) => q.eq("process_type", "run").eq("process_id", String(args.run_id)))
      .take(limit);
    deleted.process_observability += observabilityRows.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "process_observability", observabilityRows as Array<{ _id: unknown }>);
    }

    const scoreCritics = await ctx.db
      .query("score_critics")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .take(heavyArtifactLimit);
    deleted.score_critics += scoreCritics.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "score_critics", scoreCritics as Array<{ _id: unknown }>);
    }

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .take(heavyArtifactLimit);
    deleted.scores += scores.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "scores", scores as Array<{ _id: unknown }>);
    }

    const rubricCritics = await ctx.db
      .query("rubric_critics")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .take(heavyArtifactLimit);
    deleted.rubric_critics += rubricCritics.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "rubric_critics", rubricCritics as Array<{ _id: unknown }>);
    }

    const rubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .take(heavyArtifactLimit);
    deleted.rubrics += rubrics.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "rubrics", rubrics as Array<{ _id: unknown }>);
    }

    const scoreTargetItems = await ctx.db
      .query("sample_score_target_items")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .take(limit);
    deleted.sample_score_target_items += scoreTargetItems.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "sample_score_target_items", scoreTargetItems as Array<{ _id: unknown }>);
    }

    const scoreTargets = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .take(limit);
    deleted.sample_score_targets += scoreTargets.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "sample_score_targets", scoreTargets as Array<{ _id: unknown }>);
    }

    const samples = await ctx.db.query("samples").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).take(limit);
    deleted.samples += samples.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "samples", samples as Array<{ _id: unknown }>);
    }

    const attempts = await ctx.db
      .query("llm_attempts")
      .withIndex("by_process", (q) => q.eq("process_kind", "run").eq("process_id", String(args.run_id)))
      .take(attemptLimit);
    deleted.llm_attempts += attempts.length;
    if (!args.isDryRun) {
      await deleteChunk(ctx, "llm_attempts", attempts as Array<{ _id: unknown }>);
    }

    let has_more = [
      batchExecutions.length,
      payloads.length,
      observabilityRows.length,
      scoreCritics.length,
      scores.length,
      rubricCritics.length,
      rubrics.length,
      scoreTargetItems.length,
      scoreTargets.length,
      samples.length,
      attempts.length,
    ].some((count) => count === limit)
      || scoreCritics.length === heavyArtifactLimit
      || scores.length === heavyArtifactLimit
      || rubricCritics.length === heavyArtifactLimit
      || rubrics.length === heavyArtifactLimit
      || payloads.length === payloadLimit
      || attempts.length === attemptLimit;

    if (!has_more) {
      const remainingCounts = await Promise.all([
        ctx.db.query("llm_batch_executions").withIndex("by_process_stage", (q) => q.eq("process_kind", "run").eq("process_id", String(args.run_id))).take(1),
        ctx.db.query("llm_attempt_payloads").withIndex("by_process", (q) => q.eq("process_kind", "run").eq("process_id", String(args.run_id))).take(1),
        ctx.db.query("process_observability").withIndex("by_process", (q) => q.eq("process_type", "run").eq("process_id", String(args.run_id))).take(1),
        ctx.db.query("score_critics").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).take(1),
        ctx.db.query("scores").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).take(1),
        ctx.db.query("rubric_critics").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).take(1),
        ctx.db.query("rubrics").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).take(1),
        ctx.db.query("sample_score_target_items").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).take(1),
        ctx.db.query("sample_score_targets").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).take(1),
        ctx.db.query("samples").withIndex("by_run", (q) => q.eq("run_id", args.run_id)).take(1),
        ctx.db.query("llm_attempts").withIndex("by_process", (q) => q.eq("process_kind", "run").eq("process_id", String(args.run_id))).take(1),
      ]);
      has_more = remainingCounts.some((docs) => docs.length > 0);
    }

    if (!args.isDryRun && !has_more) {
      await ctx.db.delete(args.run_id);
      deleted.runs += 1;
    }

    if (args.isDryRun) {
      deleted.runs = 1;
    }

    return {
      trace_id,
      run_exists: true,
      has_more,
      deleted,
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
      deleted.llm_batch_executions += result.deleted.llm_batch_executions;
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

export const listExperimentRunIds = zInternalQuery({
  args: z.object({
    experiment_id: zid("experiments"),
  }),
  returns: z.array(zid("runs")),
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", args.experiment_id))
      .collect();
    return runs.map((run) => run._id);
  },
});

export const listRunAttemptIds = zInternalQuery({
  args: z.object({
    run_id: zid("runs"),
  }),
  returns: z.array(zid("llm_attempts")),
  handler: async (ctx, args) => {
    const attempts = await ctx.db
      .query("llm_attempts")
      .withIndex("by_process", (q) => q.eq("process_kind", "run").eq("process_id", String(args.run_id)))
      .collect();
    return attempts.map((attempt) => attempt._id);
  },
});

export const listRunScoreTargetIds = zInternalQuery({
  args: z.object({
    run_id: zid("runs"),
  }),
  returns: z.array(zid("sample_score_targets")),
  handler: async (ctx, args) => {
    const targets = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .collect();
    return targets.map((target) => target._id);
  },
});

export const backfillRunAttemptPayloadsBatch = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    attempt_ids: z.array(zid("llm_attempts")).min(1).max(200),
  }),
  returns: z.object({
    patched: z.number(),
  }),
  handler: async (ctx, args) => {
    let patched = 0;
    for (const attemptId of args.attempt_ids) {
      const items = await ctx.db
        .query("llm_attempt_payloads")
        .withIndex("by_attempt", (q) => q.eq("attempt_id", attemptId))
        .collect();
      for (const item of items) {
        if (item.process_kind === "run" && item.process_id === String(args.run_id)) {
          continue;
        }
        await ctx.db.patch(item._id, {
          process_kind: "run",
          process_id: String(args.run_id),
        });
        patched += 1;
      }
    }
    return { patched };
  },
});

export const backfillRunScoreTargetItemsBatch = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    score_target_ids: z.array(zid("sample_score_targets")).min(1).max(200),
  }),
  returns: z.object({
    patched: z.number(),
  }),
  handler: async (ctx, args) => {
    let patched = 0;
    for (const scoreTargetId of args.score_target_ids) {
      const items = await ctx.db
        .query("sample_score_target_items")
        .withIndex("by_score_target", (q) => q.eq("score_target_id", scoreTargetId))
        .collect();
      for (const item of items) {
        if (item.run_id === args.run_id) {
          continue;
        }
        await ctx.db.patch(item._id, {
          run_id: args.run_id,
        });
        patched += 1;
      }
    }
    return { patched };
  },
});
