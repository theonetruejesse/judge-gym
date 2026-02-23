import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { modules } from "./test.setup";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

const initTest = () => convexTest(schema, modules);

type EvidenceDoc = Doc<"evidences">;

type Stage = "l1_cleaned" | "l2_neutralized" | "l3_abstracted";

function buildWindowInput(query: string) {
  return {
    start_date: "2026-01-01",
    end_date: "2026-01-02",
    country: "USA",
    query,
    model: "gpt-4.1" as const,
  };
}

function buildEvidenceBatch(count: number, label: string) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Evidence ${index + 1} (${label})`,
    url: `https://example.com/${label}/${index + 1}`,
    raw_content: `Raw content ${index + 1} for ${label}.`,
  }));
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

const REQUEST_FIELD_BY_STAGE: Record<Stage, keyof EvidenceDoc> = {
  l1_cleaned: "l1_request_id",
  l2_neutralized: "l2_request_id",
  l3_abstracted: "l3_request_id",
};

async function applyStageOutputs(
  t: ReturnType<typeof convexTest>,
  window_id: Id<"windows">,
  stage: Stage,
  label: string,
) {
  const evidences = await listEvidence(t, window_id);
  const requestField = REQUEST_FIELD_BY_STAGE[stage];

  for (const evidence of evidences) {
    const requestId = evidence[requestField] as Id<"llm_requests"> | null;
    if (!requestId) {
      throw new Error(`Missing request id for ${stage} on ${evidence._id}`);
    }
    const request = await t.query(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: requestId },
    );
    await t.mutation(internal.domain.window.window_service.applyRequestResult, {
      request_id: request._id,
      custom_key: request.custom_key,
      output: `${stage} output for ${label} (${evidence._id})`,
    });
  }
}

describe("window flow integration (simulated)", () => {
  test("completes all stages with manual results", async () => {
    const t = initTest();
    const label = `integration_${Date.now()}`;

    const window_id = await t.mutation(
      internal.domain.window.window_repo.createWindow,
      buildWindowInput("the economy"),
    );

    await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
      window_id,
      evidences: buildEvidenceBatch(3, label),
    });

    await t.mutation(
      internal.domain.window.window_service.startWindowOrchestration,
      { window_id },
    );

    await applyStageOutputs(t, window_id, "l1_cleaned", label);
    let window = await t.query(internal.domain.window.window_repo.getWindow, {
      window_id,
    });
    expect(window.current_stage).toBe("l2_neutralized");

    await applyStageOutputs(t, window_id, "l2_neutralized", label);
    window = await t.query(internal.domain.window.window_repo.getWindow, {
      window_id,
    });
    expect(window.current_stage).toBe("l3_abstracted");

    await applyStageOutputs(t, window_id, "l3_abstracted", label);
    window = await t.query(internal.domain.window.window_repo.getWindow, {
      window_id,
    });
    expect(window.status).toBe("completed");
    expect(window.current_stage).toBe("l3_abstracted");

    const evidences = await listEvidence(t, window_id);
    evidences.forEach((row) => {
      expect(row.l3_abstracted_content).not.toBeNull();
    });
  });
});
