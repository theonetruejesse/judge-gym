import z from "zod";
import { SemanticLevelSchema, StateStatusSchema } from "./_shared";
import { modelTypeSchema } from "@judge-gym/engine-settings/provider";
import { WindowStageKeySchema } from "@judge-gym/engine-settings/process";
import { zid } from "convex-helpers/server/zod4";

export const WindowSourceProviderSchema = z.enum([
    "firecrawl",
]);

export const WindowsTableSchema = z.object({
    window_tag: z.string(),
    source_provider: WindowSourceProviderSchema,
    start_date: z.string(),
    end_date: z.string(),
    country: z.string(),
    query: z.string(),
    default_target_count: z.number(),
    default_target_stage: SemanticLevelSchema,
});

export const WindowRunsTableSchema = z.object({
    window_id: zid("windows"),
    status: StateStatusSchema,
    current_stage: SemanticLevelSchema,
    pause_after: WindowStageKeySchema.nullable(),
    target_stage: SemanticLevelSchema,
    target_count: z.number(),
    completed_count: z.number(),
    model: modelTypeSchema,
    workflow_id: z.string().nullable().optional(),
    workflow_run_id: z.string().nullable().optional(),
    last_error_message: z.string().nullable().optional(),
});

export const EvidencesTableSchema = z.object({
    window_id: zid("windows"),
    window_run_id: zid("window_runs"),
    title: z.string(),
    url: z.string(),
    l0_raw_content: z.string(),
    l1_cleaned_content: z.string().nullable(),
    l1_attempt_id: zid("llm_attempts").nullable().optional(),
    l1_error_message: z.string().nullable().optional(),
    l2_neutralized_content: z.string().nullable(),
    l2_attempt_id: zid("llm_attempts").nullable().optional(),
    l2_error_message: z.string().nullable().optional(),
    l3_abstracted_content: z.string().nullable(),
    l3_attempt_id: zid("llm_attempts").nullable().optional(),
    l3_error_message: z.string().nullable().optional(),
});

export const PoolsTableSchema = z.object({
    pool_tag: z.string(),
    evidence_count: z.number(),
});

export const PoolEvidencesTableSchema = z.object({
    pool_id: zid("pools"),
    evidence_id: zid("evidences"),
});
