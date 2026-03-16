import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../utils/custom_fns";
import { RunOrchestrator, type RunRequestTargetType } from "./run_orchestrator";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";
import { getProviderForModel } from "../../platform/providers/provider_types";
import { RunStageSchema, type RunStage } from "../../models/experiments";
import { StateStatusSchema } from "../../models/_shared";
import {
  extractReasoningBeforeVerdict,
  parseExpertAgreementResponse,
  parseQualityResponse,
  parseRubricResponse,
} from "./run_parsers";
import {
  normalizeExperimentConfig,
  resolveRandomizationStrategy,
  resolveScaleStrategy,
  resolveScoringStrategy,
  type ExperimentConfig,
} from "./run_strategies";
import { syncExperimentTotalCount } from "./experiment_progress";
import { incrementSampleScoreCounter } from "./sample_progress";
import { generateLabelMapping } from "../../utils/randomize";
import { emitTraceEvent } from "../telemetry/emit";
import { getNextAttemptAt } from "../../utils/scheduling";
import { getRunCompletedCount, getRunStageProgress } from "./run_progress";
import { classifyRequestError } from "../llm_calls/llm_request_repo";
import { resolveEvidenceStrategy } from "./run_strategies";

const RUN_STAGE_ENQUEUE_CHUNK_SIZE = 50;

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

    const orchestrator = new RunOrchestrator(ctx);
    await ctx.db.patch(run_id, {
      status: "running",
      current_stage: "rubric_gen",
    });
    await emitTraceEvent(ctx, {
      trace_id: `run:${run_id}`,
      entity_type: "run",
      entity_id: String(run_id),
      event_name: "run_stage_started",
      stage: "rubric_gen",
      status: "running",
      payload_json: JSON.stringify({
        experiment_id: args.experiment_id,
        target_count: args.target_count,
        pause_after: args.pause_after ?? null,
      }),
    });
    await orchestrator.enqueueStage(run_id, "rubric_gen");
    await emitTraceEvent(ctx, {
      trace_id: `run:${run_id}`,
      entity_type: "run",
      entity_id: String(run_id),
      event_name: "run_stage_enqueued",
      stage: "rubric_gen",
      status: "queued",
      payload_json: JSON.stringify({
        experiment_id: args.experiment_id,
        target_count: args.target_count,
        pause_after: args.pause_after ?? null,
      }),
    });

    return { run_id };
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
    const result: { run_id: Id<"runs"> } = await ctx.runMutation(
      internal.domain.runs.run_service.startRunFlow,
      {
        experiment_id: args.experiment_id,
        target_count: args.target_count,
        pause_after: args.pause_after ?? null,
      },
    );

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

    if (args.start_scheduler) {
      await ctx.runMutation(
        internal.domain.orchestrator.scheduler.startScheduler,
        {},
      );
    }

    return result;
  },
});

const ResumePausedRunResultSchema = z.object({
  run_id: zid("runs").nullable(),
  outcome: z.enum([
    "missing_run",
    "not_paused",
    "deferred_missing_progress",
    "deferred_pending",
    "deferred_active_transport",
    "deferred_stage_mismatch",
    "advanced",
    "completed",
    "terminal_error",
    "failed",
    "paused",
    "requeued_current_stage",
  ]),
  status: StateStatusSchema.nullable(),
  current_stage: RunStageSchema.nullable(),
});

