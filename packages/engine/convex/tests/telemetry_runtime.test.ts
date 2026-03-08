import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildAxiomEventEnvelope,
  buildLocalTraceEvent,
  shouldMirrorLocally,
} from "../domain/telemetry/events";

describe("telemetry runtime helpers", () => {
  const originalDataset = process.env.AXIOM_DATASET;

  afterEach(() => {
    if (originalDataset === undefined) {
      delete process.env.AXIOM_DATASET;
    } else {
      process.env.AXIOM_DATASET = originalDataset;
    }
    vi.restoreAllMocks();
  });

  test("builds local observability events without Axiom env", () => {
    delete process.env.AXIOM_DATASET;
    vi.spyOn(Math, "random").mockReturnValue(0);

    const local = buildLocalTraceEvent({
      trace_id: "run:abc123",
      entity_type: "run",
      entity_id: "abc123",
      event_name: "run_started",
      ts_ms: 1234,
    });
    const envelope = buildAxiomEventEnvelope({
      trace_id: "run:abc123",
      entity_type: "run",
      entity_id: "abc123",
      event_name: "run_started",
      ts_ms: 1234,
    });

    expect(local.seq).toBe(1_234_000);
    expect(envelope.dataset ?? null).toBeNull();
    expect(envelope.external_trace_ref ?? null).toBeNull();
    expect(shouldMirrorLocally(local)).toBe(true);
  });

  test("mirrors request failures but skips request success noise", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const failure = buildLocalTraceEvent({
      trace_id: "run:abc123",
      entity_type: "request",
      entity_id: "req_1",
      event_name: "request_error",
      status: "error",
      ts_ms: 1234,
    });
    const success = buildLocalTraceEvent({
      trace_id: "run:abc123",
      entity_type: "request",
      entity_id: "req_2",
      event_name: "request_applied",
      status: "success",
      ts_ms: 1235,
    });

    expect(shouldMirrorLocally(failure)).toBe(true);
    expect(shouldMirrorLocally(success)).toBe(false);
  });
});
