import { beforeEach, describe, expect, test } from "vitest";
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
} from "../domain/orchestrator/process_workflows";
import {
  __resetMockProviders,
  __setMockBatchMode,
  __setMockBatchOutputResolver,
} from "./provider_services_mock";

const MODEL: ModelType = "gpt-4.1";

type EvidenceDoc = Doc<"evidences">;
type BatchDoc = Doc<"llm_batches">;
type RunStage = "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic";

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

const initTest = () => {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
};

beforeEach(() => {
  __resetMockProviders();
  __setMockBatchMode("completed");
  __setMockBatchOutputResolver((req) => {
    const stage = req.custom_key.split(":")[2] as RunStage | undefined;
    if (stage === "rubric_gen") {
      return {
        assistant_output: buildRubricOutput(3, "L"),
        input_tokens: 100,
        output_tokens: 200,
      };
    }
    if (stage === "rubric_critic") {
      return {
        assistant_output:
          "Reasoning for rubric critic\nQUALITY: observability=0.7 discriminability=0.6",
        input_tokens: 80,
        output_tokens: 50,
      };
    }
    if (stage === "score_gen") {
      return {
        assistant_output: "Reasoning for score\nVERDICT: A",
        input_tokens: 120,
        output_tokens: 60,
      };
    }
    if (stage === "score_critic") {
      return {
        assistant_output:
          "Reasoning for score critic\nEXPERT_AGREEMENT: 0.8",
        input_tokens: 70,
        output_tokens: 40,
      };
    }
    return {
      assistant_output: "Reasoning\nVERDICT: A",
      input_tokens: 10,
      output_tokens: 5,
    };
  });
});

function buildEvidenceBatch(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Evidence ${index + 1}`,
    url: `https://example.com/evidence/${index + 1}`,
    raw_content: `Raw content for evidence ${index + 1}.`,
  }));
}

function buildRubricOutput(scaleSize: number, label: string) {
  const lines = Array.from({ length: scaleSize }, (_, idx) => {
    const stage = idx + 1;
    return `${stage}) ${label}${stage} :: criterion a; criterion b; criterion c`;
  });
  return `Reasoning for ${label}\nRUBRIC:\n${lines.join("\n")}`;
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
      query: "full run test",
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

async function getQueuedBatch(
  t: ReturnType<typeof convexTest>,
): Promise<BatchDoc> {
  const { queued_batches } = await t.query(
    internal.domain.llm_calls.llm_batch_repo.listActiveBatches,
    {},
  );
  const batch = queued_batches[0];
  if (!batch) throw new Error("Expected a queued batch");
  return batch;
}

describe("orchestrator full run (batch path)", () => {
  test("processes all stages and reports table counts", async () => {
    const t = initTest();
    const step = {
      runAction: t.action,
      runMutation: t.mutation,
      runQuery: t.query,
    };

    const window_id = await createWindowWithEvidence(t, 5);
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

    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      const nextStage = stages[index + 1];
      const batch = await getQueuedBatch(t);
      await handleQueuedBatchWorkflow(step, { batch_id: batch._id });
      await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
        batch_id: batch._id,
        patch: { next_poll_at: Date.now() - 1 },
      });
      await handleRunningBatchWorkflow(step, { batch_id: batch._id });

      const run = await t.query(internal.domain.runs.run_repo.getRun, {
        run_id,
      });
      if (nextStage) {
        expect(run.current_stage).toBe(nextStage);
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
      ] as const;
      const entries = await Promise.all(
        tables.map(async (name) => {
          const rows = await ctx.db.query(name).collect();
          return [name, rows.length] as const;
        }),
      );
      return Object.fromEntries(entries);
    });

    console.info("table_counts", counts);
  });

  test("prevents duplicate apply when running batch workflow replays", async () => {
    const t = initTest();
    const step = {
      runAction: t.action,
      runMutation: t.mutation,
      runQuery: t.query,
    };

    const window_id = await createWindowWithEvidence(t, 5);
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

    const repeatApplies = 10;

    for (const stage of stages) {
      const batch = await getQueuedBatch(t);
      await handleQueuedBatchWorkflow(step, { batch_id: batch._id });

      for (let i = 0; i < repeatApplies; i += 1) {
        await t.mutation(internal.domain.llm_calls.llm_batch_repo.patchBatch, {
          batch_id: batch._id,
          patch: {
            status: "running",
            batch_ref: batch.batch_ref ?? undefined,
            next_poll_at: Date.now() - 1,
          },
        });
        await handleRunningBatchWorkflow(step, { batch_id: batch._id });
      }

      const run = await t.query(internal.domain.runs.run_repo.getRun, {
        run_id,
      });
      if (stage === "score_critic") {
        expect(run.current_stage).toBe(stage);
      } else {
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
      ] as const;
      const entries = await Promise.all(
        tables.map(async (name) => {
          const rows = await ctx.db.query(name).collect();
          return [name, rows.length] as const;
        }),
      );
      return Object.fromEntries(entries);
    });

    console.info("duplicate_apply_table_counts", counts);
    expect(counts.rubrics).toBe(10);
    expect(counts.rubric_critics).toBe(10);
    expect(counts.scores).toBe(10);
    expect(counts.score_critics).toBe(10);
  });
});
