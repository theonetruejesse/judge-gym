import z from "zod";
import { modelTypeSchema } from "./_shared";
import { zid } from "convex-helpers/server/zod4";

export const SamplesTableSchema = z.object({
    run_id: zid("runs"),
    experiment_id: zid("experiments"),
    model: modelTypeSchema,
    seed: z.number(),
    rubric_id: zid("rubrics").nullable(),
    rubric_critic_id: zid("rubric_critics").nullable(),
    score_id: zid("scores").nullable(),
    score_critic_id: zid("score_critics").nullable(),
});

export const RubricStageSchema = z.object({
    stage_number: z.number(),
    label: z.string(), // concise label for this stage
    criteria: z.array(z.string()), // observable indicators
});

export const RubricsTableSchema = z.object({
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
    sample_id: zid("samples"),
    model: modelTypeSchema,
    llm_request_id: zid("llm_requests"),
    justification: z.string(),
    expert_agreement_prob: RubricQualityStatsSchema,
});

export const ScoresTableSchema = z.object({
    sample_id: zid("samples"),
    model: modelTypeSchema,
    evidence_id: zid("evidences"),
    llm_request_id: zid("llm_requests"),
    justification: z.string(),
    decoded_scores: z.array(z.number()),
});

export const ScoreCriticsTableSchema = z.object({
    sample_id: zid("samples"),
    model: modelTypeSchema,
    llm_request_id: zid("llm_requests"),
    justification: z.string(),
    expert_agreement_prob: z.number(),
});