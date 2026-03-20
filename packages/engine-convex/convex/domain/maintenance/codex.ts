import z from "zod";
import { internal } from "../../_generated/api";
import { zAction, zQuery } from "../../utils/custom_fns";
import { buildAxiomEventEnvelope, buildExternalTraceRef } from "../telemetry/events";

const ProcessTypeSchema = z.enum(["run", "window"]);

const AnalyzeStageSummarySchema = z.object({
  stage: z.string(),
  first_ts_ms: z.number().nullable(),
  last_ts_ms: z.number().nullable(),
  duration_ms: z.number().nullable(),
  route: z.enum(["job", "batch", "mixed", "none"]),
  request_applied: z.number(),
  request_apply_duplicate_success: z.number(),
  request_error: z.number(),
  job_queued_handler_started: z.number(),
  job_running_polled: z.number(),
  job_finalized: z.number(),
  batch_queued_handler_started: z.number(),
  batch_polled: z.number(),
  batch_success: z.number(),
  batch_poll_claim_denied: z.number(),
  batch_submit_claim_denied: z.number(),
});

const ProcessTelemetryAnalysisSchema = z.object({
  process_type: ProcessTypeSchema,
  process_id: z.string(),
  trace_id: z.string(),
  telemetry_backend: z.literal("axiom"),
  external_trace_ref: z.string().nullable(),
  sampled_events: z.number(),
  reached_end_of_trace: z.boolean(),
  seq_min: z.number().nullable(),
  seq_max: z.number().nullable(),
  missing_seq_count: z.number(),
  duplicate_seq_count: z.number(),
  first_ts_ms: z.number().nullable(),
  last_ts_ms: z.number().nullable(),
  duration_ms: z.number().nullable(),
  event_counts: z.array(z.object({
    event_name: z.string(),
    count: z.number(),
  })),
  stage_summaries: z.array(AnalyzeStageSummarySchema),
  request_stats: z.object({
    unique_request_entities: z.number(),
    request_applied_total: z.number(),
    duplicate_apply_success_total: z.number(),
    requests_with_duplicate_apply_success: z.number(),
    max_duplicate_apply_success_per_request: z.number(),
  }),
  job_stats: z.object({
    unique_job_entities: z.number(),
    job_finalized_total: z.number(),
    jobs_finalized_multiple_times: z.number(),
    max_job_finalized_per_job: z.number(),
  }),
  terminal_stats: z.object({
    terminal_event_name: z.string().nullable(),
    terminal_seq: z.number().nullable(),
    events_after_terminal: z.number(),
  }),
});

const TailTraceReturnSchema = z.object({
  events: z.array(
    z.object({
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
    }),
  ),
  next_cursor_seq: z.number().nullable(),
  telemetry_backend: z.literal("axiom"),
  external_trace_ref: z.string().nullable(),
});

type AnalyzeStageSummary = z.infer<typeof AnalyzeStageSummarySchema>;
type ProcessTelemetryAnalysis = z.infer<typeof ProcessTelemetryAnalysisSchema>;
type TailTraceReturn = z.infer<typeof TailTraceReturnSchema>;

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function isTerminalEvent(processType: "run" | "window", eventName: string) {
  return processType === "run"
    ? eventName === "run_completed" || eventName === "run_process_failed"
    : eventName === "window_completed" || eventName === "window_process_failed";
}

