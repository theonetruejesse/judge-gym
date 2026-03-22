import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import { api } from "../_generated/api";
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

  test("summarizes batch reconciliation state for a process", async () => {
    const t = initTest();

    const attemptOne = await t.run(async (ctx) => ctx.db.insert("llm_attempts", {
      attempt_key: "batch_summary:1",
      process_kind: "window",
      process_id: "window_run_1",
      target_type: "evidence",
      target_id: "evidence_1",
      stage: "l1_cleaned",
      provider: "openai",
      model: "gpt-4.1",
      operation_type: "batch",
      workflow_id: "window:window_run_1",
      prompt_template_id: null,
      user_prompt_payload_id: null,
      assistant_output_payload_id: null,
      error_payload_id: null,
      status: "started",
      started_at_ms: 1,
      finished_at_ms: null,
      metadata_json: null,
    }));
    const attemptTwo = await t.run(async (ctx) => ctx.db.insert("llm_attempts", {
      attempt_key: "batch_summary:2",
      process_kind: "window",
      process_id: "window_run_1",
      target_type: "evidence",
      target_id: "evidence_2",
      stage: "l1_cleaned",
      provider: "openai",
      model: "gpt-4.1",
      operation_type: "batch",
      workflow_id: "window:window_run_1",
      prompt_template_id: null,
      user_prompt_payload_id: null,
      assistant_output_payload_id: null,
      error_payload_id: null,
      status: "failed",
      started_at_ms: 2,
      finished_at_ms: 3,
      metadata_json: null,
    }));

    await t.run(async (ctx) => {
      await ctx.db.insert("llm_batch_executions", {
        batch_key: "batch_key_1",
        process_kind: "window",
        process_id: "window_run_1",
        stage: "l1_cleaned",
        provider: "openai",
        model: "gpt-4.1",
        workflow_id: "window:window_run_1",
        item_count: 20,
        provider_batch_id: "batch_1",
        input_file_id: null,
        output_file_id: null,
        error_file_id: null,
        status: "submitted",
        last_known_provider_status: "validating",
        last_error_message: null,
        submitted_at_ms: 10,
        completed_at_ms: null,
      });
      await ctx.db.insert("llm_batch_executions", {
        batch_key: "batch_key_2",
        process_kind: "window",
        process_id: "window_run_1",
        stage: "l1_cleaned",
        provider: "openai",
        model: "gpt-4.1",
        workflow_id: "window:window_run_1",
        item_count: 15,
        provider_batch_id: "batch_2",
        input_file_id: null,
        output_file_id: null,
        error_file_id: null,
        status: "completed",
        last_known_provider_status: "completed",
        last_error_message: null,
        submitted_at_ms: 20,
        completed_at_ms: 30,
      });
      await ctx.db.patch(attemptOne, { status: "succeeded", finished_at_ms: 4 });
      await ctx.db.patch(attemptTwo, { error_payload_id: null });
    });

    const status = await t.query(api.packages.codex.listBatchReconciliationStatus, {
      process_kind: "window",
      process_id: "window_run_1",
      stage: "l1_cleaned",
    });

    expect(status.summary.batch_count).toBe(2);
    expect(status.summary.total_items).toBe(35);
    expect(status.summary.status_counts.submitted).toBe(1);
    expect(status.summary.status_counts.completed).toBe(1);
    expect(status.summary.attempt_counts.succeeded).toBe(1);
    expect(status.summary.attempt_counts.failed).toBe(1);
    expect(status.summary.target_counts).toBeNull();
  });
});