const EnqueueRunStageResultSchema = z.object({
  run_id: zid("runs").nullable(),
  stage: RunStageSchema,
  enqueued_requests: z.number(),
  has_more: z.boolean(),
  route: z.enum(["batch", "job", "none"]),
  outcome: z.enum([
    "missing_run",
    "terminal_noop",
    "stage_mismatch",
    "enqueued",
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
  handler: async (ctx, args): Promise<z.infer<typeof ResumePausedRunResultSchema>> => {
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

    const resumedStage = run.current_stage;
    const nextPauseAfter = args.pause_after ?? null;
    await ctx.db.patch(run._id, {
      status: "running",
      pause_after: nextPauseAfter,
    });
    await emitTraceEvent(ctx, {
      trace_id: `run:${run._id}`,
      entity_type: "run",
      entity_id: String(run._id),
      event_name: "run_resumed",
      stage: resumedStage,
      status: "running",
      payload_json: JSON.stringify({
        resumed_stage: resumedStage,
        previous_pause_after: run.pause_after ?? null,
        pause_after: nextPauseAfter,
      }),
    });

    const result = await maybeAdvanceRunStage(ctx, run._id, resumedStage, {
      start_scheduler: args.start_scheduler,
    });
    if (result.outcome === "deferred_pending") {
      const hasTransport = await hasActiveRunTransportWork(ctx, run._id, resumedStage);
      if (!hasTransport) {
        await scheduleRunStageEnqueue(ctx, {
          run_id: run._id,
          stage: resumedStage,
          reason: "resume_requeue_current_stage",
          start_scheduler: args.start_scheduler,
        });
        const refreshed = await ctx.db.get(run._id);
        return {
          run_id: run._id,
          outcome: "requeued_current_stage" as const,
          status: refreshed?.status ?? null,
          current_stage: refreshed?.current_stage ?? null,
        };
      }
    }

    const refreshed = await ctx.db.get(run._id);
    const normalizedOutcome = result.outcome === "terminal_noop"
      ? "not_paused"
      : result.outcome;
    return {
      run_id: run._id,
      outcome: normalizedOutcome,
      status: refreshed?.status ?? null,
      current_stage: refreshed?.current_stage ?? null,
    };
  },
});

export const enqueueRunStage = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    stage: RunStageSchema,
    reason: z.string().optional(),
    max_requests: z.number().int().min(1).optional(),
    start_scheduler: z.boolean().default(true),
  }),
  returns: EnqueueRunStageResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof EnqueueRunStageResultSchema>> => {
    const run = await ctx.db.get(args.run_id);
    if (!run) {
      return {
        run_id: null,
        stage: args.stage,
        enqueued_requests: 0,
        has_more: false,
        route: "none",
        outcome: "missing_run" as const,
        status: null,
        current_stage: null,
      };
    }

    if (
      run.status === "completed"
      || run.status === "paused"
      || run.status === "canceled"
      || run.status === "error"
    ) {
      return {
        run_id: run._id,
        stage: args.stage,
        enqueued_requests: 0,
        has_more: false,
        route: "none",
        outcome: "terminal_noop" as const,
        status: run.status,
        current_stage: run.current_stage,
      };
    }

    if (run.current_stage !== args.stage) {
      return {
        run_id: run._id,
        stage: args.stage,
        enqueued_requests: 0,
        has_more: false,
        route: "none",
        outcome: "stage_mismatch" as const,
        status: run.status,
        current_stage: run.current_stage,
      };
    }

    const orchestrator = new RunOrchestrator(ctx);
    const result = await orchestrator.enqueueStageChunk(
      run._id,
      args.stage,
      args.max_requests ?? RUN_STAGE_ENQUEUE_CHUNK_SIZE,
    );

    if (result.enqueued_count > 0) {
      await emitTraceEvent(ctx, {
        trace_id: `run:${run._id}`,
        entity_type: "run",
        entity_id: String(run._id),
        event_name: "run_stage_enqueued",
        stage: args.stage,
        status: "queued",
        payload_json: JSON.stringify({
          enqueued_requests: result.enqueued_count,
          has_more: result.has_more,
          route: result.route,
          reason: args.reason ?? null,
          chunk_size: args.max_requests ?? RUN_STAGE_ENQUEUE_CHUNK_SIZE,
        }),
      });
    }

    if (result.has_more) {
      await scheduleRunStageEnqueue(ctx, {
        run_id: run._id,
        stage: args.stage,
        reason: args.reason ?? "continuation",
        max_requests: args.max_requests,
        start_scheduler: args.start_scheduler,
      });
    }

    if (args.start_scheduler && result.enqueued_count > 0) {
      await ctx.runMutation(
        internal.domain.orchestrator.scheduler.startScheduler,
        {},
      );
    }

    const refreshed = await ctx.db.get(run._id);
    return {
      run_id: run._id,
      stage: args.stage,
      enqueued_requests: result.enqueued_count,
      has_more: result.has_more,
      route: result.route,
      outcome: "enqueued" as const,
      status: refreshed?.status ?? null,
      current_stage: refreshed?.current_stage ?? null,
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
  handler: async (ctx, args): Promise<z.infer<typeof ResumePausedRunResultSchema>> => {
    const result = await ctx.runMutation(
      internal.domain.runs.run_service.resumePausedRunFlow,
      {
        run_id: args.run_id,
        pause_after: args.pause_after ?? null,
        start_scheduler: args.start_scheduler,
      },
    );

    if (args.start_scheduler && result.status === "running") {
      await ctx.runMutation(
        internal.domain.orchestrator.scheduler.startScheduler,
        {},
      );
    }

    return result;
  },
});

