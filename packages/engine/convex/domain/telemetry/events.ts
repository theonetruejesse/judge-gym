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
    const existingCounter = await ctx.db
      .query("telemetry_trace_counters")
      .withIndex("by_trace_id", (q) => q.eq("trace_id", args.trace_id))
      .first();

    let seq = 1;
    if (!existingCounter) {
      await ctx.db.insert("telemetry_trace_counters", {
        trace_id: args.trace_id,
        next_seq: 2,
      });
    } else {
      seq = existingCounter.next_seq;
      await ctx.db.patch(existingCounter._id, {
        next_seq: existingCounter.next_seq + 1,
      });
    }

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
