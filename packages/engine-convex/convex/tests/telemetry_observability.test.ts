import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildModules } from "./test.setup";
import { emitTraceEvent } from "../domain/telemetry/emit";

function initTest() {
  return convexTest(schema, buildModules());
}

describe("telemetry observability", () => {
  test("keeps only the newest local trace milestones", async () => {
    const t = initTest();

    for (let i = 0; i < 35; i += 1) {
      await t.mutation(internal.domain.telemetry.events.recordProcessObservability, {
        process_type: "run",
        process_id: "run_test",
        external_trace_ref: "axiom dataset=test trace_id=run:run_test",
        trace_event: {
          trace_id: "run:run_test",
          seq: i + 1,
          entity_type: "run",
          entity_id: "run_test",
          event_name: `event_${i}`,
          stage: null,
          status: null,
          custom_key: null,
          attempt: null,
          ts_ms: i + 1,
          payload_json: null,
        },
      });
    }

    const observability = await t.query(
      internal.domain.telemetry.events.getProcessObservability,
      {
        process_type: "run",
        process_id: "run_test",
      },
    );
    expect(observability).not.toBeNull();
    expect(observability?.recent_events).toHaveLength(32);
    expect(observability?.recent_events[0]?.event_name).toBe("event_3");
    expect(observability?.recent_events.at(-1)?.event_name).toBe("event_34");

    const page = await t.query(internal.domain.telemetry.events.listByTrace, {
      trace_id: "run:run_test",
      limit: 50,
    });
    expect(page.telemetry_backend).toBe("axiom");
    expect(page.events).toHaveLength(32);
    expect(page.events[0]?.event_name).toBe("event_3");
    expect(page.events.at(-1)?.event_name).toBe("event_34");
    expect(page.next_cursor_seq).toBeNull();
  });

  test("stores truncated payloads and external trace refs in the local mirror", async () => {
    const t = initTest();
    const schedulerRunAfter = vi.fn(async () => "scheduled_fn_test" as Id<"_scheduled_functions">);
    const originalDataset = process.env.AXIOM_DATASET;
    process.env.AXIOM_DATASET = "judge-gym-test";

    try {
      await t.run(async (ctx) => {
        await emitTraceEvent(
          {
            runMutation: ctx.runMutation,
            scheduler: { runAfter: schedulerRunAfter },
          },
          {
            trace_id: "run:run_payload_test",
            entity_type: "run",
            entity_id: "run_payload_test",
            event_name: "run_parse_failed",
            status: "error",
            payload_json: JSON.stringify({
              class: "parse_error",
              output_preview: "x".repeat(4000),
            }),
          },
        );
      });

      const observability = await t.query(
        internal.domain.telemetry.events.getProcessObservability,
        {
          process_type: "run",
          process_id: "run_payload_test",
        },
      );

      expect(observability?.external_trace_ref).toBe(
        "axiom dataset=judge-gym-test trace_id=run:run_payload_test",
      );
      expect(observability?.recent_events).toHaveLength(1);
      expect(observability?.recent_events[0]?.payload_json).toContain("\"class\":\"parse_error\"");
      expect(observability?.recent_events[0]?.payload_json?.length).toBeLessThanOrEqual(1601);
    } finally {
      if (originalDataset === undefined) {
        delete process.env.AXIOM_DATASET;
      } else {
        process.env.AXIOM_DATASET = originalDataset;
      }
    }
  });
});
