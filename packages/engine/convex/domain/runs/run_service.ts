import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../utils/custom_fns";
import { RunOrchestrator } from "./run_orchestrator";
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

export const startRunFlow = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    target_count: z.number().int().min(1),
  }),
  returns: z.object({
    run_id: zid("runs"),
    samples_created: z.number(),
  }),
  handler: async (ctx, args) => {
    const experiment = await ctx.db.get(args.experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const run_id = await ctx.db.insert("runs", {
      experiment_id: experiment._id,
      target_count: args.target_count,
      status: "start",
      current_stage: "rubric_gen",
    });

    let samples_created = 0;
    for (let i = 0; i < args.target_count; i++) {
      const seed = i + 1;
      await ctx.db.insert("samples", {
        run_id,
        experiment_id: experiment._id,
        model: experiment.scoring_config.model,
        seed,
        rubric_id: null,
        rubric_critic_id: null,
        score_id: null,
        score_critic_id: null,
      });
      samples_created += 1;
    }

    await ctx.db.patch(run_id, {
      status: "running",
      current_stage: "rubric_gen",
    });

    const orchestrator = new RunOrchestrator(ctx);
    await orchestrator.enqueueStage(run_id, "rubric_gen");

    return { run_id, samples_created };
  },
});

export const seedRunSamples = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
  }),
  returns: z.number(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.run_id);
    if (!run) throw new Error("Run not found");
    const experiment = await ctx.db.get(run.experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const existing = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", run._id))
      .collect();
    if (existing.length >= run.target_count) return 0;

    let created = 0;
    for (let i = existing.length; i < run.target_count; i++) {
      const seed = i + 1;
      await ctx.db.insert("samples", {
        run_id: run._id,
        experiment_id: experiment._id,
        model: experiment.scoring_config.model,
        seed,
        rubric_id: null,
        rubric_critic_id: null,
        score_id: null,
        score_critic_id: null,
      });
      created += 1;
    }
    return created;
  },
});

export const startRunOrchestration = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.run_id);
    if (!run) throw new Error("Run not found");
    if (
      run.status === "completed" ||
      run.status === "canceled" ||
      run.status === "error"
    )
      return;

    await ctx.db.patch(args.run_id, {
      status: "running",
      current_stage: "rubric_gen",
    });

    const orchestrator = new RunOrchestrator(ctx);
    await orchestrator.enqueueStage(args.run_id, "rubric_gen");
  },
});

export const enqueueRunStage = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    stage: RunStageSchema,
  }),
  handler: async (ctx, args) => {
    const orchestrator = new RunOrchestrator(ctx);
    await orchestrator.enqueueStage(args.run_id, args.stage);
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
    const { targetId, stage } = orchestrator.parseRequestKey(args.custom_key);
    const sampleId = targetId as Id<"samples">;
    const sample = await ctx.db.get(sampleId);
    if (!sample) throw new Error("Sample not found");

    try {
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

        const evidence = await resolveEvidenceForSample(
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
          sample_id: sampleId,
          model: sample.model,
          evidence_id: evidence._id,
          llm_request_id: args.request_id,
          justification,
          decoded_scores: decodedScores,
        });

        await ctx.db.patch(sampleId, { score_id });
      }

      if (stage === "score_critic") {
        if (!sample.score_id) throw new Error("Score missing for sample");
        const parsed = parseExpertAgreementResponse(args.output);
        const score_critic_id = await ctx.db.insert("score_critics", {
          sample_id: sampleId,
          model: sample.model,
          llm_request_id: args.request_id,
          justification: parsed.reasoning,
          expert_agreement_prob: parsed.expertAgreementProb,
        });

        await ctx.db.patch(sampleId, { score_critic_id });
      }
    } catch (error) {
      await markRequestParseFailure(ctx, args.request_id, error);
      await maybeAdvanceRunStage(ctx, sample.run_id, stage);
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

    await maybeAdvanceRunStage(ctx, sample.run_id, stage);
  },
});

