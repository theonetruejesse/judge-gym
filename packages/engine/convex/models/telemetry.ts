import z from "zod";

export const TelemetryEntityTypeSchema = z.enum([
  "window",
  "run",
  "batch",
  "job",
  "request",
  "scheduler",
]);

export const TelemetryEventsTableSchema = z.object({
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

export const TelemetryTraceCountersTableSchema = z.object({
  trace_id: z.string(),
  next_seq: z.number().int().min(1),
});
