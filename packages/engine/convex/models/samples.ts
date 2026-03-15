import z from "zod";
import { modelTypeSchema } from "../platform/providers/provider_types";
import { zid } from "convex-helpers/server/zod4";

export const SamplesTableSchema = z.object({
    run_id: zid("runs"),
    experiment_id: zid("experiments"),
    model: modelTypeSchema,
    seed: z.number(),
    rubric_id: zid("rubrics").nullable(),
    rubric_critic_id: zid("rubric_critics").nullable(),
    score_target_total: z.number(),
    score_count: z.number(),
    score_critic_count: z.number(),
});

export const RubricStageSchema = z.object({
    stage_number: z.number(),
    label: z.string(), // concise label for this stage
    criteria: z.array(z.string()), // observable indicators
});

export const RubricsTableSchema = z.object({
    run_id: zid("runs"),
    sample_id: zid("samples"),
    model: modelTypeSchema,
    concept: z.string(),
    scale_size: z.number(),
    llm_request_id: zid("llm_requests"),
    justification: z.string(),
    stages: z.array(RubricStageSchema),
    label_mapping: z.record(z.string(), z.number()),
});

export const RubricQualityStatsSchema = z.object({
    observability_score: z.number(),
    discriminability_score: z.number(),
});

export const RubricCriticsTableSchema = z.object({
    run_id: zid("runs"),
    sample_id: zid("samples"),
    model: modelTypeSchema,
    llm_request_id: zid("llm_requests"),
    justification: z.string(),
    expert_agreement_prob: RubricQualityStatsSchema,
});

export const ScoresTableSchema = z.object({
    run_id: zid("runs"),
    sample_id: zid("samples"),
    score_target_id: zid("sample_score_targets"),
    model: modelTypeSchema,
    llm_request_id: zid("llm_requests"),
    justification: z.string(),
    decoded_scores: z.array(z.number()),
});

export const ScoreCriticsTableSchema = z.object({
    run_id: zid("runs"),
    sample_id: zid("samples"),
    score_target_id: zid("sample_score_targets"),
    model: modelTypeSchema,
    llm_request_id: zid("llm_requests"),
    justification: z.string(),
    expert_agreement_prob: z.number(),
});

export const SampleScoreTargetModeSchema = z.enum([
    "single_evidence",
    "bundle",
]);

export const SampleScoreTargetsTableSchema = z.object({
    run_id: zid("runs"),
    sample_id: zid("samples"),
    target_mode: SampleScoreTargetModeSchema,
    score_id: zid("scores").nullable(),
    score_critic_id: zid("score_critics").nullable(),
});

export const SampleScoreTargetItemsTableSchema = z.object({
    score_target_id: zid("sample_score_targets"),
    evidence_id: zid("evidences"),
    window_id: zid("windows"),
    position: z.number().int().min(0),
});
