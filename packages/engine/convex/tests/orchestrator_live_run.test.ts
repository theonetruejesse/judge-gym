import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ModelType } from "../platform/providers/provider_types";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
import {
  handleQueuedBatchWorkflow,
  handleRunningBatchWorkflow,
  handleQueuedJobWorkflow,
  handleRunningJobWorkflow,
} from "../domain/orchestrator/process_workflows";

const MODEL: ModelType = "gpt-4.1-mini";

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

const initLiveTest = () => {
  const t = convexTest(schema, buildModules({ live: true }));
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
};

type EvidenceDoc = Doc<"evidences">;

type RunStage = "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic";

function buildEvidenceBatch(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Evidence ${index + 1}`,
    url: `https://example.com/evidence/${index + 1}`,
    raw_content: `Raw content for evidence ${index + 1}.`,
  }));
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function createWindowWithEvidence(
  t: ReturnType<typeof convexTest>,
  count: number,
) {
  const { window_id } = await t.mutation(
    internal.domain.window.window_repo.createWindow,
    {
      country: "USA",
      model: MODEL,
      start_date: "2026-01-01",
      end_date: "2026-01-02",
      query: "live run test",
    },
  );
  await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
    window_id,
    evidences: buildEvidenceBatch(count),
  });
  return window_id;
}

async function listEvidence(
  t: ReturnType<typeof convexTest>,
  window_id: Id<"windows">,
) {
  return (await t.query(
    internal.domain.window.window_repo.listEvidenceByWindow,
    { window_id },
  )) as EvidenceDoc[];
}

async function waitForQueuedBatch(
  t: ReturnType<typeof convexTest>,
  maxAttempts: number,
  delayMs: number,
) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const { queued_batches } = await t.query(
      internal.domain.llm_calls.llm_batch_repo.listActiveBatches,
      {},
    );
    if (queued_batches.length > 0) return queued_batches[0];
    await sleep(delayMs);
  }
  throw new Error("Timed out waiting for queued batch");
}

async function waitForQueuedJob(
  t: ReturnType<typeof convexTest>,
  maxAttempts: number,
  delayMs: number,
) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const { queued_jobs } = await t.query(
      internal.domain.llm_calls.llm_job_repo.listActiveJobs,
      {},
    );
    if (queued_jobs.length > 0) return queued_jobs[0];
    await sleep(delayMs);
  }
  throw new Error("Timed out waiting for queued job");
}

async function runBatchToCompletion(
  t: ReturnType<typeof convexTest>,
  batch_id: Id<"llm_batches">,
  maxPolls: number,
  delayMs: number,
) {
  const step = {
    runAction: t.action,
    runMutation: t.mutation,
    runQuery: t.query,
  };

  await handleQueuedBatchWorkflow(step, { batch_id });

  for (let i = 0; i < maxPolls; i += 1) {
    await handleRunningBatchWorkflow(step, { batch_id });
    const { batch } = await t.query(
      internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
      { batch_id },
    );
    if (batch.status === "success" || batch.status === "error") return batch;
    await sleep(delayMs);
  }

  throw new Error("Timed out waiting for batch completion");
}

async function runJobToCompletion(
  t: ReturnType<typeof convexTest>,
  job_id: Id<"llm_jobs">,
  maxPolls: number,
  delayMs: number,
) {
  const step = {
    runAction: t.action,
    runMutation: t.mutation,
    runQuery: t.query,
  };

  await handleQueuedJobWorkflow(step, { job_id });

  for (let i = 0; i < maxPolls; i += 1) {
    await handleRunningJobWorkflow(step, { job_id });
    const { job } = await t.query(
      internal.domain.llm_calls.llm_job_repo.getJobWithRequests,
      { job_id },
    );
    if (job.status === "success" || job.status === "error") return job;
    await sleep(delayMs);
  }

  throw new Error("Timed out waiting for job completion");
}

const live = process.env.VITEST_LIVE_TESTS === "1";

describe(live ? "live run orchestration" : "live run orchestration (skipped)", () => {
  test(live ? "full run with live provider" : "skipped", async () => {
    if (!live) return;

    const t = initLiveTest();

    const window_id = await createWindowWithEvidence(t, 3);
    const evidences = await listEvidence(t, window_id);

    const experiment_id = await t.mutation(
      internal.domain.runs.experiments_repo.createExperiment,
      {
        rubric_config: {
          model: MODEL,
          scale_size: 3,
          concept: "Test concept",
        },
        scoring_config: {
          model: MODEL,
          method: "single",
          abstain_enabled: false,
          evidence_view: "l0_raw",
          randomizations: [],
        },
      },
    );

    await t.mutation(internal.domain.runs.experiments_repo.insertExperimentEvidences, {
      experiment_id,
      evidence_ids: evidences.map((evidence) => evidence._id),
    });

    const { run_id } = await t.mutation(internal.domain.runs.run_service.startRunFlow, {
      experiment_id,
      target_count: 10,
    });

    const stages: RunStage[] = [
      "rubric_gen",
      "rubric_critic",
      "score_gen",
      "score_critic",
    ];

    for (const stage of stages) {
      const { queued_batches } = await t.query(
        internal.domain.llm_calls.llm_batch_repo.listActiveBatches,
        {},
      );
      if (queued_batches.length > 0) {
        const batch = await waitForQueuedBatch(t, 30, 1000);
        await runBatchToCompletion(t, batch._id, 60, 5000);
      } else {
        const job = await waitForQueuedJob(t, 30, 1000);
        await runJobToCompletion(t, job._id, 60, 2000);
      }

      const run = await t.query(internal.domain.runs.run_repo.getRun, {
        run_id,
      });
      if (stage !== "score_critic") {
        expect(run.current_stage).not.toBe(stage);
      }
    }

    const finalRun = await t.query(internal.domain.runs.run_repo.getRun, {
      run_id,
    });
    expect(finalRun.status).toBe("completed");

    const counts = await t.run(async (ctx) => {
      const tables = [
        "runs",
        "samples",
        "experiments",
        "experiment_evidence",
        "evidences",
        "llm_requests",
        "llm_batches",
        "llm_jobs",
        "rubrics",
        "rubric_critics",
        "scores",
        "score_critics",
        "sample_evidence_scores",
      ] as const;
      const entries = await Promise.all(
        tables.map(async (name) => {
          const rows = await ctx.db.query(name).collect();
          return [name, rows.length] as const;
        }),
      );
      return Object.fromEntries(entries);
    });

    console.info("live_table_counts", counts);
  }, 20 * 60 * 1000);
});
