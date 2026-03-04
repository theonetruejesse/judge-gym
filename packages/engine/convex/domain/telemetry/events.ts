import z from "zod";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import {
  TelemetryEntityTypeSchema,
  TelemetryEventsTableSchema,
} from "../../models/telemetry";

export const emitEvent = zInternalMutation({
  args: z.object({
    trace_id: TelemetryEventsTableSchema.shape.trace_id,
    entity_type: TelemetryEntityTypeSchema,
    entity_id: TelemetryEventsTableSchema.shape.entity_id,
    event_name: TelemetryEventsTableSchema.shape.event_name,
    stage: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    custom_key: z.string().nullable().optional(),
    attempt: z.number().int().min(0).nullable().optional(),
    ts_ms: z.number().optional(),
    payload_json: z.string().nullable().optional(),
  }),
  returns: z.object({
    seq: z.number(),
  }),
  handler: async (ctx, args) => {
    const ts_ms = args.ts_ms ?? Date.now();
    // Hot traces can emit many events concurrently (especially request-level events).
    // Avoid a shared per-trace counter write hotspot by deriving a high-entropy seq.
    // This preserves sortability by event time while eliminating counter OCC conflicts.
    const seq = ts_ms * 1_000 + Math.floor(Math.random() * 1_000);

    await ctx.db.insert("telemetry_events", {
      trace_id: args.trace_id,
      seq,
      entity_type: args.entity_type,
      entity_id: args.entity_id,
      event_name: args.event_name,
      stage: args.stage ?? null,
      status: args.status ?? null,
      custom_key: args.custom_key ?? null,
      attempt: args.attempt ?? null,
      ts_ms,
      payload_json: args.payload_json ?? null,
    });

    const existingEntityState = await ctx.db
      .query("telemetry_entity_state")
      .withIndex("by_entity", (q) =>
        q.eq("entity_type", args.entity_type).eq("entity_id", args.entity_id),
      )
      .first();
    const statePatch = {
      trace_id: args.trace_id,
      last_seq: seq,
      last_event_name: args.event_name,
      last_stage: args.stage ?? null,
      last_status: args.status ?? null,
      last_custom_key: args.custom_key ?? null,
      last_attempt: args.attempt ?? null,
      last_ts_ms: ts_ms,
      last_payload_json: args.payload_json ?? null,
    };
    if (existingEntityState) {
      await ctx.db.patch(existingEntityState._id, statePatch);
    } else {
      await ctx.db.insert("telemetry_entity_state", {
        entity_type: args.entity_type,
        entity_id: args.entity_id,
        ...statePatch,
      });
    }

    return { seq };
  },
});

export const listByTrace = zInternalQuery({
  args: z.object({
    trace_id: z.string(),
    cursor_seq: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  returns: z.object({
    events: z.array(
      z.object({
        trace_id: z.string(),
        seq: z.number(),
        entity_type: TelemetryEntityTypeSchema,
        entity_id: z.string(),
        event_name: z.string(),
        stage: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        custom_key: z.string().nullable().optional(),
        attempt: z.number().nullable().optional(),
        ts_ms: z.number(),
        payload_json: z.string().nullable().optional(),
      }),
    ),
    next_cursor_seq: z.number().nullable(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    let query = ctx.db
      .query("telemetry_events")
      .withIndex("by_trace_seq", (q) => q.eq("trace_id", args.trace_id));

    if (args.cursor_seq !== undefined) {
      query = ctx.db
        .query("telemetry_events")
        .withIndex("by_trace_seq", (q) =>
          q.eq("trace_id", args.trace_id).gt("seq", args.cursor_seq as number),
        );
    }

    const rows = await query.take(limit + 1);
    const sliced = rows.slice(0, limit);
    const next_cursor_seq =
      rows.length > limit ? (sliced[sliced.length - 1]?.seq ?? null) : null;

    return {
      events: sliced,
      next_cursor_seq,
    };
  },
});

export const getEntityState = zInternalQuery({
  args: z.object({
    entity_type: TelemetryEntityTypeSchema,
    entity_id: z.string(),
  }),
  returns: z
    .object({
      entity_type: TelemetryEntityTypeSchema,
      entity_id: z.string(),
      trace_id: z.string(),
      last_seq: z.number(),
      last_event_name: z.string(),
      last_stage: z.string().nullable().optional(),
      last_status: z.string().nullable().optional(),
      last_custom_key: z.string().nullable().optional(),
      last_attempt: z.number().nullable().optional(),
      last_ts_ms: z.number(),
      last_payload_json: z.string().nullable().optional(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    return ctx.db
      .query("telemetry_entity_state")
      .withIndex("by_entity", (q) =>
        q.eq("entity_type", args.entity_type).eq("entity_id", args.entity_id),
      )
      .first();
  },
});
