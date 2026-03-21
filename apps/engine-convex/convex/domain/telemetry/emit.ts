import { internal } from "../../_generated/api";
import type { ActionCtx, MutationCtx } from "../../_generated/server";
import {
  buildAxiomEventEnvelope,
  buildExternalTraceRef,
  buildLocalTraceEvent,
  parseProcessRefFromTraceId,
  shouldMirrorLocally,
  type EmitTelemetryEventArgs,
} from "./events";

type TelemetryCtx = Pick<ActionCtx | MutationCtx, "runMutation"> & {
  scheduler?: Pick<ActionCtx["scheduler"], "runAfter">;
};

type EmitTraceEventArgs = EmitTelemetryEventArgs;
const MAX_LOCAL_PAYLOAD_CHARS = 1600;

function truncatePayload(payload_json: string | null | undefined): string | null {
  if (!payload_json) return null;
  if (payload_json.length <= MAX_LOCAL_PAYLOAD_CHARS) return payload_json;
  return `${payload_json.slice(0, MAX_LOCAL_PAYLOAD_CHARS)}…`;
}

export async function emitTraceEvent(
  ctx: TelemetryCtx,
  args: EmitTraceEventArgs,
  _options?: { defer?: boolean },
) {
  const trace_event = buildLocalTraceEvent(args);
  const processRef = parseProcessRefFromTraceId(trace_event.trace_id);

  try {
    if (processRef && shouldMirrorLocally(trace_event)) {
      await ctx.runMutation(internal.domain.telemetry.events.recordProcessObservability, {
        process_type: processRef.process_type,
        process_id: processRef.process_id,
        trace_event: {
          ...trace_event,
          payload_json: truncatePayload(trace_event.payload_json),
        },
        external_trace_ref: buildExternalTraceRef(trace_event.trace_id),
        last_error_summary:
          trace_event.status === "error" || trace_event.status === "failed"
            ? trace_event.event_name
            : null,
      });
    }
  } catch (error) {
    console.warn("telemetry_local_mirror_failed", String(error));
  }

  if (!ctx.scheduler || process.env.JUDGE_GYM_SKIP_TELEMETRY_EXPORT === "1") {
    return;
  }

  try {
    const event = buildAxiomEventEnvelope({
      ...args,
      ts_ms: trace_event.ts_ms,
    });
    await ctx.scheduler.runAfter(0, internal.domain.telemetry.events.exportEvent, {
      event,
    });
  } catch (error) {
    console.warn("telemetry_export_schedule_failed", String(error));
  }
}
