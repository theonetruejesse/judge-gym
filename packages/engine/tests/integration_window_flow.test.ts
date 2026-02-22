import { describe, expect, test } from "bun:test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL;
const shouldRun = Boolean(CONVEX_URL);
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);

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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("lab evidence window smoke", () => {
  test("window flow completes stages", async () => {
    if (!shouldRun) return;
    if (!hasOpenAI) return;

    const client = new ConvexHttpClient(CONVEX_URL!);
    const suffix = uniqueSuffix();
    const concept = `lab_evidence_${suffix}`;

    const { window_id } = await client.mutation(
      api.packages.lab.initEvidenceWindow,
      { evidence_window: buildWindow(concept) },
    );

    await client.mutation(api.packages.lab.insertEvidenceBatch, {
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

    await client.action(api.packages.lab.startWindowFlow, {
      window_id,
      evidence_limit: 2,
    });

    await client.mutation(api.packages.lab.startScheduler, {});

    let completed = false;
    for (let i = 0; i < 60; i += 1) {
      const summary = await client.query(api.packages.lab.getWindowSummary, {
        window_id,
      });

      const list = await client.query(api.packages.lab.listEvidenceByWindow, {
        window_id,
      });

      const contents = await Promise.all(
        list.map((row: { evidence_id: string }) =>
          client.query(api.packages.lab.getEvidenceContent, {
            evidence_id: row.evidence_id,
          }),
        ),
      );

      const allAbstracted = contents.every(
        (row) => row?.abstracted_content && row.abstracted_content.length > 0,
      );

      if (summary?.status === "completed" && allAbstracted) {
        completed = true;
        break;
      }

      await sleep(2000);
    }

    expect(completed).toBe(true);
  });

  if (!shouldRun) {
    test("skipped: CONVEX_URL not set", () => {
      expect(CONVEX_URL).toBeUndefined();
    });
  }
});