export const tailTrace = zQuery({
  args: z.object({
    trace_id: z.string(),
    cursor_seq: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  returns: TailTraceReturnSchema,
  handler: async (ctx, args): Promise<TailTraceReturn> => {
    return ctx.runQuery(internal.domain.telemetry.events.listByTrace, args);
  },
});

export const analyzeProcessTelemetry = zQuery({
  args: z.object({
    process_type: ProcessTypeSchema,
    process_id: z.string(),
    max_events: z.number().int().min(50).max(20_000).default(5_000),
  }),
  returns: ProcessTelemetryAnalysisSchema,
  handler: async (ctx, args): Promise<ProcessTelemetryAnalysis> => {
    const observability = await ctx.runQuery(internal.domain.telemetry.events.getProcessObservability, {
      process_type: args.process_type,
      process_id: args.process_id,
    });
    const events = (observability?.recent_events ?? [])
      .slice(-args.max_events)
      .slice()
      .sort((left, right) => left.seq - right.seq);

    const eventCounts = new Map<string, number>();
    const requestEntities = new Set<string>();
    const jobEntities = new Set<string>();
    const requestDuplicateById = new Map<string, number>();
    const requestAppliedById = new Map<string, number>();
    const jobFinalizedById = new Map<string, number>();
    const stageSummaries = new Map<string, AnalyzeStageSummary>();

    let seqMin: number | null = null;
    let seqMax: number | null = null;
    let duplicateSeqCount = 0;
    let firstTs: number | null = null;
    let lastTs: number | null = null;
    let terminalSeq: number | null = null;
    let terminalEventName: string | null = null;
    const seenSeqs = new Set<number>();

    const getStageSummary = (stage: string): AnalyzeStageSummary => {
      const existing = stageSummaries.get(stage);
      if (existing) return existing;
      const created: AnalyzeStageSummary = {
        stage,
        first_ts_ms: null,
        last_ts_ms: null,
        duration_ms: null,
        route: "none",
        request_applied: 0,
        request_apply_duplicate_success: 0,
        request_error: 0,
        job_queued_handler_started: 0,
        job_running_polled: 0,
        job_finalized: 0,
        batch_queued_handler_started: 0,
        batch_polled: 0,
        batch_success: 0,
        batch_poll_claim_denied: 0,
        batch_submit_claim_denied: 0,
      };
      stageSummaries.set(stage, created);
      return created;
    };

    for (const event of events) {
      incrementCount(eventCounts, event.event_name);
      if (seqMin == null || event.seq < seqMin) seqMin = event.seq;
      if (seqMax == null || event.seq > seqMax) seqMax = event.seq;
      if (seenSeqs.has(event.seq)) duplicateSeqCount += 1;
      seenSeqs.add(event.seq);
      if (firstTs == null || event.ts_ms < firstTs) firstTs = event.ts_ms;
      if (lastTs == null || event.ts_ms > lastTs) lastTs = event.ts_ms;
      if (terminalSeq == null && isTerminalEvent(args.process_type, event.event_name)) {
        terminalSeq = event.seq;
        terminalEventName = event.event_name;
      }

      const stage = event.stage ?? "none";
      const summary = getStageSummary(stage);
      summary.first_ts_ms = summary.first_ts_ms == null
        ? event.ts_ms
        : Math.min(summary.first_ts_ms, event.ts_ms);
      summary.last_ts_ms = summary.last_ts_ms == null
        ? event.ts_ms
        : Math.max(summary.last_ts_ms, event.ts_ms);

      if (event.entity_type === "request") requestEntities.add(event.entity_id);
      if (event.entity_type === "job") jobEntities.add(event.entity_id);

      if (event.event_name === "request_applied") {
        summary.request_applied += 1;
        if (event.entity_type === "request") incrementCount(requestAppliedById, event.entity_id);
      }
      if (event.event_name === "request_apply_duplicate_success") {
        summary.request_apply_duplicate_success += 1;
        if (event.entity_type === "request") incrementCount(requestDuplicateById, event.entity_id);
      }
      if (event.event_name === "request_error") summary.request_error += 1;
      if (event.event_name === "job_queued_handler_started") {
        summary.job_queued_handler_started += 1;
        summary.route = summary.route === "batch" ? "mixed" : "job";
      }
      if (event.event_name === "job_running_polled") summary.job_running_polled += 1;
      if (event.event_name === "job_finalized") {
        summary.job_finalized += 1;
        if (event.entity_type === "job") incrementCount(jobFinalizedById, event.entity_id);
      }
      if (event.event_name === "batch_queued_handler_started") {
        summary.batch_queued_handler_started += 1;
        summary.route = summary.route === "job" ? "mixed" : "batch";
      }
      if (event.event_name === "batch_polled") summary.batch_polled += 1;
      if (event.event_name === "batch_success") summary.batch_success += 1;
      if (event.event_name === "batch_poll_claim_denied") summary.batch_poll_claim_denied += 1;
      if (event.event_name === "batch_submit_claim_denied") summary.batch_submit_claim_denied += 1;
    }

    for (const summary of stageSummaries.values()) {
      summary.duration_ms = summary.first_ts_ms != null && summary.last_ts_ms != null
        ? Math.max(0, summary.last_ts_ms - summary.first_ts_ms)
        : null;
    }

    const duplicateValues = [...requestDuplicateById.values()];
    const jobFinalizeValues = [...jobFinalizedById.values()];
    const trace_id = observability?.trace_id ?? `${args.process_type}:${args.process_id}`;

    return {
      process_type: args.process_type,
      process_id: args.process_id,
      trace_id,
      telemetry_backend: "axiom",
      external_trace_ref: observability?.external_trace_ref ?? buildExternalTraceRef(trace_id),
      sampled_events: events.length,
      reached_end_of_trace: false,
      seq_min: seqMin,
      seq_max: seqMax,
      missing_seq_count: 0,
      duplicate_seq_count: duplicateSeqCount,
      first_ts_ms: firstTs,
      last_ts_ms: lastTs,
      duration_ms: firstTs != null && lastTs != null ? Math.max(0, lastTs - firstTs) : null,
      event_counts: [...eventCounts.entries()].map(([event_name, count]) => ({ event_name, count })),
      stage_summaries: [...stageSummaries.values()].sort(
        (left: AnalyzeStageSummary, right: AnalyzeStageSummary) =>
          left.stage.localeCompare(right.stage),
      ),
      request_stats: {
        unique_request_entities: requestEntities.size,
        request_applied_total: [...requestAppliedById.values()].reduce((sum, count) => sum + count, 0),
        duplicate_apply_success_total: duplicateValues.reduce((sum, count) => sum + count, 0),
        requests_with_duplicate_apply_success: duplicateValues.filter((count) => count > 0).length,
        max_duplicate_apply_success_per_request: duplicateValues.length > 0 ? Math.max(...duplicateValues) : 0,
      },
      job_stats: {
        unique_job_entities: jobEntities.size,
        job_finalized_total: jobFinalizeValues.reduce((sum, count) => sum + count, 0),
        jobs_finalized_multiple_times: jobFinalizeValues.filter((count) => count > 1).length,
        max_job_finalized_per_job: jobFinalizeValues.length > 0 ? Math.max(...jobFinalizeValues) : 0,
      },
      terminal_stats: {
        terminal_event_name: terminalEventName,
        terminal_seq: terminalSeq,
        events_after_terminal: terminalSeq == null
          ? 0
          : events.filter((event: TailTraceReturn["events"][number]) => event.seq > terminalSeq).length,
      },
    };
  },
});

export const testAxiomIngest = zAction({
  args: z.object({
    trace_id: z.string().optional(),
    event_name: z.string().default("axiom_smoke_test"),
  }),
  returns: z.object({
    ok: z.boolean(),
    status: z.number(),
    dataset: z.string(),
    trace_id: z.string(),
    response_text: z.string().optional(),
  }),
  handler: async (ctx, args): Promise<{
    ok: boolean;
    status: number;
    dataset: string;
    trace_id: string;
    response_text?: string;
  }> => {
    const trace_id = args.trace_id ?? `smoke:${Date.now()}`;
    const event = buildAxiomEventEnvelope({
      trace_id,
      entity_type: "scheduler",
      entity_id: "smoke_test",
      event_name: args.event_name,
      status: "ok",
      payload_json: JSON.stringify({ source: "codex", smoke_test: true }),
      ts_ms: Date.now(),
    });
    return ctx.runAction(internal.domain.telemetry.events.exportEvent, {
      event,
    });
  },
});
