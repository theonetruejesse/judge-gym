import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "../../platform/utils";
import { LlmStageSchema, RunCountsSchema } from "../../models/core";
import { internal } from "../../_generated/api";
import { preflightCheck } from "../../env";
import { requiredEnvsForExperiment } from "../../utils/env_requirements";
import { ENGINE_SETTINGS } from "../../settings";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

const DEFAULT_RUN_STAGES = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
] as const;

const STAGE_ORDER = [
  "evidence_clean",
  "evidence_neutralize",
  "evidence_abstract",
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
] as const;

export const createRun = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    run_counts: RunCountsSchema,
    stop_at_stage: LlmStageSchema.optional(),
    stages: z.array(LlmStageSchema).optional(),
  }),
  returns: z.object({ run_id: zid("runs") }),
  handler: async (ctx, { experiment_id, run_counts, stop_at_stage, stages }) => {
    const result = await startExperimentInternal(ctx, {
      experiment_id,
      run_counts,
      stop_at_stage,
      stages,
    });
    if (!result.ok || !result.created_run_id) {
      throw new Error(result.error ?? "run_start_failed");
    }
    return { run_id: result.created_run_id };
  },
});

export const startExperiment = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    run_counts: RunCountsSchema,
    stop_at_stage: LlmStageSchema.optional(),
    stages: z.array(LlmStageSchema).optional(),
  }),
  returns: z.object({
    ok: z.boolean(),
    run_ids: z.array(zid("runs")).optional(),
    created_run_id: zid("runs").optional(),
    started: z.number().optional(),
    error: z.string().optional(),
  }),
  handler: async (ctx, args) => startExperimentInternal(ctx, args),
});

export const startExperiments = zMutation({
  args: z.object({
    experiment_ids: z.array(zid("experiments")),
    run_counts: RunCountsSchema,
  }),
  returns: z.object({
    started: z.array(
      z.object({
        experiment_id: zid("experiments"),
        run_ids: z.array(zid("runs")),
        created_run_id: zid("runs").optional(),
      }),
    ),
    failed: z.array(
      z.object({ experiment_id: zid("experiments"), error: z.string() }),
    ),
  }),
  handler: async (ctx, { experiment_ids, run_counts }) => {
    const started: Array<{
      experiment_id: Id<"experiments">;
      run_ids: Id<"runs">[];
      created_run_id?: Id<"runs">;
    }> = [];
    const failed: Array<{ experiment_id: Id<"experiments">; error: string }> =
      [];

    for (const experiment_id of experiment_ids) {
      const result = await startExperimentInternal(ctx, {
        experiment_id,
        run_counts,
        stop_at_stage: undefined,
        stages: undefined,
      });
      if (result.ok && result.run_ids && result.run_ids.length > 0) {
        started.push({
          experiment_id,
          run_ids: result.run_ids,
          created_run_id: result.created_run_id,
        });
      } else {
        failed.push({
          experiment_id,
          error: result.error ?? "run_start_failed",
        });
      }
    }

    return { started, failed };
  },
});

export const updateRunState = zMutation({
  args: z.object({
    run_id: zid("runs"),
    desired_state: z.enum(["running", "paused", "canceled"]),
  }),
  returns: z.object({ ok: z.boolean() }),
  handler: async (ctx, { run_id, desired_state }) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("Run not found");

    const now = Date.now();
    const updates: Record<string, unknown> = {
      desired_state,
      updated_at: now,
    };

    if (desired_state === "paused") {
      const current = await resolveCurrentStage(ctx, run);
      if (current) {
        updates.stop_at_stage = current;
      }
      if (run.status !== "canceled") {
        updates.status = "running";
      }
    }
    if (desired_state === "running") {
      updates.stop_at_stage = undefined;
      updates.status = "running";
    }
    if (desired_state === "canceled") {
      updates.status = "canceled";
    }

    await ctx.db.patch(run_id, updates);
    if (desired_state === "running") {
      await ctx.runMutation(
        internal.domain.runs.workflows.runs_scheduler.ensureScheduler,
        { reason: "run_resume" },
      );
    }
    return { ok: true };
  },
});

export const markStageProgress = zMutation({
  args: z.object({
    run_stage_id: zid("run_stages"),
    status: z.enum(["pending", "running", "complete", "failed"]),
    total_requests: z.number().optional(),
    completed_requests: z.number().optional(),
    failed_requests: z.number().optional(),
    last_batch_id: zid("llm_batches").optional(),
  }),
  returns: z.object({ ok: z.boolean() }),
  handler: async (ctx, { run_stage_id, ...fields }) => {
    await ctx.db.patch(run_stage_id, {
      ...fields,
      updated_at: Date.now(),
    });
    return { ok: true };
  },
});

