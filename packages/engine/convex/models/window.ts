import z from "zod";
import { SemanticLevelSchema, StateStatusSchema } from "./_shared";
import { modelTypeSchema } from "../platform/providers/provider_types";
import { zid } from "convex-helpers/server/zod4";

export const WindowsTableSchema = z.object({
    status: StateStatusSchema,
    current_stage: SemanticLevelSchema,
    model: modelTypeSchema,
    start_date: z.string(),
    end_date: z.string(),
    country: z.string(),
    query: z.string(),
    window_tag: z.string(),
});

export const EvidencesTableSchema = z.object({
    window_id: zid("windows"),
    title: z.string(),
    url: z.string(),
    l0_raw_content: z.string(),
    l1_cleaned_content: z.string().nullable(),
    l1_request_id: zid("llm_requests").nullable(),
    l2_neutralized_content: z.string().nullable(),
    l2_request_id: zid("llm_requests").nullable(),
    l3_abstracted_content: z.string().nullable(),
    l3_request_id: zid("llm_requests").nullable(),
});