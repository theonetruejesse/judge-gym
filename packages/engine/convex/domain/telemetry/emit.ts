import { internal } from "../../_generated/api";
import type { ActionCtx, MutationCtx } from "../../_generated/server";

type TelemetryCtx = Pick<ActionCtx | MutationCtx, "runMutation">;

type EmitTraceEventArgs = {
  trace_id: string;
  entity_type: "window" | "run" | "batch" | "job" | "request" | "scheduler";
  entity_id: string;
  event_name: string;
  stage?: string | null;
  status?: string | null;
  custom_key?: string | null;
  attempt?: number | null;
  ts_ms?: number;
  payload_json?: string | null;
};

export async function emitTraceEvent(
  ctx: TelemetryCtx,
  args: EmitTraceEventArgs,
) {
  try {
    await ctx.runMutation(internal.domain.telemetry.events.emitEvent, args);
  } catch (error) {
    console.warn("telemetry_emit_failed", String(error));
  }
}
