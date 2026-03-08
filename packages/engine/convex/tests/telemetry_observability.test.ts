import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
import schema from "../schema";
import { internal } from "../_generated/api";
import { buildModules } from "./test.setup";

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

function initTest() {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
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
});