export const handleRequestError = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
    custom_key: z.string(),
  }),
  handler: async (ctx, args) => {
    const orchestrator = new RunOrchestrator(ctx);
    const { targetId, stage } = orchestrator.parseRequestKey(args.custom_key);
    const sample = await ctx.db.get(targetId as Id<"samples">);
    if (!sample) throw new Error("Sample not found");
    await maybeAdvanceRunStage(ctx, sample.run_id, stage);
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
    const { targetId, stage } = orchestrator.parseRequestKey(request.custom_key);

    const sample = await ctx.db.get(targetId as Id<"samples">);
    if (!sample) {
      throw new Error(`Sample not found for retry: ${targetId}`);
    }

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
  },
});

const STAGE_ORDER: RunStage[] = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
];

function nextStageFor(stage: RunStage): RunStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1) return null;
  return STAGE_ORDER[idx + 1] ?? null;
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

  const samples = await ctx.db
    .query("samples")
    .withIndex("by_run", (q) => q.eq("run_id", runId))
    .collect();

  if (samples.length === 0) return;

  let completed = 0;
  let failed = 0;
  let hasPending = false;
  const orchestrator = new RunOrchestrator(ctx);

  for (const sample of samples) {
    const outputId = getStageOutputId(sample, stage);
    if (outputId) {
      completed += 1;
      continue;
    }

    if (isStageBlockedByMissingInput(sample, stage)) {
      failed += 1;
      continue;
    }

    const custom_key = orchestrator.makeRequestKey(sample._id, stage);
    const pendingRequests = await ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", custom_key).eq("status", "pending"),
      )
      .collect();
    if (pendingRequests.length > 0) {
      hasPending = true;
      continue;
    }

    const requests = await ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key", (q) => q.eq("custom_key", custom_key))
      .collect();
    if (requests.length === 0) {
      hasPending = true;
      continue;
    }

    const maxAttempts = requests.reduce(
      (max, req) => Math.max(max, req.attempts ?? 0),
      0,
    );
    if (maxAttempts >= ENGINE_SETTINGS.run_policy.max_request_attempts) {
      failed += 1;
      continue;
    }
    hasPending = true;
  }

  if (hasPending) return;

  if (completed === 0 && failed > 0) {
    await ctx.db.patch(runId, {
      status: "error",
      current_stage: stage,
    });
    return;
  }

  const nextStage = nextStageFor(stage);
  if (!nextStage) {
    await ctx.db.patch(runId, {
      status: "completed",
      current_stage: stage,
    });
    return;
  }

  if (run.current_stage !== stage) return;
  await ctx.db.patch(runId, { current_stage: nextStage });
  await orchestrator.enqueueStage(runId, nextStage);
}

function getStageOutputId(sample: Doc<"samples">, stage: RunStage) {
  switch (stage) {
    case "rubric_gen":
      return sample.rubric_id;
    case "rubric_critic":
      return sample.rubric_critic_id;
    case "score_gen":
      return sample.score_id;
    case "score_critic":
      return sample.score_critic_id;
    default:
      return null;
  }
}

function isStageBlockedByMissingInput(sample: Doc<"samples">, stage: RunStage) {
  if (stage === "rubric_critic" && !sample.rubric_id) return true;
  if (stage === "score_gen" && !sample.rubric_id) return true;
  if (stage === "score_critic" && !sample.score_id) return true;
  return false;
}

async function markRequestParseFailure(
  ctx: MutationCtx,
  requestId: Id<"llm_requests">,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  await ctx.runMutation(
    internal.domain.llm_calls.llm_request_repo.patchRequest,
    {
      request_id: requestId,
      patch: {
        status: "error",
        attempts: ENGINE_SETTINGS.run_policy.max_request_attempts,
        last_error: message,
      },
    },
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
    .query("experiment_evidence")
    .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
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