export const applyRequestResult = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
    custom_key: z.string(),
    output: z.string(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
  }),
  handler: async (ctx, args) => {
    const orchestrator = new RunOrchestrator(ctx);
    const { targetType, targetId, stage } = orchestrator.parseRequestKey(args.custom_key);
    const target = await resolveRunTarget(ctx, targetType, targetId);
    const sample = target.sample;
    const sampleId = sample._id;
    const scoreTarget = target.scoreTarget;
    const request = await ctx.runQuery(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: args.request_id },
    );

    try {
      if (
        (stage === "rubric_gen" || stage === "rubric_critic") &&
        targetType !== "sample"
      ) {
        throw new Error(`Unexpected target type for stage ${stage}: ${targetType}`);
      }
      if (stage === "rubric_gen" && sample.rubric_id) {
        if (request.status === "success") return;
        await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.patchRequest,
          {
            request_id: args.request_id,
            patch: { status: "success" },
          },
        );
        await emitTraceEvent(ctx, {
          trace_id: `run:${sample.run_id}`,
          entity_type: "request",
          entity_id: String(args.request_id),
          event_name: "request_apply_duplicate_success",
          stage,
          status: "success",
          custom_key: args.custom_key,
        }, { defer: true });
        return;
      }
      if (stage === "rubric_critic" && sample.rubric_critic_id) {
        if (request.status === "success") return;
        await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.patchRequest,
          {
            request_id: args.request_id,
            patch: { status: "success" },
          },
        );
        await emitTraceEvent(ctx, {
          trace_id: `run:${sample.run_id}`,
          entity_type: "request",
          entity_id: String(args.request_id),
          event_name: "request_apply_duplicate_success",
          stage,
          status: "success",
          custom_key: args.custom_key,
        }, { defer: true });
        return;
      }
      if (stage === "score_gen" && scoreTarget?.score_id) {
        if (request.status === "success") return;
        await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.patchRequest,
          {
            request_id: args.request_id,
            patch: { status: "success" },
          },
        );
        await emitTraceEvent(ctx, {
          trace_id: `run:${sample.run_id}`,
          entity_type: "request",
          entity_id: String(args.request_id),
          event_name: "request_apply_duplicate_success",
          stage,
          status: "success",
          custom_key: args.custom_key,
        }, { defer: true });
        return;
      }
      if (
        stage === "score_critic" &&
        scoreTarget?.score_critic_id
      ) {
        if (request.status === "success") return;
        await ctx.runMutation(
          internal.domain.llm_calls.llm_request_repo.patchRequest,
          {
            request_id: args.request_id,
            patch: { status: "success" },
          },
        );
        await emitTraceEvent(ctx, {
          trace_id: `run:${sample.run_id}`,
          entity_type: "request",
          entity_id: String(args.request_id),
          event_name: "request_apply_duplicate_success",
          stage,
          status: "success",
          custom_key: args.custom_key,
        }, { defer: true });
        return;
      }

      if (stage === "rubric_gen") {
        const experiment = await ctx.db.get(sample.experiment_id);
        if (!experiment) throw new Error("Experiment not found");

        const parsed = parseRubricResponse(
          args.output,
          experiment.rubric_config.scale_size,
        );

        const config = normalizeExperimentConfig(experiment);

        const label_mapping = buildLabelMapping(
          config,
          experiment.rubric_config.scale_size,
          sample.seed,
        );

        const rubric_id = await ctx.db.insert("rubrics", {
          run_id: sample.run_id,
          sample_id: sampleId,
          model: experiment.rubric_config.model,
          concept: experiment.rubric_config.concept,
          scale_size: experiment.rubric_config.scale_size,
          llm_request_id: args.request_id,
          justification: parsed.reasoning,
          stages: parsed.stages,
          label_mapping,
        });

        await ctx.db.patch(sampleId, { rubric_id });
      }

      if (stage === "rubric_critic") {
        if (!sample.rubric_id) throw new Error("Rubric missing for sample");
        const rubric = await ctx.db.get(sample.rubric_id);
        if (!rubric) throw new Error("Rubric not found");

        const parsed = parseQualityResponse(args.output);
        const rubric_critic_id = await ctx.db.insert("rubric_critics", {
          run_id: sample.run_id,
          sample_id: sampleId,
          model: rubric.model,
          llm_request_id: args.request_id,
          justification: parsed.reasoning,
          expert_agreement_prob: {
            observability_score: parsed.observabilityScore,
            discriminability_score: parsed.discriminabilityScore,
          },
        });

        await ctx.db.patch(sampleId, { rubric_critic_id });
      }

      if (stage === "score_gen") {
        if (!sample.rubric_id) throw new Error("Rubric missing for sample");
        const experiment = await ctx.db.get(sample.experiment_id);
        if (!experiment) throw new Error("Experiment not found");
        const rubric = await ctx.db.get(sample.rubric_id);
        if (!rubric) throw new Error("Rubric not found");

        const config = normalizeExperimentConfig(experiment);
        if (!scoreTarget) {
          throw new Error("Score stage requires sample_score_target");
        }

        const scoring = resolveScoringStrategy(config);
        const verdict = scoring.parseVerdict(
          args.output,
          rubric.label_mapping,
        );
        const justification = extractReasoningBeforeVerdict(args.output);

        const decodedScores = verdict.decodedScores ?? [];
        const score_id = await ctx.db.insert("scores", {
          run_id: sample.run_id,
          sample_id: sampleId,
          score_target_id: scoreTarget._id,
          model: sample.model,
          llm_request_id: args.request_id,
          justification,
          decoded_scores: decodedScores,
        });

        if (scoreTarget) {
          await ctx.db.patch(scoreTarget._id, { score_id });
          await incrementSampleScoreCounter(ctx, sampleId, "score_count");
        } else {
          throw new Error("Score stage requires sample_score_target");
        }
      }

      if (stage === "score_critic") {
        const score_id = scoreTarget?.score_id;
        if (!score_id) throw new Error("Score missing for sample");
        const parsed = parseExpertAgreementResponse(args.output);
        const score_critic_id = await ctx.db.insert("score_critics", {
          run_id: sample.run_id,
          sample_id: sampleId,
          score_target_id: scoreTarget._id,
          model: sample.model,
          llm_request_id: args.request_id,
          justification: parsed.reasoning,
          expert_agreement_prob: parsed.expertAgreementProb,
        });

        if (scoreTarget) {
          await ctx.db.patch(scoreTarget._id, { score_critic_id });
          await incrementSampleScoreCounter(ctx, sampleId, "score_critic_count");
        } else {
          throw new Error("Score critic stage requires sample_score_target");
        }
      }
    } catch (error) {
      await markRequestParseFailure(
        ctx,
        args.request_id,
        error,
        args.output,
        args.input_tokens,
        args.output_tokens,
      );
      await emitTraceEvent(ctx, {
        trace_id: `run:${sample.run_id}`,
        entity_type: "request",
        entity_id: String(args.request_id),
        event_name: "request_parse_error",
        stage,
        status: "error",
        custom_key: args.custom_key,
        payload_json: JSON.stringify({
          class: "parse_error",
          error: error instanceof Error ? error.message : String(error),
          output_preview: args.output.slice(0, 1200),
          input_tokens: args.input_tokens ?? null,
          output_tokens: args.output_tokens ?? null,
        }),
      }, { defer: true });
      return;
    }

    await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.patchRequest,
      {
        request_id: args.request_id,
        patch: {
          status: "success",
          assistant_output: args.output,
          input_tokens: args.input_tokens,
          output_tokens: args.output_tokens,
        },
      },
    );

    await emitTraceEvent(ctx, {
      trace_id: `run:${sample.run_id}`,
      entity_type: "request",
      entity_id: String(args.request_id),
      event_name: "request_applied",
      stage,
      status: "success",
      custom_key: args.custom_key,
    }, { defer: true });
  },
});

