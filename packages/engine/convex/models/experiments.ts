import z from "zod";
import { RubricStageConfigSchema, ScoringStageConfigSchema, StateStatusSchema } from "./_shared";
import { zid } from "convex-helpers/server/zod4";


export const ExperimentsTableSchema = z.object({
    experiment_tag: z.string(),
    pool_id: zid("pools"),
    rubric_config: RubricStageConfigSchema,
    scoring_config: ScoringStageConfigSchema,
});

export const RunStageSchema = z.enum([
    "rubric_gen",
    "rubric_critic",
    "score_gen",
    "score_critic",
]);
export type RunStage = z.infer<typeof RunStageSchema>;

export const RunsTableSchema = z.object({
    status: StateStatusSchema,
    experiment_id: zid("experiments"),
    current_stage: RunStageSchema,
    target_count: z.number(),
});