export const setRunCurrentStage = zMutation({
  args: z.object({
    run_id: zid("runs"),
    current_stage: LlmStageSchema.optional(),
  }),
  returns: z.object({ ok: z.boolean() }),
  handler: async (ctx, { run_id, current_stage }) => {
    await ctx.db.patch(run_id, {
      current_stage,
      updated_at: Date.now(),
    });
    return { ok: true };
  },
});

async function startExperimentInternal(
  ctx: MutationCtx,
  args: {
    experiment_id: Id<"experiments">;
    run_counts: z.infer<typeof RunCountsSchema>;
    stop_at_stage?: z.infer<typeof LlmStageSchema>;
    stages?: z.infer<typeof LlmStageSchema>[];
  },
): Promise<{
  ok: boolean;
  run_ids?: Id<"runs">[];
  created_run_id?: Id<"runs">;
  started?: number;
  error?: string;
}> {
  try {
    const { experiment_id, run_counts, stop_at_stage, stages } = args;
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) {
      return { ok: false, error: "experiment_not_found" };
    }

    try {
      preflightCheck(requiredEnvsForExperiment(experiment));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }

    const policySnapshot = structuredClone(ENGINE_SETTINGS.run_policy);

    const now = Date.now();
    const pendingRuns = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    let createdRunId: Id<"runs"> | undefined;
    if (pendingRuns.length === 0) {
      const run_id = await ctx.db.insert("runs", {
        experiment_id: experiment._id,
        run_counts,
        policy_snapshot: policySnapshot,
        status: "running",
        desired_state: "running",
        stop_at_stage,
        current_stage: undefined,
        rubric_seeded_at: undefined,
        scoring_seeded_at: undefined,
        last_stage_completed_at: undefined,
        created_at: now,
        updated_at: now,
      });
      createdRunId = run_id;

      const runStages = (stages ?? DEFAULT_RUN_STAGES).map((stage) => ({
        run_id,
        stage,
        status: "pending" as const,
        total_requests: 0,
        completed_requests: 0,
        failed_requests: 0,
        last_batch_id: undefined,
        updated_at: now,
      }));
      for (const row of runStages) {
        await ctx.db.insert("run_stages", row);
      }
      pendingRuns.push({
        ...(await ctx.db.get(run_id))!,
      });
    }

    const startedIds: Id<"runs">[] = [];
    for (const run of pendingRuns) {
      await ctx.db.patch(run._id, {
        status: "running",
        desired_state: "running",
        updated_at: now,
      });

      const existingStages = await ctx.db
        .query("run_stages")
        .withIndex("by_run", (q) => q.eq("run_id", run._id))
        .collect();
      if (existingStages.length === 0) {
        const runStages = (stages ?? DEFAULT_RUN_STAGES).map((stage) => ({
          run_id: run._id,
          stage,
          status: "pending" as const,
          total_requests: 0,
          completed_requests: 0,
          failed_requests: 0,
          last_batch_id: undefined,
          updated_at: now,
        }));
        for (const row of runStages) {
          await ctx.db.insert("run_stages", row);
        }
      }

      if (!run.rubric_seeded_at) {
        await ctx.runMutation(
          internal.domain.experiments.stages.rubric.workflows.experiments_rubric_seed_requests
            .seedRubricRequests,
          {
            experiment_id: experiment._id,
            run_id: run._id,
          },
        );
        await ctx.db.patch(run._id, {
          rubric_seeded_at: now,
          current_stage: "rubric_gen",
          updated_at: now,
        });
      }
      startedIds.push(run._id);
    }

    await ctx.runMutation(
      internal.domain.runs.workflows.runs_scheduler.ensureScheduler,
      { reason: "run_start" },
    );

    return {
      ok: true,
      run_ids: startedIds,
      created_run_id: createdRunId,
      started: startedIds.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function resolveCurrentStage(
  ctx: MutationCtx,
  run: { _id: Id<"runs">; current_stage?: z.infer<typeof LlmStageSchema> },
) {
  if (run.current_stage) return run.current_stage;
  const stages = await ctx.db
    .query("run_stages")
    .withIndex("by_run", (q) => q.eq("run_id", run._id))
    .collect();
  const ordered = STAGE_ORDER.filter((stage) =>
    stages.some((row) => row.stage === stage),
  );
  for (const stage of ordered) {
    const row = stages.find((item) => item.stage === stage);
    if (!row || row.status !== "complete") {
      return stage;
    }
  }
  return ordered[ordered.length - 1];
}
