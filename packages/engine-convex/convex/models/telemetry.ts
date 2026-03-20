import z from "zod";

export const TelemetryEntityTypeSchema = z.enum([
  "window",
  "run",
  "batch",
  "job",
  "request",
  "scheduler",
]);

export const ProcessTelemetryTypeSchema = z.enum([
  "window",
  "run",
]);

export const LocalTraceEventSchema = z.object({
  trace_id: z.string(),
  seq: z.number().int().min(1),
  entity_type: TelemetryEntityTypeSchema,
  entity_id: z.string(),
  event_name: z.string(),
  stage: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  custom_key: z.string().nullable().optional(),
  attempt: z.number().int().min(0).nullable().optional(),
  ts_ms: z.number(),
  payload_json: z.string().nullable().optional(),
});

export const ProcessObservabilityTableSchema = z.object({
  process_type: ProcessTelemetryTypeSchema,
  process_id: z.string(),
  trace_id: z.string(),
  telemetry_backend: z.literal("axiom"),
  external_trace_ref: z.string().nullable(),
  last_milestone_at_ms: z.number(),
  last_event_name: z.string(),
  last_stage: z.string().nullable().optional(),
  last_status: z.string().nullable().optional(),
  recent_events: z.array(LocalTraceEventSchema),
  last_error_summary: z.string().nullable().optional(),
  updated_at_ms: z.number(),
});