export const handleRequestError = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
    custom_key: z.string(),
  }),
  handler: async (ctx, args) => {
    const orchestrator = new RunOrchestrator(ctx);
    const { targetType, targetId, stage } = orchestrator.parseRequestKey(args.custom_key);
    const { sample } = await resolveRunTarget(ctx, targetType, targetId);
    const request = await ctx.runQuery(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: args.request_id },
    );
    await emitTraceEvent(ctx, {
      trace_id: `run:${sample.run_id}`,
      entity_type: "request",
      entity_id: String(args.request_id),
      event_name: "request_error",
      stage,
      status: "error",
      custom_key: args.custom_key,
      payload_json: JSON.stringify({
        class: classifyRequestError(request.last_error),
        error: request.last_error ?? null,
        attempt_index: request.attempt_index ?? null,
      }),
    }, { defer: true });
  },
});

export const requeueRunRequest = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.runQuery(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: args.request_id },
    );

    const orchestrator = new RunOrchestrator(ctx);
    const { targetType, targetId, stage } = orchestrator.parseRequestKey(request.custom_key);
    const { sample } = await resolveRunTarget(ctx, targetType, targetId);

    const provider = getProviderForModel(request.model);
    const jobId = (await ctx.runMutation(
      internal.domain.llm_calls.llm_job_repo.createLlmJob,
      {
        provider,
        model: request.model,
        custom_key: orchestrator.makeProcessKey(sample.run_id, stage),
      },
    )) as Id<"llm_jobs">;

    await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.patchRequest,
      {
        request_id: request._id,
        patch: {
          status: "pending",
          job_id: jobId,
          batch_id: null,
          next_attempt_at: undefined,
        },
      },
    );
    await emitTraceEvent(ctx, {
      trace_id: `run:${sample.run_id}`,
      entity_type: "request",
      entity_id: String(request._id),
      event_name: "request_requeued_to_job",
      stage,
      status: "queued",
      custom_key: request.custom_key,
      payload_json: JSON.stringify({
        job_id: jobId,
      }),
    }, { defer: true });
  },
});

