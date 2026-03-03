import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

const initTest = () => {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
};

describe("codex live debug surface", () => {
  test("materializes telemetry_entity_state on emit", async () => {
    const t = initTest();

    await t.mutation(internal.domain.telemetry.events.emitEvent, {
      trace_id: "run:abc",
      entity_type: "run",
      entity_id: "abc",
      event_name: "run_started",
      stage: "rubric_gen",
      status: "queued",
      ts_ms: 100,
      payload_json: JSON.stringify({ n: 1 }),
    });

    await t.mutation(internal.domain.telemetry.events.emitEvent, {
      trace_id: "run:abc",
      entity_type: "run",
      entity_id: "abc",
      event_name: "run_advanced",
      stage: "rubric_critic",
      status: "running",
      ts_ms: 200,
      payload_json: JSON.stringify({ n: 2 }),
    });

    const state = await t.query(internal.domain.telemetry.events.getEntityState, {
      entity_type: "run",
      entity_id: "abc",
    });

    expect(state).not.toBeNull();
    expect(state?.last_seq).toBe(2);
    expect(state?.last_event_name).toBe("run_advanced");
    expect(state?.last_stage).toBe("rubric_critic");
    expect(state?.last_ts_ms).toBe(200);
  });

  test("detects orphan requests and plans dry-run auto-heal", async () => {
    const t = initTest();

    const { window_id } = await t.mutation(internal.domain.window.window_repo.createWindow, {
      country: "USA",
      model: "gpt-4.1",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "live debug test",
    });
    await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_id,
      evidences: [
        {
          title: "E1",
          url: "https://example.com/e1",
          raw_content: "raw",
        },
      ],
    });

    const evidenceRows = await t.query(internal.domain.window.window_repo.listEvidenceByWindow, {
      window_id,
    });
    const evidence_id = evidenceRows[0]?._id as Id<"evidences">;

    await t.mutation(internal.domain.llm_calls.llm_request_repo.createLlmRequest, {
      model: "gpt-4.1",
      user_prompt: "u",
      system_prompt: "s",
      custom_key: `evidence:${evidence_id}:l1_cleaned`,
      attempts: 0,
    });

    const health = await t.query(api.packages.codex.getProcessHealth, {
      process_type: "window",
      process_id: String(window_id),
      include_recent_events: 0,
    });
    expect(health.active_transport.orphaned_requests).toBe(1);

    const stuck = await t.query(api.packages.codex.getStuckWork, {
      process_type: "window",
      older_than_ms: 1,
      limit: 50,
    });
    expect(
      stuck.items.some((item: { reason: string; process_id: string }) =>
        item.reason === "pending_request_no_owner" && item.process_id === String(window_id)
      ),
    ).toBe(true);

    const heal = await t.mutation(api.packages.codex.autoHealProcess, {
      process_type: "window",
      process_id: String(window_id),
      older_than_ms: 1,
      dry_run: true,
    });
    expect(
      heal.planned_actions.some((action: { action: string }) => action.action === "requeue_orphan_request"),
    ).toBe(true);
    expect(heal.results.some((result: { status: string }) => result.status === "applied")).toBe(true);
  });
});
