import z from "zod";
import {
  zInternalAction,
  zInternalMutation,
  zInternalQuery,
} from "../../utils/custom_fns";
import {
  LocalTraceEventSchema,
  ProcessTelemetryTypeSchema,
  TelemetryEntityTypeSchema,
} from "../../models/telemetry";

const MAX_LOCAL_RECENT_EVENTS = 32;
const BATCH_MILESTONE_EVENTS = new Set([
  "batch_submitting",
  "batch_submitted",
  "batch_finalizing_started",
  "batch_success",
  "batch_apply_error",
]);
const JOB_MILESTONE_EVENTS = new Set([
  "job_queued_handler_started",
  "job_finalized",
]);

export const EmitTelemetryEventArgsSchema = z.object({
  trace_id: z.string(),
  entity_type: TelemetryEntityTypeSchema,
  entity_id: z.string(),
  event_name: z.string(),
  stage: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  custom_key: z.string().nullable().optional(),
  attempt: z.number().int().min(0).nullable().optional(),
  ts_ms: z.number().optional(),
  payload_json: z.string().nullable().optional(),
});

export type EmitTelemetryEventArgs = z.infer<typeof EmitTelemetryEventArgsSchema>;

const ProcessRefSchema = z.object({
  process_type: ProcessTelemetryTypeSchema,
  process_id: z.string(),
});

const AxiomEventEnvelopeSchema = LocalTraceEventSchema.extend({
  kind: z.literal("judge_gym_telemetry"),
  process_type: ProcessTelemetryTypeSchema.nullable(),
  process_id: z.string().nullable(),
  payload: z.unknown().optional(),
  service: z.literal("judge-gym-engine"),
  dataset: z.string().nullable().optional(),
  external_trace_ref: z.string().nullable(),
});

const QueriedTraceEventSchema = z.object({
  trace_id: z.string(),
  seq: z.number(),
  entity_type: z.string(),
  entity_id: z.string(),
  event_name: z.string(),
  stage: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  custom_key: z.string().nullable().optional(),
  attempt: z.number().nullable().optional(),
  ts_ms: z.number(),
  payload_json: z.string().nullable().optional(),
});

function maybeAxiomDataset(): string | null {
  return process.env.AXIOM_DATASET ?? null;
}

function getAxiomDataset(): string {
  const dataset = maybeAxiomDataset();
  if (!dataset) {
    throw new Error("AXIOM_DATASET is not set");
  }
  return dataset;
}

function getAxiomToken(): string {
  const token = process.env.AXIOM_TOKEN;
  if (!token) {
    throw new Error("AXIOM_TOKEN is not set");
  }
  return token;
}

function parsePayloadJson(payload_json: string | null | undefined): unknown {
  if (!payload_json) return undefined;
  try {
    return JSON.parse(payload_json);
  } catch {
    return payload_json;
  }
}

