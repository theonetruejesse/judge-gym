// import { describe, expect, test } from "vitest";
// import { convexTest } from "convex-test";
// import schema from "../schema";
// import { buildModules } from "./test.setup";
// import { internal } from "../_generated/api";
// import type { Doc, Id } from "../_generated/dataModel";

// const initTest = () => convexTest(schema, buildModules());

// type EvidenceDoc = Doc<"evidences">;

// type Stage = "l1_cleaned" | "l2_neutralized" | "l3_abstracted";

// function buildWindowInput(query: string) {
//   return {
//     start_date: "2026-01-01",
//     end_date: "2026-01-02",
//     country: "USA",
//     query,
//     model: "gpt-4.1" as const,
//   };
// }

// function buildEvidenceBatch(count: number, label: string) {
//   return Array.from({ length: count }, (_, index) => ({
//     title: `Evidence ${index + 1} (${label})`,
//     url: `https://example.com/${label}/${index + 1}`,
//     raw_content: `Raw content ${index + 1} for ${label}.`,
//   }));
// }

// async function listEvidence(
//   t: ReturnType<typeof convexTest>,
//   window_id: Id<"windows">,
// ) {
//   return (await t.query(
//     internal.domain.window.window_repo.listEvidenceByWindow,
//     { window_id },
//   )) as EvidenceDoc[];
// }

// async function getLatestRequestForStage(
//   t: ReturnType<typeof convexTest>,
//   evidenceId: Id<"evidences">,
//   stage: Stage,
// ) {
//   const custom_key = `evidence:${evidenceId}:${stage}`;
//   const requests = await t.query(
//     internal.domain.llm_calls.llm_request_repo.listRequestsByCustomKey,
//     { custom_key },
//   );
//   if (requests.length === 0) return null;
//   return requests.reduce((best, req) => {
//     const bestAttempts = best.attempts ?? 0;
//     const nextAttempts = req.attempts ?? 0;
//     return nextAttempts >= bestAttempts ? req : best;
//   });
// }

// async function applyStageOutputs(
//   t: ReturnType<typeof convexTest>,
//   window_id: Id<"windows">,
//   stage: Stage,
//   label: string,
// ) {
//   const evidences = await listEvidence(t, window_id);

//   for (const evidence of evidences) {
//     const request = await getLatestRequestForStage(t, evidence._id, stage);
//     if (!request) {
//       throw new Error(`Missing request id for ${stage} on ${evidence._id}`);
//     }
//     await t.mutation(internal.domain.window.window_service.applyRequestResult, {
//       request_id: request._id,
//       custom_key: request.custom_key,
//       output: `${stage} output for ${label} (${evidence._id})`,
//     });
//   }
// }

// describe("window flow integration (simulated)", () => {
//   test("completes all stages with manual results", async () => {
//     const t = initTest();
//     const label = `integration_${Date.now()}`;

//     const window_id = await t.mutation(
//       internal.domain.window.window_repo.createWindow,
//       buildWindowInput("the economy"),
//     );

//     await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
//       window_id,
//       evidences: buildEvidenceBatch(3, label),
//     });

//     await t.mutation(
//       internal.domain.window.window_service.startWindowOrchestration,
//       { window_id },
//     );

//     await applyStageOutputs(t, window_id, "l1_cleaned", label);
//     let window = await t.query(internal.domain.window.window_repo.getWindow, {
//       window_id,
//     });
//     expect(window.current_stage).toBe("l2_neutralized");

//     await applyStageOutputs(t, window_id, "l2_neutralized", label);
//     window = await t.query(internal.domain.window.window_repo.getWindow, {
//       window_id,
//     });
//     expect(window.current_stage).toBe("l3_abstracted");

//     await applyStageOutputs(t, window_id, "l3_abstracted", label);
//     window = await t.query(internal.domain.window.window_repo.getWindow, {
//       window_id,
//     });
//     expect(window.status).toBe("completed");
//     expect(window.current_stage).toBe("l3_abstracted");

//     const evidences = await listEvidence(t, window_id);
//     evidences.forEach((row) => {
//       expect(row.l3_abstracted_content).not.toBeNull();
//     });
//   });
// });
