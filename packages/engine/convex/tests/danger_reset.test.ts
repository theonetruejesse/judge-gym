import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { internal } from "../_generated/api";
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";

const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
);

const initTest = () => {
  const t = convexTest(schema, buildModules());
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
};

async function createExperiment(t: ReturnType<typeof convexTest>) {
  return await t.mutation(internal.domain.runs.experiments_repo.createExperiment, {
    rubric_config: {
      model: "gpt-4.1",
      scale_size: 3,
      concept: "danger-delete-run-data-test",
    },
    scoring_config: {
      model: "gpt-4.1",
      method: "single",
      abstain_enabled: false,
      evidence_view: "l0_raw",
      randomizations: [],
    },
  });
}

describe("danger.deleteRunData", () => {
  test("blocks active runs unless allow_active is set", async () => {
    const t = initTest();
    const experiment_id = await createExperiment(t);
    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 1,
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(run_id, { status: "running" });
    });

    await expect(
      t.mutation(internal.domain.maintenance.danger.deleteRunData, {
        run_id,
        isDryRun: true,
      }),
    ).rejects.toThrow(/Refusing to delete active run/);

    const dryRunOverride = await t.mutation(internal.domain.maintenance.danger.deleteRunData, {
      run_id,
      isDryRun: true,
      allow_active: true,
    });
    expect(dryRunOverride.run_id).toBe(run_id);
    expect(dryRunOverride.deleted.runs).toBe(1);
  });

  test("deletes run-linked data while preserving windows and evidence", async () => {
    const t = initTest();
    const { window_id } = await t.mutation(internal.domain.window.window_repo.createWindow, {
      country: "USA",
      model: "gpt-4.1",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      query: "danger cleanup boundary",
    });
    await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_id,
      evidences: [
        {
          title: "boundary evidence",
          url: "https://example.com/boundary",
          raw_content: "content",
        },
      ],
    });
    const evidenceRows = await t.query(internal.domain.window.window_repo.listEvidenceByWindow, {
      window_id,
    });

    const experiment_id = await createExperiment(t);
    await t.mutation(internal.domain.runs.experiments_repo.insertExperimentEvidences, {
      experiment_id,
      evidence_ids: evidenceRows.map((row) => row._id),
    });
    const run_id = await t.mutation(internal.domain.runs.run_repo.createRun, {
      experiment_id,
      target_count: 2,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(run_id, { status: "completed" });
    });

    const deleted = await t.mutation(internal.domain.maintenance.danger.deleteRunData, {
      run_id,
      isDryRun: false,
    });
    expect(deleted.deleted.runs).toBe(1);
    expect(deleted.deleted.samples).toBe(2);
    expect(deleted.deleted.sample_evidence_scores).toBe(2);

    const runAfter = await t.query(internal.domain.runs.run_repo.getRun, { run_id }).catch(() => null);
    expect(runAfter).toBeNull();

    const evidenceAfter = await t.query(internal.domain.window.window_repo.listEvidenceByWindow, {
      window_id,
    });
    expect(evidenceAfter.length).toBe(1);
  });
});
