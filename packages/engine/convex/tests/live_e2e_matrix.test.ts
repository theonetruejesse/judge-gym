import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ModelType } from "../platform/providers/provider_types";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
import {
  handleQueuedBatchWorkflow,
  handleQueuedJobWorkflow,
  handleRunningBatchWorkflow,
  handleRunningJobWorkflow,
} from "../domain/orchestrator/process_workflows";

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

type Scenario = {
  name: string;
  model: ModelType;
  evidence_limit: number;
  target_count: number;
};

const DEFAULT_SCENARIOS: Scenario[] = [
  {
    name: "mini_batch_path",
    model: "gpt-4.1-mini",
    evidence_limit: 6,
    target_count: 30,
  },
  {
    name: "full_batch_path",
    model: "gpt-4.1",
    evidence_limit: 6,
    target_count: 30,
  },
];

const live = process.env.VITEST_LIVE_TESTS === "1";

const initLiveTest = () => {
  const t = convexTest(schema, buildModules({ live: true }));
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFallbackWindowEvidence(count: number) {
  const size = Math.max(3, count);
  return Array.from({ length: size }, (_, index) => ({
    title: `Fallback window evidence ${index + 1}`,
    url: `https://example.com/fallback/window-evidence/${index + 1}`,
    raw_content: `Fallback raw content ${index + 1} about US policy and politics.`,
  }));
}

async function pumpWorkflows(t: ReturnType<typeof convexTest>) {
  const step = {
    runAction: t.action,
    runMutation: t.mutation,
    runQuery: t.query,
  };

  const { queued_batches, running_batches } = await t.query(
    internal.domain.llm_calls.llm_batch_repo.listActiveBatches,
    {},
  );
  const { queued_jobs, running_jobs } = await t.query(
    internal.domain.llm_calls.llm_job_repo.listActiveJobs,
    {},
  );

  for (const batch of queued_batches) {
    await handleQueuedBatchWorkflow(step, { batch_id: batch._id });
  }
  for (const batch of running_batches) {
    await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
      batch_id: batch._id,
      patch: { next_poll_at: Date.now() - 1 },
    });
    await handleRunningBatchWorkflow(step, { batch_id: batch._id });
  }
  for (const job of queued_jobs) {
    await handleQueuedJobWorkflow(step, { job_id: job._id });
  }
  for (const job of running_jobs) {
    await t.mutation(internal.domain.llm_calls.llm_job_repo.patchJob, {
      job_id: job._id,
      patch: { next_run_at: Date.now() - 1 },
    });
    await handleRunningJobWorkflow(step, { job_id: job._id });
  }

  return (
    queued_batches.length +
    running_batches.length +
    queued_jobs.length +
    running_jobs.length
  );
}

async function waitForWindowReady(
  t: ReturnType<typeof convexTest>,
  window_id: Id<"windows">,
  maxCycles: number,
) {
  let lastSummary: Awaited<ReturnType<typeof t.query<typeof api.packages.lab.getWindowSummary>>> | null =
    null;
  let lastActive = {
    queued_batches: 0,
    running_batches: 0,
    queued_jobs: 0,
    running_jobs: 0,
  };

  for (let i = 0; i < maxCycles; i += 1) {
    const summary = await t.query(api.packages.lab.getWindowSummary, {
      window_id,
    });
    lastSummary = summary;
    if (summary.status === "completed") return summary;
    if (summary.status === "error") return summary;

    const { queued_batches, running_batches } = await t.query(
      internal.domain.llm_calls.llm_batch_repo.listActiveBatches,
      {},
    );
    const { queued_jobs, running_jobs } = await t.query(
      internal.domain.llm_calls.llm_job_repo.listActiveJobs,
      {},
    );
    lastActive = {
      queued_batches: queued_batches.length,
      running_batches: running_batches.length,
      queued_jobs: queued_jobs.length,
      running_jobs: running_jobs.length,
    };

    if (
      summary.evidence_total === 0 &&
      queued_batches.length === 0 &&
      running_batches.length === 0 &&
      queued_jobs.length === 0 &&
      running_jobs.length === 0 &&
      i > 2
    ) {
      throw new Error(
        `Window ${window_id} has no evidence and no active workflows: ${JSON.stringify(summary)}`,
      );
    }

    await pumpWorkflows(t);
    await sleep(1200);
  }
  throw new Error(
    `Timed out waiting for window ${window_id}; summary=${JSON.stringify(lastSummary)} active=${JSON.stringify(lastActive)}`,
  );
}

