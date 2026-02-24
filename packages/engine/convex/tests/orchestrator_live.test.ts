// import { describe, expect, test } from "vitest";
// import { convexTest } from "convex-test";
// import schema from "../schema";
// import { buildModules } from "./test.setup";
// import { internal } from "../_generated/api";
// import type { Doc, Id } from "../_generated/dataModel";
// import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/dist/component/schema.js";
// import type { ModelType } from "../platform/providers/provider_types";
// import { ENGINE_SETTINGS } from "../settings";
// import {
//   handleQueuedBatchWorkflow,
//   handleQueuedJobWorkflow,
//   handleRunningBatchWorkflow,
// } from "../domain/orchestrator/process_workflows";

// const liveEnabled =
//   process.env.VITEST_LIVE_TESTS === "1" &&
//   Boolean(process.env.OPENAI_API_KEY);

// const describeLive = liveEnabled ? describe : describe.skip;

// const rateLimiterModules = import.meta.glob(
//   "../../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js",
// );

// const initTest = () => {
//   const t = convexTest(schema, buildModules({ live: true }));
//   t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
//   return t;
// };

// type EvidenceDoc = Doc<"evidences">;

// type RequestDoc = Doc<"llm_requests">;

// function sleep(ms: number) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// function buildWindowInput(query: string, model: ModelType) {
//   return {
//     start_date: "2026-01-01",
//     end_date: "2026-01-02",
//     country: "USA",
//     query,
//     model,
//   };
// }

// function buildEvidenceBatch(count: number, label: string) {
//   return Array.from({ length: count }, (_, index) => ({
//     title: `Evidence ${index + 1} (${label})`,
//     url: `https://example.com/${label}/${index + 1}`,
//     raw_content: `Raw content ${index + 1} for ${label}.`,
//   }));
// }

// async function createWindowWithEvidence(
//   t: ReturnType<typeof convexTest>,
//   model: ModelType,
//   count: number,
//   label: string,
// ) {
//   const window_id = await t.mutation(
//     internal.domain.window.window_repo.createWindow,
//     buildWindowInput(label, model),
//   );
//   await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
//     window_id,
//     evidences: buildEvidenceBatch(count, label),
//   });
//   return window_id;
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

// async function getRequests(
//   t: ReturnType<typeof convexTest>,
//   requestIds: Array<Id<"llm_requests"> | null>,
// ) {
//   const ids = requestIds.filter(Boolean) as Id<"llm_requests">[];
//   const requests = await Promise.all(
//     ids.map((request_id) =>
//       t.query(internal.domain.llm_calls.llm_request_repo.getLlmRequest, {
//         request_id,
//       }),
//     ),
//   );
//   return requests as RequestDoc[];
// }

// async function getLatestRequestsForStage(
//   t: ReturnType<typeof convexTest>,
//   evidences: EvidenceDoc[],
//   stage: "l1_cleaned" | "l2_neutralized" | "l3_abstracted",
// ) {
//   const requests = await Promise.all(
//     evidences.map(async (evidence) => {
//       const custom_key = `evidence:${evidence._id}:${stage}`;
//       const list = await t.query(
//         internal.domain.llm_calls.llm_request_repo.listRequestsByCustomKey,
//         { custom_key },
//       );
//       if (list.length === 0) return null;
//       return list.reduce((best, req) => {
//         const bestAttempts = best.attempts ?? 0;
//         const nextAttempts = req.attempts ?? 0;
//         return nextAttempts >= bestAttempts ? req : best;
//       });
//     }),
//   );
//   return requests.filter(Boolean) as RequestDoc[];
// }

// function jobCountForPolicy() {
//   const policy = ENGINE_SETTINGS.run_policy;
//   if (policy.job_fallback_count > 0) return policy.job_fallback_count;
//   return Math.max(1, policy.min_batch_size - 1);
// }

// function batchCountForPolicy() {
//   const policy = ENGINE_SETTINGS.run_policy;
//   return Math.max(policy.min_batch_size, policy.job_fallback_count + 1);
// }

// async function createManualBatch(
//   t: ReturnType<typeof convexTest>,
//   model: ModelType,
//   count: number,
//   label: string,
// ) {
//   const window_id = await t.mutation(
//     internal.domain.window.window_repo.createWindow,
//     buildWindowInput(label, model),
//   );
//   await t.mutation(internal.domain.window.window_repo.insertEvidenceBatch, {
//     window_id,
//     evidences: buildEvidenceBatch(count, label),
//   });

//   const evidences = (await listEvidence(t, window_id)) as EvidenceDoc[];
//   const batch_id = await t.mutation(
//     internal.domain.llm_calls.llm_batch_repo.createLlmBatch,
//     {
//       provider: "openai",
//       model,
//       custom_key: `window:${window_id}:l1_cleaned`,
//     },
//   );

//   const request_ids: Id<"llm_requests">[] = [];
//   for (const evidence of evidences) {
//     const request_id = await t.mutation(
//       internal.domain.llm_calls.llm_request_repo.createLlmRequest,
//       {
//         model,
//         system_prompt: "You are a helpful assistant.",
//         user_prompt: `Summarize: ${evidence.l0_raw_content}`,
//         custom_key: `evidence:${evidence._id}:l1_cleaned`,
//       },
//     );
//     request_ids.push(request_id);
//   }

//   await t.mutation(internal.domain.llm_calls.llm_batch_repo.assignRequestsToBatch, {
//     batch_id,
//     request_ids,
//   });

