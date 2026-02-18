import z from "zod";
import { modelTypeSchema, StateStatusSchema } from "./_shared";
import { zid } from "convex-helpers/server/zod4";

export const WindowStageSchema = z.enum([
    "l0_raw",
    "l1_cleaned",
    "l2_neutralized",
    "l3_abstracted",
]);

export const WindowsTableSchema = z.object({
    status: StateStatusSchema,
    current_stage: WindowStageSchema,
    start_date: z.string(),
    end_date: z.string(),
    model: modelTypeSchema,
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