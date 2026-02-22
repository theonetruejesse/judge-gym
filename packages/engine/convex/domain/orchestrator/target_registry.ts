import { internal } from "../../_generated/api";

function parseTargetType(key: string): string {
  return key.split(":")[0] ?? "";
}

export type ApplyResultHandler =
  typeof internal.domain.window.window_service.applyRequestResult;
export type RequeueHandler =
  typeof internal.domain.window.window_service.requeueWindowRequest;

const APPLY_HANDLERS: Record<string, ApplyResultHandler> = {
  evidence: internal.domain.window.window_service.applyRequestResult,
};

const REQUEUE_HANDLERS: Record<string, RequeueHandler> = {
  evidence: internal.domain.window.window_service.requeueWindowRequest,
};

export function resolveApplyHandler(key: string): ApplyResultHandler | null {
  const targetType = parseTargetType(key);
  return APPLY_HANDLERS[targetType] ?? null;
}

export function resolveRequeueHandler(key: string): RequeueHandler | null {
  const targetType = parseTargetType(key);
  return REQUEUE_HANDLERS[targetType] ?? null;
}