export const reconcileRunStage = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    stage: RunStageSchema,
  }),
  returns: z.object({
    outcome: z.enum([
      "missing_run",
      "terminal_noop",
      "deferred_missing_progress",
      "deferred_pending",
      "deferred_active_transport",
      "deferred_stage_mismatch",
      "advanced",
      "completed",
      "terminal_error",
      "failed",
      "paused",
    ]),
    completed: z.number(),
    failed: z.number(),
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.run_id);
    if (!run) {
      return {
        outcome: "missing_run" as const,
        completed: 0,
        failed: 0,
      };
    }
    if (
      run.status === "completed"
      || run.status === "paused"
      || run.status === "canceled"
      || run.status === "error"
    ) {
      return {
        outcome: "terminal_noop" as const,
        completed: 0,
        failed: 0,
      };
    }

    try {
      const result = await maybeAdvanceRunStage(ctx, args.run_id, args.stage);
      await emitTraceEvent(ctx, {
        trace_id: `run:${args.run_id}`,
        entity_type: "run",
        entity_id: String(args.run_id),
        event_name: "run_stage_reconciled",
        stage: args.stage,
        status: mapReconcileOutcomeToStatus(result.outcome),
        payload_json: JSON.stringify({
          outcome: result.outcome,
          completed: result.completed,
          failed: result.failed,
        }),
      });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const canPause = run.current_stage === args.stage;
      const hasTransport = await hasActiveRunTransportWork(ctx, args.run_id, args.stage);
      const shouldPause = canPause && !hasTransport;

      if (shouldPause) {
        await ctx.db.patch(args.run_id, {
          status: "paused",
          current_stage: args.stage,
        });
      }

      await emitTraceEvent(ctx, {
        trace_id: `run:${args.run_id}`,
        entity_type: "run",
        entity_id: String(args.run_id),
        event_name: shouldPause ? "run_fail_safe_paused" : "run_stage_reconcile_failed",
        stage: args.stage,
        status: shouldPause ? "paused" : "error",
        payload_json: JSON.stringify({
          error: errorMessage,
          paused: shouldPause,
          current_status: run.status,
        }),
      });

      return {
        outcome: shouldPause ? ("paused" as const) : ("failed" as const),
        completed: 0,
        failed: 0,
      };
    }
  },
});

