import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "../../platform/utils";
import { LlmStageSchema } from "../../models/core";
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

export const createRun = zMutation({
  args: z.object({
    experiment_tag: z.string(),
    stop_at_stage: LlmStageSchema.optional(),
    stages: z.array(LlmStageSchema).optional(),
  }),
  returns: z.object({ run_id: zid("runs") }),
  handler: async (ctx, { experiment_tag, stop_at_stage, stages }) => {
    const result = await startExperimentInternal(ctx, {
      experiment_tag,
      stop_at_stage,
      stages,
    });
    if (!result.ok || !result.run_id) {
      throw new Error(result.error ?? "run_start_failed");
    }
    return { run_id: result.run_id };
  },
});

export const startExperiment = zMutation({
  args: z.object({
    experiment_tag: z.string(),
    stop_at_stage: LlmStageSchema.optional(),
    stages: z.array(LlmStageSchema).optional(),
  }),
  returns: z.object({
    ok: z.boolean(),
    run_id: zid("runs").optional(),
    error: z.string().optional(),
  }),
  handler: async (ctx, args) => startExperimentInternal(ctx, args),
});

export const startExperiments = zMutation({
  args: z.object({
    tags: z.array(z.string()),
  }),
  returns: z.object({
    started: z.array(
      z.object({ tag: z.string(), run_id: zid("runs") }),
    ),
    failed: z.array(
      z.object({ tag: z.string(), error: z.string() }),
    ),
  }),
  handler: async (ctx, { tags }) => {
    const started: Array<{ tag: string; run_id: Id<"runs"> }> = [];
    const failed: Array<{ tag: string; error: string }> = [];

    for (const tag of tags) {
      const result = await startExperimentInternal(ctx, {
        experiment_tag: tag,
        stop_at_stage: undefined,
        stages: undefined,
      });
      if (result.ok && result.run_id) {
        started.push({ tag, run_id: result.run_id });
      } else {
        failed.push({ tag, error: result.error ?? "run_start_failed" });
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

    const updates: Record<string, unknown> = {
      desired_state,
      updated_at: Date.now(),
    };

    if (desired_state === "paused" && run.status === "running") {
      updates.status = "paused";
    }
    if (desired_state === "running" && run.status === "paused") {
      updates.status = "running";
    }
    if (desired_state === "canceled") {
      updates.status = "canceled";
    }

    await ctx.db.patch(run_id, updates);

    if (desired_state === "canceled") {
      const experiment = await ctx.db.get(run.experiment_id);
      if (experiment?.active_run_id === run_id) {
        await ctx.db.patch(experiment._id, {
          active_run_id: undefined,
          status: "canceled",
        });
      }
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
    experiment_tag: string;
    stop_at_stage?: z.infer<typeof LlmStageSchema>;
    stages?: z.infer<typeof LlmStageSchema>[];
  },
): Promise<{ ok: boolean; run_id?: Id<"runs">; error?: string }> {
  try {
    const { experiment_tag, stop_at_stage, stages } = args;
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment) {
      return { ok: false, error: "experiment_not_found" };
    }

    if (experiment.active_run_id) {
      const active = await ctx.db.get(experiment.active_run_id);
      if (
        active &&
        active.status !== "complete" &&
        active.status !== "canceled"
      ) {
        return { ok: false, error: "active_run_exists" };
      }
      await ctx.db.patch(experiment._id, { active_run_id: undefined });
    }

    const template = await ctx.runQuery(
      internal.domain.configs.repo.getConfigTemplate,
      {
        template_id: experiment.config_template_id,
        version: experiment.config_template_version,
      },
    );
    if (!template) {
      return { ok: false, error: "config_template_not_found" };
    }

    try {
      preflightCheck(requiredEnvsForExperiment(template.config_body.experiment));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }

    const git_sha =
      process.env.GIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      "unknown";

    const policySnapshot = structuredClone(ENGINE_SETTINGS.run_policy);

    const run_config_id = await ctx.runMutation(
      internal.domain.configs.repo.createRunConfigFromTemplate,
      {
        template_id: template.template_id,
        version: template.version,
        git_sha,
        validation_status: "valid",
      },
    );

    const now = Date.now();
    const run_id = await ctx.db.insert("runs", {
      experiment_id: experiment._id,
      run_config_id,
      policy_snapshot: policySnapshot,
      status: "running",
      desired_state: "running",
      stop_at_stage,
      current_stage: undefined,
      last_stage_completed_at: undefined,
      created_at: now,
      updated_at: now,
    });

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

    await ctx.db.patch(experiment._id, {
      active_run_id: run_id,
      status: "running",
    });

    await ctx.runMutation(
      internal.domain.runs.workflows.scheduler.ensureScheduler,
      { reason: "run_start" },
    );

    return { ok: true, run_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
