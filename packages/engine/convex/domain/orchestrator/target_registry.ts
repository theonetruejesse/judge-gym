import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { SemanticLevel } from "../../models/_shared";
import { WindowOrchestrator } from "../window/window_orchestrator";

type EvidenceRequestKey = {
  targetId: Id<"evidences">;
  stage: SemanticLevel;
};

export type RequeueHandler = (
  ctx: MutationCtx,
  request: Doc<"llm_requests">,
) => Promise<void>;

function parseTargetType(key: string): string {
  return key.split(":")[0] ?? "";
}

const evidenceHandler: RequeueHandler = async (ctx, request) => {
  const orchestrator = new WindowOrchestrator(ctx);
  const { targetId, stage } = orchestrator.parseRequestKey(
    request.custom_key,
  ) as EvidenceRequestKey;

  const evidence = await ctx.db.get(targetId);
  if (!evidence) {
    throw new Error(`Evidence not found for retry: ${targetId}`);
  }

  const jobId = (await ctx.runMutation(
    internal.domain.llm_calls.llm_job_repo.createLlmJob,
    {
      provider: "openai",
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
        batch_id: undefined,
      },
    },
  );
};

const REQUEUE_HANDLERS: Record<string, RequeueHandler> = {
  evidence: evidenceHandler,
};

export function resolveRequeueHandler(key: string): RequeueHandler | null {
  const targetType = parseTargetType(key);
  return REQUEUE_HANDLERS[targetType] ?? null;
}