function mapReconcileOutcomeToStatus(
  outcome:
    | "missing_run"
    | "terminal_noop"
    | "deferred_missing_progress"
    | "deferred_pending"
    | "deferred_active_transport"
    | "deferred_stage_mismatch"
    | "advanced"
    | "completed"
    | "terminal_error"
    | "failed"
    | "paused",
): "running" | "completed" | "error" | "paused" {
  if (outcome === "completed") return "completed";
  if (outcome === "terminal_error" || outcome === "failed") return "error";
  if (outcome === "paused") return "paused";
  return "running";
}

function getRunStageCountField(
  stage: RunStage,
): "rubric_gen_count" | "rubric_critic_count" | "score_gen_count" | "score_critic_count" {
  switch (stage) {
    case "rubric_gen":
      return "rubric_gen_count";
    case "rubric_critic":
      return "rubric_critic_count";
    case "score_gen":
      return "score_gen_count";
    case "score_critic":
      return "score_critic_count";
  }
}

async function resolveRunTarget(
  ctx: MutationCtx,
  targetType: RunRequestTargetType,
  targetId: string,
): Promise<{
  sample: Doc<"samples">;
  scoreTarget: Doc<"sample_score_targets"> | null;
}> {
  if (targetType === "sample") {
    const sample = await ctx.db.get(targetId as Id<"samples">);
    if (!sample) {
      throw new Error(`Sample not found for request target: ${targetId}`);
    }
    return { sample, scoreTarget: null };
  }

  const scoreTarget = await ctx.db.get(
    targetId as Id<"sample_score_targets">,
  );
  if (!scoreTarget) {
    throw new Error(`Sample score target not found: ${targetId}`);
  }

  const sample = await ctx.db.get(scoreTarget.sample_id);
  if (!sample) {
    throw new Error(
      `Sample not found for score target ${targetId}: ${scoreTarget.sample_id}`,
    );
  }

  return { sample, scoreTarget };
}