//   await t.run(async (ctx) => {
//     await ctx.db.patch(window_id, {
//       status: "running",
//       current_stage: "l1_cleaned",
//     });
//   });

//   return { window_id, batch_id, request_ids };
// }

// async function pollBatchUntilNotRunning(
//   t: ReturnType<typeof convexTest>,
//   batch_id: Id<"llm_batches">,
//   maxPolls = 8,
// ) {
//   const step = buildWorkflowStep(t);
//   for (let poll = 0; poll < maxPolls; poll++) {
//     const current = await t.query(
//       internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
//       { batch_id },
//     );
//     if (current.batch.status !== "running") return current;
//     const nextPollAt = current.batch.next_poll_at ?? Date.now();
//     const waitMs = Math.max(0, nextPollAt - Date.now());
//     if (waitMs > 0) {
//       await sleep(waitMs + 150);
//     }
//     await handleRunningBatchWorkflow(step, { batch_id });
//   }

//   return t.query(internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests, {
//     batch_id,
//   });
// }

// function buildWorkflowStep(t: ReturnType<typeof convexTest>) {
//   return {
//     runAction: t.action,
//     runMutation: t.mutation,
//     runQuery: t.query,
//   };
// }

// describeLive("live provider integration", () => {
//   test(
//     "job workflow runs a real chat call",
//     async () => {
//       const t = initTest();
//       const window_id = await createWindowWithEvidence(
//         t,
//         "gpt-5.2-chat",
//         jobCountForPolicy(),
//         "live_job",
//       );
//       await t.mutation(
//         internal.domain.window.window_service.startWindowOrchestration,
//         { window_id },
//       );

//       const evidences = await listEvidence(t, window_id);
//       const requests = await getLatestRequestsForStage(
//         t,
//         evidences,
//         "l1_cleaned",
//       );
//       const job_id = requests[0].job_id as Id<"llm_jobs">;

//       await handleQueuedJobWorkflow(buildWorkflowStep(t), { job_id });

//       const updatedRequests = await getRequests(
//         t,
//         requests.map((req) => req._id),
//       );
//       updatedRequests.forEach((req) => {
//         expect(req.status).toBe("success");
//         expect(req.assistant_output?.length ?? 0).toBeGreaterThan(0);
//       });

//       const updatedEvidence = await listEvidence(t, window_id);
//       updatedEvidence.forEach((evidence) => {
//         expect(evidence.l1_cleaned_content).not.toBeNull();
//       });
//     },
//     60000,
//   );

//   test(
//     "batch workflow submits real batch",
//     async () => {
//       const t = initTest();
//       const window_id = await createWindowWithEvidence(
//         t,
//         "gpt-4.1-mini",
//         batchCountForPolicy(),
//         "live_batch",
//       );
//       await t.mutation(
//         internal.domain.window.window_service.startWindowOrchestration,
//         { window_id },
//       );

//       const evidences = await listEvidence(t, window_id);
//       const requests = await getLatestRequestsForStage(
//         t,
//         evidences,
//         "l1_cleaned",
//       );
//       const batch_id = requests[0].batch_id as Id<"llm_batches">;

//       await handleQueuedBatchWorkflow(buildWorkflowStep(t), { batch_id });

//       const batch = await t.query(
//         internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
//         { batch_id },
//       );
//       expect(batch.batch.status).toBe("running");
//       expect(batch.batch.batch_ref).toBeDefined();
//     },
//     120000,
//   );

//   test(
//     "batch workflow retries and errors for non-batchable model",
//     async () => {
//       const t = initTest();
//       const originalMaxRetries = ENGINE_SETTINGS.run_policy.max_batch_retries;
//       ENGINE_SETTINGS.run_policy.max_batch_retries = 4;
//       try {
//         const { window_id, batch_id, request_ids } = await createManualBatch(
//           t,
//           "gpt-5.2-chat",
//           1,
//           "live_batch_fail",
//         );

//         const step = buildWorkflowStep(t);
//         const targetFailures = 3;
//         let failures = 0;

//         while (failures < targetFailures) {
//           await handleQueuedBatchWorkflow(step, { batch_id });
//           const running = await t.query(
//             internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
//             { batch_id },
//           );
//           if (running.batch.status !== "running") {
//             throw new Error(
//               `Expected running batch, got ${running.batch.status}`,
//             );
//           }

//           const result = await pollBatchUntilNotRunning(t, batch_id, 10);
//           const status = result.batch.status;
//           if (status === "queued") {
//             failures += 1;
//             continue;
//           }
//           if (status === "error") {
//             failures += 1;
//             break;
//           }
//           throw new Error(`Unexpected batch status: ${status}`);
//         }

//         expect(failures).toBe(targetFailures);

//         const finalBatch = await t.query(
//           internal.domain.llm_calls.llm_batch_repo.getBatchWithRequests,
//           { batch_id },
//         );
//         expect(finalBatch.batch.status).toBe("error");

//         const updatedRequests = await getRequests(t, request_ids);
//         updatedRequests.forEach((req) => {
//           expect(req.status).toBe("error");
//         });

//         const window = await t.query(
//           internal.domain.window.window_repo.getWindow,
//           { window_id },
//         );
//         expect(window.status).toBe("error");
//       } finally {
//         ENGINE_SETTINGS.run_policy.max_batch_retries = originalMaxRetries;
//       }
//     },
//     240000,
//   );
// });
