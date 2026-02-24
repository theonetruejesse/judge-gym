import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction, zInternalMutation } from "../../utils/custom_fns";
import { SemanticLevel, SemanticLevelSchema } from "../../models/_shared";
import { WindowOrchestrator } from "./window_orchestrator";
import { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { getProviderForModel } from "../../platform/providers/provider_types";
import type { MutationCtx } from "../../_generated/server";
import { ENGINE_SETTINGS } from "../../settings";

const DEFAULT_EVIDENCE_LIMIT = 15;

export const collectWindowEvidence: ReturnType<typeof zInternalAction> = zInternalAction({
  args: z.object({
    window_id: zid("windows"),
    limit: z.number().optional(),
  }),
  returns: z.object({
    inserted: z.number(),
    total: z.number(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? DEFAULT_EVIDENCE_LIMIT;
    const results = await ctx.runAction(
      internal.domain.window.window_repo.runWindowSearch,
      {
        window_id: args.window_id,
        limit,
      },
    );

    const insertResult = await ctx.runMutation(
      internal.domain.window.window_repo.insertEvidenceBatch,
      {
        window_id: args.window_id,
        evidences: results,
      },
    );

    return insertResult;
  },
});

export const startWindowFlow: ReturnType<typeof zInternalAction> = zInternalAction({
  args: z.object({
    window_id: zid("windows"),
    limit: z.number().optional(),
  }),
  returns: z.object({
    inserted: z.number(),
    total: z.number(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(
      internal.domain.window.window_repo.listEvidenceByWindow,
      { window_id: args.window_id },
    );

    // for now, only run this if the window has no evidence
    let evidenceResult = { inserted: 0, total: existing.length };
    if (existing.length === 0) {
      evidenceResult = await ctx.runAction(
        internal.domain.window.window_service.collectWindowEvidence,
        {
          window_id: args.window_id,
          limit: args.limit,
        },
      );
    }

    await ctx.runMutation(
      internal.domain.window.window_service.startWindowOrchestration,
      { window_id: args.window_id },
    );

    return evidenceResult;
  },
});

// todo, fix later
export const startWindowOrchestration = zInternalMutation({
  args: z.object({
    window_id: zid("windows"),
  }),
  handler: async (ctx, args) => {
    const window = await ctx.db.get(args.window_id);

    if (!window) throw new Error("Window not found");
    if (
      window.status === "completed" ||
      window.status === "canceled" ||
      window.status === "error"
    )
      return;

    await ctx.db.patch(args.window_id, {
      status: "running",
      current_stage: "l1_cleaned",
    });

    const orchestrator = new WindowOrchestrator(ctx);
    await orchestrator.enqueueStage(args.window_id, "l1_cleaned");
  },
});

export const enqueueWindowStage = zInternalMutation({
  args: z.object({
    window_id: zid("windows"),
    stage: SemanticLevelSchema,
  }),
  handler: async (ctx, args) => {
    const orchestrator = new WindowOrchestrator(ctx);
    await orchestrator.enqueueStage(args.window_id, args.stage);
  },
});

export const applyRequestResult = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
    custom_key: z.string(),
    output: z.string(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
  }),
  handler: async (ctx, args) => {
    const orchestrator = new WindowOrchestrator(ctx);
    const { targetId, stage } = orchestrator.parseRequestKey(args.custom_key);
    const config = orchestrator.getStageConfig(stage);
    const evidenceId = targetId as Id<"evidences">;

    const evidence = await ctx.db.get(evidenceId);
    if (!evidence) throw new Error("Evidence not found");

    await ctx.db.patch(evidenceId, {
      [config.outputField]: args.output,
      [config.requestIdField]: args.request_id,
    } as Partial<Doc<"evidences">>);

    await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.patchRequest,
      {
        request_id: args.request_id,
        patch: {
          status: "success",
          assistant_output: args.output,
          input_tokens: args.input_tokens,
          output_tokens: args.output_tokens,
        },
      },
    );

    await maybeAdvanceWindowStage(ctx, evidence.window_id, stage);
  },
});

export const handleRequestError = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
    custom_key: z.string(),
  }),
  handler: async (ctx, args) => {
    const orchestrator = new WindowOrchestrator(ctx);
    const { targetId, stage } = orchestrator.parseRequestKey(args.custom_key);
    const evidence = await ctx.db.get(targetId as Id<"evidences">);
    if (!evidence) throw new Error("Evidence not found");
    await maybeAdvanceWindowStage(ctx, evidence.window_id, stage);
  },
});