async function maybeAdvanceRunStage(
  ctx: MutationCtx,
  runId: Id<"runs">,
  stage: RunStage,
  options?: {
    start_scheduler?: boolean;
  },
) {
  const run = await ctx.db.get(runId);
  if (!run) {
    return {
      outcome: "missing_run" as const,
      completed: 0,
      failed: 0,
    };
  }
  if (
    run.status === "completed" ||
    run.status === "paused" ||
    run.status === "canceled" ||
    run.status === "error"
  ) {
    return {
      outcome: "terminal_noop" as const,
      completed: 0,
      failed: 0,
    };
  }

  const progress = await getRunStageProgress(ctx, runId, stage);
  if (!progress) {
    return {
      outcome: "deferred_missing_progress" as const,
      completed: 0,
      failed: 0,
    };
  }

  const stageCountField = getRunStageCountField(stage);
  if (run[stageCountField] !== progress.completed) {
    await ctx.db.patch(runId, {
      [stageCountField]: progress.completed,
    });
  }

  if (progress.hasPending) {
    return {
      outcome: "deferred_pending" as const,
      completed: progress.completed,
      failed: progress.failed,
    };
  }

  if (progress.failed > 0) {
    await ctx.db.patch(runId, {
      status: "error",
      current_stage: stage,
    });
    await emitTraceEvent(ctx, {
      trace_id: `run:${runId}`,
      entity_type: "run",
      entity_id: String(runId),
      event_name: "run_terminal_error",
      stage,
      status: "error",
      payload_json: JSON.stringify({
        completed: progress.completed,
        failed: progress.failed,
      }),
    });
    return {
      outcome: "terminal_error" as const,
      completed: progress.completed,
      failed: progress.failed,
    };
  }

  if (run.pause_after === stage) {
    await ctx.db.patch(runId, {
      status: "paused",
      current_stage: stage,
    });
    await emitTraceEvent(ctx, {
      trace_id: `run:${runId}`,
      entity_type: "run",
      entity_id: String(runId),
      event_name: "run_paused_after_stage",
      stage,
      status: "paused",
      payload_json: JSON.stringify({
        completed: progress.completed,
        failed: progress.failed,
        pause_after: run.pause_after,
      }),
    });
    return {
      outcome: "paused" as const,
      completed: progress.completed,
      failed: progress.failed,
    };
  }

  const orchestrator = new RunOrchestrator(ctx);
  const nextStage = orchestrator.nextStageFor(stage);
  if (!nextStage) {
    if (await hasActiveRunTransportWork(ctx, runId, stage)) {
      return {
        outcome: "deferred_active_transport" as const,
        completed: progress.completed,
        failed: progress.failed,
      };
    }
    const completedCount = await getRunCompletedCount(ctx, runId);
    await ctx.db.patch(runId, {
      status: "completed",
      current_stage: stage,
      completed_count: completedCount,
    });
    await syncExperimentTotalCount(ctx, run.experiment_id);
    await emitTraceEvent(ctx, {
      trace_id: `run:${runId}`,
      entity_type: "run",
      entity_id: String(runId),
      event_name: "run_completed",
      stage,
      status: "completed",
      payload_json: JSON.stringify({
        completed: progress.completed,
        failed: progress.failed,
      }),
    });
    return {
      outcome: "completed" as const,
      completed: progress.completed,
      failed: progress.failed,
    };
  }

  if (run.current_stage !== stage) {
    return {
      outcome: "deferred_stage_mismatch" as const,
      completed: progress.completed,
      failed: progress.failed,
    };
  }
  await ctx.db.patch(runId, {
    current_stage: nextStage,
    status: "running",
  });
  await emitTraceEvent(ctx, {
    trace_id: `run:${runId}`,
    entity_type: "run",
    entity_id: String(runId),
    event_name: "run_stage_advanced",
    stage: nextStage,
    status: "running",
    payload_json: JSON.stringify({
      from_stage: stage,
      completed: progress.completed,
      failed: progress.failed,
    }),
  });
  await scheduleRunStageEnqueue(ctx, {
    run_id: runId,
    stage: nextStage,
    reason: `advance_from_${stage}`,
    start_scheduler: options?.start_scheduler,
  });
  return {
    outcome: "advanced" as const,
    completed: progress.completed,
    failed: progress.failed,
  };
}