function escapeAplSingleQuoted(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

export function buildEventSeq(ts_ms: number) {
  return ts_ms * 1_000 + Math.floor(Math.random() * 1_000);
}

export function parseProcessRefFromTraceId(traceId: string): z.infer<typeof ProcessRefSchema> | null {
  const [processType, processId] = traceId.split(":");
  if ((processType === "run" || processType === "window") && processId) {
    return {
      process_type: processType,
      process_id: processId,
    };
  }
  return null;
}

export function buildExternalTraceRef(trace_id: string, dataset = maybeAxiomDataset()): string | null {
  if (!dataset) return null;
  return `axiom dataset=${dataset} trace_id=${trace_id}`;
}

export function buildLocalTraceEvent(
  args: EmitTelemetryEventArgs,
): z.infer<typeof LocalTraceEventSchema> {
  const ts_ms = args.ts_ms ?? Date.now();
  return {
    trace_id: args.trace_id,
    seq: buildEventSeq(ts_ms),
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    event_name: args.event_name,
    stage: args.stage ?? null,
    status: args.status ?? null,
    custom_key: args.custom_key ?? null,
    attempt: args.attempt ?? null,
    ts_ms,
    payload_json: args.payload_json ?? null,
  };
}

export function shouldMirrorLocally(
  trace_event: z.infer<typeof LocalTraceEventSchema>,
): boolean {
  const processRef = parseProcessRefFromTraceId(trace_event.trace_id);
  if (!processRef) return false;
  if (trace_event.entity_type === processRef.process_type) return true;
  if (trace_event.status === "error" || trace_event.status === "failed") return true;
  if (trace_event.entity_type === "batch") {
    return BATCH_MILESTONE_EVENTS.has(trace_event.event_name);
  }
  if (trace_event.entity_type === "job") {
    return JOB_MILESTONE_EVENTS.has(trace_event.event_name);
  }
  return false;
}

function appendRecentEvent(
  current: z.infer<typeof LocalTraceEventSchema>[],
  nextEvent: z.infer<typeof LocalTraceEventSchema>,
) {
  if (current.length === 0) return [nextEvent];
  const last = current[current.length - 1];
  if ((last?.seq ?? 0) <= nextEvent.seq) {
    return [...current, nextEvent].slice(-MAX_LOCAL_RECENT_EVENTS);
  }
  return [...current, nextEvent]
    .sort((a, b) => a.seq - b.seq)
    .slice(-MAX_LOCAL_RECENT_EVENTS);
}

export function buildAxiomEventEnvelope(
  args: EmitTelemetryEventArgs,
): z.infer<typeof AxiomEventEnvelopeSchema> {
  const trace_event = buildLocalTraceEvent(args);
  const processRef = parseProcessRefFromTraceId(args.trace_id);
  const dataset = maybeAxiomDataset();

  return {
    kind: "judge_gym_telemetry",
    ...trace_event,
    payload: parsePayloadJson(args.payload_json),
    process_type: processRef?.process_type ?? null,
    process_id: processRef?.process_id ?? null,
    service: "judge-gym-engine",
    dataset,
    external_trace_ref: buildExternalTraceRef(args.trace_id, dataset),
  };
}

export const recordProcessObservability = zInternalMutation({
  args: z.object({
    process_type: ProcessTelemetryTypeSchema,
    process_id: z.string(),
    trace_event: LocalTraceEventSchema,
    external_trace_ref: z.string().nullable(),
    last_error_summary: z.string().nullable().optional(),
  }),
  returns: z.object({
    updated: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("process_observability")
      .withIndex("by_process", (q) =>
        q.eq("process_type", args.process_type).eq("process_id", args.process_id),
      )
      .first();

    const recent_events = appendRecentEvent(existing?.recent_events ?? [], args.trace_event);

    const patch = {
      trace_id: args.trace_event.trace_id,
      telemetry_backend: "axiom" as const,
      external_trace_ref: args.external_trace_ref ?? existing?.external_trace_ref ?? null,
      last_milestone_at_ms: args.trace_event.ts_ms,
      last_event_name: args.trace_event.event_name,
      last_stage: args.trace_event.stage ?? null,
      last_status: args.trace_event.status ?? null,
      recent_events,
      last_error_summary: args.last_error_summary ?? existing?.last_error_summary ?? null,
      updated_at_ms: args.trace_event.ts_ms,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { updated: true };
    }

    await ctx.db.insert("process_observability", {
      process_type: args.process_type,
      process_id: args.process_id,
      ...patch,
    });
    return { updated: true };
  },
});

export const getProcessObservability = zInternalQuery({
  args: z.object({
    process_type: ProcessTelemetryTypeSchema,
    process_id: z.string(),
  }),
  returns: ProcessRefSchema.extend({
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
  }).nullable(),
  handler: async (ctx, args) => {
    return ctx.db
      .query("process_observability")
      .withIndex("by_process", (q) =>
        q.eq("process_type", args.process_type).eq("process_id", args.process_id),
      )
      .first();
  },
});

export const exportEvent = zInternalAction({
  args: z.object({
    event: AxiomEventEnvelopeSchema,
  }),
  returns: z.object({
    ok: z.boolean(),
    status: z.number(),
    dataset: z.string(),
    trace_id: z.string(),
    response_text: z.string().optional(),
  }),
  handler: async (_ctx, args) => {
    const token = getAxiomToken();
    const dataset = getAxiomDataset();
    const response = await fetch(
      `https://api.axiom.co/v1/datasets/${encodeURIComponent(dataset)}/ingest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            ...args.event,
            dataset,
            external_trace_ref: buildExternalTraceRef(args.event.trace_id, dataset),
          },
        ]),
      },
    );
    const response_text = await response.text();
    if (!response.ok) {
      throw new Error(`Axiom ingest error ${response.status}: ${response_text}`);
    }
    return {
      ok: true,
      status: response.status,
      dataset,
      trace_id: args.event.trace_id,
      response_text,
    };
  },
});

export const listByTrace = zInternalQuery({
  args: z.object({
    trace_id: z.string(),
    cursor_seq: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  returns: z.object({
    events: z.array(LocalTraceEventSchema),
    next_cursor_seq: z.number().nullable(),
    telemetry_backend: z.literal("axiom"),
    external_trace_ref: z.string().nullable(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const observability = await ctx.db
      .query("process_observability")
      .withIndex("by_trace", (q) => q.eq("trace_id", args.trace_id))
      .first();

    if (!observability) {
      return {
        events: [],
        next_cursor_seq: null,
        telemetry_backend: "axiom" as const,
        external_trace_ref: buildExternalTraceRef(args.trace_id),
      };
    }

    const filtered = observability.recent_events
      .filter((event) => args.cursor_seq === undefined || event.seq > args.cursor_seq)
      .sort((a, b) => a.seq - b.seq);

    const rows = filtered.slice(0, limit + 1);
    const sliced = rows.slice(0, limit);
    const next_cursor_seq =
      rows.length > limit ? (sliced[sliced.length - 1]?.seq ?? null) : null;

    return {
      events: sliced,
      next_cursor_seq,
      telemetry_backend: "axiom" as const,
      external_trace_ref: observability.external_trace_ref ?? buildExternalTraceRef(args.trace_id),
    };
  },
});