export const requeueWindowRequest = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.runQuery(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: args.request_id },
    );

    const orchestrator = new WindowOrchestrator(ctx);
    const { targetId, stage } = orchestrator.parseRequestKey(
      request.custom_key,
    );

    const evidence = await ctx.db.get(targetId as Id<"evidences">);
    if (!evidence) {
      throw new Error(`Evidence not found for retry: ${targetId}`);
    }

    const provider = getProviderForModel(request.model);
    const jobId = (await ctx.runMutation(
      internal.domain.llm_calls.llm_job_repo.createLlmJob,
      {
        provider,
        model: request.model,
        custom_key: orchestrator.makeProcessKey(evidence.window_id, stage),
      },
    )) as Id<"llm_jobs">;

    await ctx.runMutation(
      internal.domain.llm_calls.llm_request_repo.patchRequest,
      {
        request_id: request._id,
        patch: {
          job_id: jobId,
          batch_id: null,
        },
      },
    );
  },
});

const STAGE_ORDER: SemanticLevel[] = [
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
];

function nextStageFor(stage: SemanticLevel): SemanticLevel | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1) return null;
  return STAGE_ORDER[idx + 1] ?? null;
}

async function maybeAdvanceWindowStage(
  ctx: MutationCtx,
  windowId: Id<"windows">,
  stage: SemanticLevel,
) {
  if (stage === "l0_raw") return;
  const window = await ctx.db.get(windowId);
  if (!window) return;
  if (
    window.status === "completed" ||
    window.status === "canceled" ||
    window.status === "error"
  )
    return;

  const orchestrator = new WindowOrchestrator(ctx);
  const config = orchestrator.getStageConfig(stage);

  const evidences = await ctx.db
    .query("evidences")
    .withIndex("by_window_id", (q) => q.eq("window_id", windowId))
    .collect();

  if (evidences.length === 0) return;
  let completed = 0;
  let failed = 0;
  let hasPending = false;

  for (const evidence of evidences) {
    const output = evidence[config.outputField];
    if (output !== null) {
      completed += 1;
      continue;
    }

    const custom_key = orchestrator.makeRequestKey(evidence._id, stage);
    const pendingRequests = await ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", custom_key).eq("status", "pending"),
      )
      .collect();
    if (pendingRequests.length > 0) {
      hasPending = true;
      continue;
    }

    const requests = await ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key", (q) => q.eq("custom_key", custom_key))
      .collect();

    if (requests.length === 0) {
      hasPending = true;
      continue;
    }

    const maxAttempts = requests.reduce(
      (max, req) => Math.max(max, req.attempts ?? 0),
      0,
    );
    if (maxAttempts >= ENGINE_SETTINGS.run_policy.max_request_attempts) {
      failed += 1;
      continue;
    }
    hasPending = true;
  }

  if (hasPending) return;

  if (completed === 0 && failed > 0) {
    await ctx.db.patch(windowId, {
      status: "error",
      current_stage: stage,
    });
    return;
  }

  const nextStage = nextStageFor(stage);
  if (!nextStage) {
    await ctx.db.patch(windowId, {
      status: "completed",
      current_stage: stage,
    });
    return;
  }

  if (window.current_stage !== stage) return;
  await ctx.db.patch(windowId, { current_stage: nextStage });
  await ctx.runMutation(
    internal.domain.window.window_service.enqueueWindowStage,
    { window_id: windowId, stage: nextStage },
  );
}
