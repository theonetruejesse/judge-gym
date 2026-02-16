import { describe, expect, test } from "bun:test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL;
const shouldRun = Boolean(CONVEX_URL);
const hasFirecrawl = Boolean(process.env.FIRECRAWL_API_KEY);
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
const hasRunEnvs = hasOpenAI && hasAnthropic;

function buildExperimentSpec(tag: string, concept: string) {
  return {
    experiment_tag: tag,
    task_type: "ecc" as const,
    config: {
      rubric_stage: {
        scale_size: 3,
        model_id: "gpt-4.1" as const,
      },
      scoring_stage: {
        model_id: "gpt-4.1" as const,
        method: "single" as const,
        randomizations: [],
        evidence_view: "l0_raw" as const,
        abstain_enabled: true,
      },
    },
  };
}

function buildWindow(concept: string) {
  return {
    start_date: "2026-01-01",
    end_date: "2026-01-02",
    country: "USA",
    concept,
    model_id: "gpt-4.1" as const,
  };
}

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

describe("lab facade integration", () => {
  test("init + start experiment (env-gated)", async () => {
    if (!shouldRun) return;
    const client = new ConvexHttpClient(CONVEX_URL!);
    const suffix = uniqueSuffix();
    const experiment_tag = `lab_facade_init_${suffix}`;
    const concept = `lab_facade_concept_${suffix}`;

    let experiment_id: string | undefined;
    try {
      const { window_id } = await client.mutation(api.lab.initEvidenceWindow, {
        evidence_window: buildWindow(concept),
      });

      const inserted = await client.mutation(api.lab.insertEvidenceBatch, {
        window_id,
        evidences: [
          {
            title: "Evidence Init",
            url: `https://example.com/${suffix}/init`,
            raw_content: "Evidence init content",
          },
        ],
      });

      const initResult = await client.mutation(api.lab.initExperiment, {
        window_id,
        evidence_ids: inserted.evidence_ids,
        experiment: buildExperimentSpec(experiment_tag, concept),
      });
      if (!initResult.experiment_id) {
        throw new Error("Missing experiment_id");
      }
      experiment_id = initResult.experiment_id;

      const windows = (await client.query(api.lab.listEvidenceWindows, {})) as Array<{
        window_id: string;
      }>;
      expect(windows.some((w) => w.window_id === window_id)).toBe(true);

      const start = await client.mutation(api.lab.startExperiment, {
        experiment_id,
        run_counts: { sample_count: 1 },
      });

      if (hasRunEnvs) {
        expect(start.ok).toBe(true);
        expect(start.run_ids?.length).toBeGreaterThan(0);
      } else {
        expect(start.ok).toBe(false);
        expect(start.error).toBeDefined();
      }
    } finally {
      if (experiment_id) {
        await client.mutation(api.lab.resetExperiment, {
          experiment_id,
          cleanup_window: true,
        });
      }
    }
  });

  test("evidence selection flow", async () => {
    if (!shouldRun) return;
    if (!hasFirecrawl) return;
    const client = new ConvexHttpClient(CONVEX_URL!);
    const suffix = uniqueSuffix();
    const experiment_tag = `lab_facade_evidence_${suffix}`;
    const concept = `lab_facade_evidence_concept_${suffix}`;

    let experiment_id: string | undefined;
    try {
      const { window_id } = await client.mutation(api.lab.initEvidenceWindow, {
        evidence_window: buildWindow(concept),
      });

      const inserted = await client.mutation(api.lab.insertEvidenceBatch, {
        window_id,
        evidences: [
          {
            title: "Evidence A",
            url: `https://example.com/${suffix}/a`,
            raw_content: "Evidence A content",
          },
          {
            title: "Evidence B",
            url: `https://example.com/${suffix}/b`,
            raw_content: "Evidence B content",
          },
        ],
      });

      const collected = await client.action(api.lab.collectEvidence, {
        window_id,
        evidence_limit: 2,
      });

      expect(collected.evidence_count).toBe(2);

      const initResult = await client.mutation(api.lab.initExperiment, {
        window_id,
        evidence_ids: inserted.evidence_ids,
        experiment: buildExperimentSpec(experiment_tag, concept),
      });
      if (!initResult.experiment_id) {
        throw new Error("Missing experiment_id");
      }
      experiment_id = initResult.experiment_id;

      const start = await client.mutation(api.lab.startExperiment, {
        experiment_id,
        run_counts: { sample_count: 1 },
      });
      if (!start.ok || !start.run_ids || start.run_ids.length === 0) return;

      const experimentEvidence = await client.query(
        api.lab.listExperimentEvidence,
        {
          experiment_id,
        },
      );
      expect(experimentEvidence.length).toBe(2);

      const states = await client.query(api.lab.getExperimentStates, {
        experiment_ids: [experiment_id],
      });
      expect(states[0].evidence_selected_count).toBe(2);
    } finally {
      if (experiment_id) {
        await client.mutation(api.lab.resetExperiment, {
          experiment_id,
          cleanup_window: true,
        });
      }
    }
  });

  if (!shouldRun) {
    test("skipped: CONVEX_URL not set", () => {
      expect(CONVEX_URL).toBeUndefined();
    });
  }
});
