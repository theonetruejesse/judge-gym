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
import {
  extractReasoningBeforeVerdict,
  parseExpertAgreementResponse,
  parseQualityResponse,
  parseRubricResponse,
} from "./run_parsers";
import {
  resolveRandomizationStrategy,
  resolveScaleStrategy,
  resolveScoringStrategy,
  type ExperimentConfig,
} from "./run_strategies";
import { generateLabelMapping } from "../../utils/randomize";
import { emitTraceEvent } from "../telemetry/emit";
import { getNextAttemptAt } from "../../utils/scheduling";

export const startRunFlow = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    target_count: z.number().int().min(1),
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
      }),
    });

    return { run_id };
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
    const scoreUnit = target.scoreUnit;
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
      if (stage === "score_gen" && (scoreUnit?.score_id ?? sample.score_id)) {
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
        (scoreUnit?.score_critic_id ?? sample.score_critic_id)
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

        const config: ExperimentConfig = {
          rubric_config: {
            scale_size: experiment.rubric_config.scale_size,
            concept: experiment.rubric_config.concept,
          },
          scoring_config: {
            method: experiment.scoring_config.method,
            abstain_enabled: experiment.scoring_config.abstain_enabled,
            evidence_view: experiment.scoring_config.evidence_view,
            randomizations: experiment.scoring_config.randomizations,
          },
        };

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

        const evidence = scoreUnit
          ? await ctx.db.get(scoreUnit.evidence_id)
          : await resolveEvidenceForSample(
              ctx,
              sample,
              experiment,
            );
        if (!evidence) throw new Error("Evidence not found for sample");

        const config: ExperimentConfig = {
          rubric_config: {
            scale_size: experiment.rubric_config.scale_size,
            concept: experiment.rubric_config.concept,
          },
          scoring_config: {
            method: experiment.scoring_config.method,
            abstain_enabled: experiment.scoring_config.abstain_enabled,
            evidence_view: experiment.scoring_config.evidence_view,
            randomizations: experiment.scoring_config.randomizations,
          },
        };

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
          model: sample.model,
          evidence_id: evidence._id,
          llm_request_id: args.request_id,
          justification,
          decoded_scores: decodedScores,
        });

        if (scoreUnit) {
          await ctx.db.patch(scoreUnit._id, { score_id });
        } else {
          await ctx.db.patch(sampleId, { score_id });
        }
      }

      if (stage === "score_critic") {
        const score_id = scoreUnit?.score_id ?? sample.score_id;
        if (!score_id) throw new Error("Score missing for sample");
        const parsed = parseExpertAgreementResponse(args.output);
        const score_critic_id = await ctx.db.insert("score_critics", {
          run_id: sample.run_id,
          sample_id: sampleId,
          model: sample.model,
          llm_request_id: args.request_id,
          justification: parsed.reasoning,
          expert_agreement_prob: parsed.expertAgreementProb,
        });

        if (scoreUnit) {
          await ctx.db.patch(scoreUnit._id, { score_critic_id });
        } else {
          await ctx.db.patch(sampleId, { score_critic_id });
        }
      }
    } catch (error) {
      await markRequestParseFailure(ctx, args.request_id, error);
      await emitTraceEvent(ctx, {
        trace_id: `run:${sample.run_id}`,
        entity_type: "request",
        entity_id: String(args.request_id),
        event_name: "request_parse_error",
        stage,
        status: "error",
        custom_key: args.custom_key,
        payload_json: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
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
    await emitTraceEvent(ctx, {
      trace_id: `run:${sample.run_id}`,
      entity_type: "request",
      entity_id: String(args.request_id),
      event_name: "request_error",
      stage,
      status: "error",
      custom_key: args.custom_key,
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
          job_id: jobId,
          batch_id: null,
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
  handler: async (ctx, args) => {
    await maybeAdvanceRunStage(ctx, args.run_id, args.stage);
  },
});

async function resolveRunTarget(
  ctx: MutationCtx,
  targetType: RunRequestTargetType,
  targetId: string,
): Promise<{
  sample: Doc<"samples">;
  scoreUnit: Doc<"sample_evidence_scores"> | null;
}> {
  if (targetType === "sample") {
    const sample = await ctx.db.get(targetId as Id<"samples">);
    if (!sample) {
      throw new Error(`Sample not found for request target: ${targetId}`);
    }
    return { sample, scoreUnit: null };
  }

  const scoreUnit = await ctx.db.get(
    targetId as Id<"sample_evidence_scores">,
  );
  if (!scoreUnit) {
    throw new Error(`Sample-evidence score unit not found: ${targetId}`);
  }

  const sample = await ctx.db.get(scoreUnit.sample_id);
  if (!sample) {
    throw new Error(
      `Sample not found for score unit ${targetId}: ${scoreUnit.sample_id}`,
    );
  }

  return { sample, scoreUnit };
}

async function maybeAdvanceRunStage(
  ctx: MutationCtx,
  runId: Id<"runs">,
  stage: RunStage,
) {
  const run = await ctx.db.get(runId);
  if (!run) return;
  if (
    run.status === "completed" ||
    run.status === "canceled" ||
    run.status === "error"
  )
    return;

  const orchestrator = new RunOrchestrator(ctx);

  const progress = await orchestrator.getStageProgress(runId, stage);
  if (!progress) return;
  if (progress.hasPending) return;

  if (progress.completed === 0 && progress.failed > 0) {
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
    return;
  }

  const nextStage = orchestrator.nextStageFor(stage);
  if (!nextStage) {
    await ctx.db.patch(runId, {
      status: "completed",
      current_stage: stage,
    });
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
    return;
  }

  if (run.current_stage !== stage) return;
  await ctx.db.patch(runId, { current_stage: nextStage });
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
  await orchestrator.enqueueStage(runId, nextStage);
}

async function markRequestParseFailure(
  ctx: MutationCtx,
  requestId: Id<"llm_requests">,
  error: unknown,
) {
  const request = await ctx.runQuery(
    internal.domain.llm_calls.llm_request_repo.getLlmRequest,
    { request_id: requestId },
  );
  const message = error instanceof Error ? error.message : String(error);
  const attempts = (request.attempts ?? 0) + 1;
  await ctx.runMutation(
    internal.domain.llm_calls.llm_request_repo.patchRequest,
    {
      request_id: requestId,
      patch: {
        status: "error",
        attempts,
        last_error: message,
      },
    },
  );

  if (attempts >= ENGINE_SETTINGS.run_policy.max_request_attempts) {
    return;
  }

  const nextAttempt = attempts + 1;
  const retryRequestId = await ctx.runMutation(
    internal.domain.llm_calls.llm_request_repo.createLlmRequest,
    {
      model: request.model,
      system_prompt: request.system_prompt ?? undefined,
      user_prompt: request.user_prompt,
      custom_key: request.custom_key,
      attempts: nextAttempt,
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

async function resolveEvidenceForSample(
  ctx: MutationCtx,
  sample: Doc<"samples">,
  experiment: Doc<"experiments">,
) {
  const links = await ctx.db
    .query("pool_evidence")
    .withIndex("by_pool", (q) => q.eq("pool_id", experiment.pool_id))
    .collect();

  const ordered = links
    .slice()
    .sort((a, b) => a._creationTime - b._creationTime);

  const evidences: Doc<"evidences">[] = [];
  for (const link of ordered) {
    const evidence = await ctx.db.get(link.evidence_id);
    if (evidence) evidences.push(evidence);
  }

  if (evidences.length === 0) return null;
  const idx = Math.abs(sample.seed) % evidences.length;
  return evidences[idx] ?? null;
}
