import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { RunStageSchema } from "../../models/experiments";
import { StateStatusSchema } from "../../models/_shared";
import { emitTraceEvent } from "../telemetry/emit";
import { zInternalAction, zInternalMutation } from "../../utils/custom_fns";

export const startRunFlow = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    target_count: z.number().int().min(1),
    pause_after: RunStageSchema.nullable().optional(),
  }),
  returns: z.object({
    run_id: zid("runs"),
  }),
  handler: async (ctx, args) => {
    const run_id: Id<"runs"> = await ctx.runMutation(
      internal.domain.runs.run_repo.createRun,
      args,
    );

    await emitTraceEvent(ctx, {
      trace_id: `run:${run_id}`,
      entity_type: "run",
      entity_id: String(run_id),
      event_name: "run_created",
      stage: "rubric_gen",
      status: "start",
      payload_json: JSON.stringify({
        experiment_id: args.experiment_id,
        target_count: args.target_count,
        pause_after: args.pause_after ?? null,
      }),
    });

    await ctx.scheduler.runAfter(0, internal.domain.runs.run_service.startRunExecution, {
      run_id,
      pause_after: args.pause_after ?? null,
    });

    return { run_id };
  },
});

export const startRunExecution = zInternalAction({
  args: z.object({
    run_id: zid("runs"),
    pause_after: RunStageSchema.nullable().optional(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await emitTraceEvent(ctx, {
      trace_id: `run:${args.run_id}`,
      entity_type: "run",
      entity_id: String(args.run_id),
      event_name: "run_flow_started",
      stage: "rubric_gen",
      payload_json: JSON.stringify({
        pause_after: args.pause_after ?? null,
      }),
    });

    try {
      const { workflow_id, workflow_run_id } = await ctx.runAction(
        internal.domain.temporal.temporal_client.startRunWorkflow,
        {
          run_id: args.run_id,
          pause_after: args.pause_after ?? null,
        },
      );
      await ctx.runMutation(api.packages.worker.bindRunWorkflow, {
        run_id: args.run_id,
        workflow_id,
        workflow_run_id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.packages.worker.markRunProcessError, {
        run_id: args.run_id,
        stage: "rubric_gen",
        error_message: errorMessage,
      });
    }

    return null;
  },
});

export const resumeRunExecution = zInternalAction({
  args: z.object({
    run_id: zid("runs"),
    pause_after: RunStageSchema.nullable().optional(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(internal.domain.temporal.temporal_client.resumeRunWorkflow, {
        run_id: args.run_id,
        pause_after: args.pause_after ?? null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.packages.worker.markRunProcessError, {
        run_id: args.run_id,
        stage: null,
        error_message: errorMessage,
      });
    }

    return null;
  },
});

export const startRunFlowForCampaign = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    experiment_tag: z.string(),
    target_count: z.number().int().min(1),
    pause_after: RunStageSchema.nullable().optional(),
    start_scheduler: z.boolean().default(true),
  }),
  returns: z.object({
    run_id: zid("runs"),
  }),
  handler: async (ctx, args): Promise<{ run_id: Id<"runs"> }> => {
    const result = await ctx.runMutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id: args.experiment_id,
      target_count: args.target_count,
      pause_after: args.pause_after ?? null,
    });

    await emitTraceEvent(ctx, {
      trace_id: `run:${result.run_id}`,
      entity_type: "run",
      entity_id: String(result.run_id),
      event_name: "run_started",
      stage: "rubric_gen",
      status: "queued",
      payload_json: JSON.stringify({
        experiment_id: args.experiment_id,
        experiment_tag: args.experiment_tag,
        target_count: args.target_count,
        pause_after: args.pause_after ?? null,
      }),
    });

    return result;
  },
});

const ResumePausedRunResultSchema = z.object({
  run_id: zid("runs").nullable(),
  outcome: z.enum([
    "missing_run",
    "not_paused",
    "advanced",
  ]),
  status: StateStatusSchema.nullable(),
  current_stage: RunStageSchema.nullable(),
});

export const resumePausedRunFlow = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    pause_after: RunStageSchema.nullable().optional(),
    start_scheduler: z.boolean().default(true),
  }),
  returns: ResumePausedRunResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof ResumePausedRunResultSchema>> => {
    const run = await ctx.db.get(args.run_id);
    if (!run) {
      return {
        run_id: null,
        outcome: "missing_run" as const,
        status: null,
        current_stage: null,
      };
    }

    if (run.status !== "paused") {
      return {
        run_id: run._id,
        outcome: "not_paused" as const,
        status: run.status,
        current_stage: run.current_stage,
      };
    }

    const nextPauseAfter = args.pause_after ?? null;
    await ctx.db.patch(run._id, {
      status: "running",
      pause_after: nextPauseAfter,
      last_error_message: null,
    });

    await ctx.scheduler.runAfter(
      0,
      run.workflow_id
        ? internal.domain.runs.run_service.resumeRunExecution
        : internal.domain.runs.run_service.startRunExecution,
      {
        run_id: run._id,
        pause_after: nextPauseAfter,
      },
    );

    await emitTraceEvent(ctx, {
      trace_id: `run:${run._id}`,
      entity_type: "run",
      entity_id: String(run._id),
      event_name: "run_resumed",
      stage: run.current_stage,
      status: "running",
      payload_json: JSON.stringify({
        resumed_stage: run.current_stage,
        previous_pause_after: run.pause_after ?? null,
        pause_after: nextPauseAfter,
        workflow_id: run.workflow_id ?? null,
      }),
    });

    return {
      run_id: run._id,
      outcome: "advanced" as const,
      status: "running",
      current_stage: run.current_stage,
    };
  },
});

export const resumePausedRunFlowForCampaign = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    pause_after: RunStageSchema.nullable().optional(),
    start_scheduler: z.boolean().default(true),
  }),
  returns: ResumePausedRunResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof ResumePausedRunResultSchema>> => {
    return ctx.runMutation(internal.domain.runs.run_service.resumePausedRunFlow, args);
  },
});