async function hasActiveRunTransportWork(
  ctx: MutationCtx,
  runId: Id<"runs">,
  stage: RunStage,
): Promise<boolean> {
  const processKey = `run:${runId}:${stage}`;
  const [
    queuedBatch,
    submittingBatch,
    runningBatch,
    finalizingBatch,
    queuedJob,
    runningJob,
  ] = await Promise.all([
    ctx.db
      .query("llm_batches")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", processKey).eq("status", "queued"),
      )
      .first(),
    ctx.db
      .query("llm_batches")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", processKey).eq("status", "submitting"),
      )
      .first(),
    ctx.db
      .query("llm_batches")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", processKey).eq("status", "running"),
      )
      .first(),
    ctx.db
      .query("llm_batches")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", processKey).eq("status", "finalizing"),
      )
      .first(),
    ctx.db
      .query("llm_jobs")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", processKey).eq("status", "queued"),
      )
      .first(),
    ctx.db
      .query("llm_jobs")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", processKey).eq("status", "running"),
      )
      .first(),
  ]);

  return Boolean(
    queuedBatch
    || submittingBatch
    || runningBatch
    || finalizingBatch
    || queuedJob
    || runningJob,
  );
}

async function scheduleRunStageEnqueue(
  ctx: MutationCtx,
  args: {
    run_id: Id<"runs">;
    stage: RunStage;
    reason: string;
    max_requests?: number;
    start_scheduler?: boolean;
  },
): Promise<void> {
  await ctx.scheduler.runAfter(
    0,
    internal.domain.runs.run_service.enqueueRunStage,
    {
      run_id: args.run_id,
      stage: args.stage,
      reason: args.reason,
      max_requests: args.max_requests,
      start_scheduler: args.start_scheduler ?? true,
    },
  );
}

async function markRequestParseFailure(
  ctx: MutationCtx,
  requestId: Id<"llm_requests">,
  error: unknown,
  output: string,
  inputTokens?: number,
  outputTokens?: number,
) {
  const request = await ctx.runQuery(
    internal.domain.llm_calls.llm_request_repo.getLlmRequest,
    { request_id: requestId },
  );
  const message = error instanceof Error ? error.message : String(error);
  const attemptIndex = request.attempt_index ?? 1;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_request_repo.patchRequest,
    {
      request_id: requestId,
      patch: {
        status: "error",
        last_error: message,
        assistant_output: output,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    },
  );

  if (attemptIndex >= ENGINE_SETTINGS.run_policy.max_request_attempts) {
    return;
  }

  const nextAttemptIndex = attemptIndex + 1;
  const retryRequestId = await ctx.runMutation(
    internal.domain.llm_calls.llm_request_repo.createLlmRequest,
    {
      model: request.model,
      system_prompt_id: request.system_prompt_id ?? null,
      user_prompt: request.user_prompt,
      custom_key: request.custom_key,
      attempt_index: nextAttemptIndex,
    },
  );

  await ctx.runMutation(
    internal.domain.llm_calls.llm_request_repo.patchRequest,
    {
      request_id: retryRequestId,
      patch: {
        next_attempt_at: getNextAttemptAt(Date.now()),
      },
    },
  );

  await ctx.runMutation(
    internal.domain.orchestrator.scheduler.requeueRequest,
    { request_id: retryRequestId },
  );
}

function buildLabelMapping(
  config: ExperimentConfig,
  scaleSize: number,
  seed: number,
): Record<string, number> {
  const randomization = resolveRandomizationStrategy(config);
  const scale = resolveScaleStrategy(config);
  if (randomization.anonLabel) {
    return generateLabelMapping(scaleSize, seed);
  }
  const mapping: Record<string, number> = {};
  scale.letterLabels.forEach((label, idx) => {
    mapping[label] = idx + 1;
  });
  return mapping;
}
