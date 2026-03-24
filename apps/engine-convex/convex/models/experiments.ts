import z from "zod";
import { RubricStageConfigSchema, ScoringStageConfigSchema, StateStatusSchema } from "./_shared";
import { zid } from "convex-helpers/server/zod4";
import { RunStageKeySchema } from "@judge-gym/engine-settings/process";
import {
  CompatibilityModeSchema,
  EvidenceSourceKindSchema,
  OutputContractSchema,
  RubricSourceKindSchema,
  StudyKindSchema,
  TaskContractSchema,
} from "@judge-gym/engine-prompts/run";


export const ExperimentsTableSchema = z.object({
    experiment_tag: z.string(),
    study_kind: StudyKindSchema,
    evidence_source_kind: EvidenceSourceKindSchema,
    evidence_set_id: zid("evidence_sets").nullable().optional(),
    rubric_source_kind: RubricSourceKindSchema,
    compatibility_mode: CompatibilityModeSchema,
    task_contract: TaskContractSchema,
    output_contract: OutputContractSchema,
    rubric_config: RubricStageConfigSchema,
    scoring_config: ScoringStageConfigSchema,
    total_count: z.number(),
});
export const RunStageSchema = RunStageKeySchema;
export type RunStage = z.infer<typeof RunStageSchema>;

export const RunsTableSchema = z.object({
    status: StateStatusSchema,
    experiment_id: zid("experiments"),
    current_stage: RunStageSchema,
    pause_after: RunStageSchema.nullable(),
    target_count: z.number(),
    completed_count: z.number(),
    rubric_gen_count: z.number(),
    rubric_critic_count: z.number(),
    score_gen_count: z.number(),
    score_critic_count: z.number(),
    workflow_id: z.string().optional(),
    workflow_run_id: z.string().optional(),
    last_error_message: z.string().nullable().optional(),
});