async function waitForRunTerminal(
  t: ReturnType<typeof convexTest>,
  run_id: Id<"runs">,
  maxCycles: number,
) {
  for (let i = 0; i < maxCycles; i += 1) {
    const summary = await t.query(api.packages.lab.getRunDiagnostics, {
      run_id,
    });
    if (summary.status === "completed" || summary.status === "error") {
      return summary;
    }
    await pumpWorkflows(t);
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for run ${run_id}`);
}

async function listAllTraceEvents(
  t: ReturnType<typeof convexTest>,
  trace_id: string,
) {
  type TracePage = {
    events: Array<{
      seq: number;
      event_name: string;
      status?: string | null;
      stage?: string | null;
    }>;
    next_cursor_seq: number | null;
  };

  const events: Array<{
    seq: number;
    event_name: string;
    status?: string | null;
    stage?: string | null;
  }> = [];

  let cursor_seq: number | undefined = undefined;
  while (true) {
    const page = (await t.query(api.packages.lab.getTraceEvents, {
      trace_id,
      cursor_seq,
      limit: 200,
    })) as TracePage;
    events.push(
      ...page.events.map((event: TracePage["events"][number]) => ({
        seq: event.seq,
        event_name: event.event_name,
        status: event.status ?? null,
        stage: event.stage ?? null,
      })),
    );
    if (!page.next_cursor_seq) break;
    cursor_seq = page.next_cursor_seq;
  }
  return events;
}

async function tableCounts(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const tables = [
      "windows",
      "evidences",
      "pools",
      "pool_evidences",
      "experiments",
      "runs",
      "samples",
      "llm_batches",
      "llm_jobs",
      "llm_requests",
      "rubrics",
      "rubric_critics",
      "scores",
      "score_critics",
      "sample_evidence_scores",
      "process_observability",
    ] as const;
    const pairs = await Promise.all(
      tables.map(async (table) => {
        const rows = await ctx.db.query(table).collect();
        return [table, rows.length] as const;
      }),
    );
    return Object.fromEntries(pairs);
  });
}

describe(live ? "live e2e telemetry matrix" : "live e2e telemetry matrix (skipped)", () => {
  test(
    live ? "runs full live loop for scenario matrix" : "skipped",
    async () => {
      if (!live) return;

      const scenarios = DEFAULT_SCENARIOS;
      for (const scenario of scenarios) {
        const t = initLiveTest();
        const started_at = Date.now();

        const createdWindow = await t.mutation(api.packages.lab.createWindowForm, {
          evidence_window: {
            country: "USA",
            query: `US politics policy ${scenario.name}`,
            start_date: "2026-02-01",
            end_date: "2026-02-07",
            model: scenario.model,
          },
          evidence_limit: scenario.evidence_limit,
        });

        await t.action(internal.packages.lab.startWindowFlow, {
          window_id: createdWindow.window_id,
          evidence_limit: scenario.evidence_limit,
        });

        const initialWindowSummary = await t.query(api.packages.lab.getWindowSummary, {
          window_id: createdWindow.window_id,
        });
        if (initialWindowSummary.evidence_total === 0) {
          await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
            window_id: createdWindow.window_id,
            evidences: buildFallbackWindowEvidence(scenario.evidence_limit),
          });
          await t.mutation(internal.domain.window.window_service.startWindowOrchestration, {
            window_id: createdWindow.window_id,
          });
          await t.mutation(internal.domain.orchestrator.scheduler.startScheduler, {});
          console.warn(
            "live_e2e_matrix_fallback_evidence",
            JSON.stringify({
              scenario: scenario.name,
              window_id: createdWindow.window_id,
            }),
          );
        }

        const windowSummary = await waitForWindowReady(t, createdWindow.window_id, 150);
        expect(windowSummary.status).toBe("completed");

        const windowEvidence = (await t.query(api.packages.lab.listEvidenceByWindow, {
          window_id: createdWindow.window_id,
        })) as Array<{
          evidence_id: Id<"evidences">;
        }>;
        expect(windowEvidence.length).toBeGreaterThan(0);
        const pool = await t.mutation(api.packages.lab.createPool, {
          evidence_ids: windowEvidence.map((row) => row.evidence_id),
        });

        const experiment = await t.mutation(api.packages.lab.initExperiment, {
          experiment_config: {
            rubric_config: {
              model: scenario.model,
              scale_size: 3,
              concept: "Live matrix concept",
            },
            scoring_config: {
              model: scenario.model,
              method: "single",
              abstain_enabled: false,
              evidence_view: "l0_raw",
              randomizations: [],
            },
          },
          pool_id: pool.pool_id,
        });

        const run = await t.mutation(api.packages.lab.startExperimentRun, {
          experiment_id: experiment.experiment_id,
          target_count: scenario.target_count,
        });

        const runSummary = await waitForRunTerminal(t, run.run_id, 240);
        const runTrace = await listAllTraceEvents(t, `run:${run.run_id}`);

        const perRunCounts = await t.run(async (ctx) => {
          const samples = await ctx.db
            .query("samples")
            .withIndex("by_run", (q) => q.eq("run_id", run.run_id))
            .collect();
          const scoreUnits = await ctx.db
            .query("sample_evidence_scores")
            .withIndex("by_run", (q) => q.eq("run_id", run.run_id))
            .collect();
          const sampleIds = new Set(samples.map((sample) => String(sample._id)));
          const scoreUnitIds = new Set(scoreUnits.map((unit) => String(unit._id)));
          const requests = (await ctx.db.query("llm_requests").collect()).filter((request) =>
            sampleIds.has(request.custom_key.split(":")[1] ?? "") ||
            scoreUnitIds.has(request.custom_key.split(":")[1] ?? ""),
          );
          const seeds = samples.map((sample) => sample.seed);
          const seed_unique_ok =
            seeds.length === scenario.target_count &&
            new Set(seeds).size === seeds.length;

          return {
            sample_count: samples.length,
            score_unit_count: scoreUnits.length,
            request_count: requests.length,
            seed_unique_ok,
          };
        });

        const seqMonotonic = runTrace.every((event, index) => {
          if (index === 0) return event.seq >= 1;
          return event.seq > runTrace[index - 1].seq;
        });
        expect(seqMonotonic).toBe(true);

        const summary = {
          scenario: scenario.name,
          model: scenario.model,
          duration_ms: Date.now() - started_at,
          window: windowSummary,
          run: runSummary,
          trace_events: runTrace.length,
          trace_seq_monotonic: seqMonotonic,
          per_run_counts: perRunCounts,
          global_table_counts: await tableCounts(t),
        };

        console.info("live_e2e_matrix_result", JSON.stringify(summary, null, 2));

        expect(perRunCounts.sample_count).toBe(scenario.target_count);
        expect(perRunCounts.seed_unique_ok).toBe(true);
      }
    },
    45 * 60 * 1000,
  );
});
