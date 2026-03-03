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

  test("maintains process_request_targets snapshot on request transitions", async () => {
    const t = initTest();

    const { window_id } = await t.mutation(internal.domain.window.window_repo.createWindow, {
      country: "USA",
      model: "gpt-4.1",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "snapshot test",
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
    const customKey = `evidence:${evidence_id}:l1_cleaned`;

    const requestId = await t.mutation(internal.domain.llm_calls.llm_request_repo.createLlmRequest, {
      model: "gpt-4.1",
      user_prompt: "u",
      system_prompt: "s",
      custom_key: customKey,
      attempts: 0,
    });

    const initialState = await t.run(async (ctx) => ctx.db
      .query("process_request_targets")
      .withIndex("by_custom_key", (q) => q.eq("custom_key", customKey))
      .first());
    expect(initialState).not.toBeNull();
    expect(initialState?.has_pending).toBe(true);
    expect(initialState?.max_attempts).toBe(0);

    await t.mutation(internal.domain.llm_calls.llm_request_repo.patchRequest, {
      request_id: requestId,
      patch: {
        status: "error",
        attempts: 1,
        last_error: "parse failed",
      },
    });

    const errorState = await t.run(async (ctx) => ctx.db
      .query("process_request_targets")
      .withIndex("by_custom_key", (q) => q.eq("custom_key", customKey))
      .first());
    expect(errorState?.has_pending).toBe(false);
    expect(errorState?.max_attempts).toBe(1);
    expect(errorState?.latest_error_class).toBe("parse_error");

    await t.mutation(internal.domain.llm_calls.llm_request_repo.createLlmRequest, {
      model: "gpt-4.1",
      user_prompt: "u2",
      system_prompt: "s2",
      custom_key: customKey,
      attempts: 2,
    });

    const retryState = await t.run(async (ctx) => ctx.db
      .query("process_request_targets")
      .withIndex("by_custom_key", (q) => q.eq("custom_key", customKey))
      .first());
    expect(retryState?.has_pending).toBe(true);
    expect(retryState?.max_attempts).toBe(2);
  });

  test("getProcessHealth handles large score-unit fanout runs", async () => {
    const t = initTest();

    const { window_id } = await t.mutation(internal.domain.window.window_repo.createWindow, {
      country: "USA",
      model: "gpt-4.1",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "large run health",
    });
    await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_id,
      evidences: Array.from({ length: 20 }, (_, i) => ({
        title: `E${i + 1}`,
        url: `https://example.com/e${i + 1}`,
        raw_content: `raw-${i + 1}`,
      })),
    });
    const evidences = await t.query(internal.domain.window.window_repo.listEvidenceByWindow, {
      window_id,
    });

    const experiment_id = await t.mutation(internal.domain.runs.experiments_repo.createExperiment, {
      rubric_config: {
        model: "gpt-4.1",
        scale_size: 3,
        concept: "fanout-test",
      },
      scoring_config: {
        model: "gpt-4.1",
        method: "single",
        abstain_enabled: false,
        evidence_view: "l0_raw",
        randomizations: [],
      },
    });
    await t.mutation(internal.domain.runs.experiments_repo.insertExperimentEvidences, {
      experiment_id,
      evidence_ids: evidences.map((row) => row._id),
    });
    const { run_id } = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 30,
    });

    const health = await t.query(api.packages.codex.getProcessHealth, {
      process_type: "run",
      process_id: String(run_id),
      include_recent_events: 0,
    });

    const scoreGen = health.stage_progress.find((row: { stage: string }) => row.stage === "score_gen");
    const scoreCritic = health.stage_progress.find((row: { stage: string }) => row.stage === "score_critic");
    expect(scoreGen?.target_total).toBe(600);
    expect(scoreCritic?.target_total).toBe(600);
  });
});
