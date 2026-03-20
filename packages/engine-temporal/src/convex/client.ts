import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type {
  ProjectProcessStateInput,
  QuotaReservationInput,
  QuotaReservationResult,
  QuotaSettlementInput,
  WindowStageKey,
} from "@judge-gym/engine-settings";

function requireConvexUrl() {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL is not set");
  }
  return url;
}

type WindowExecutionContext = {
  window_id: string;
  workflow_id: string | null;
  workflow_run_id: string | null;
  status: string;
  current_stage: string;
  target_count: number;
  completed_count: number;
  model: string;
  start_date: string;
  end_date: string;
  country: string;
  query: string;
};

type WindowStageInput = {
  evidence_id: string;
  title: string;
  url: string;
  input: string;
};

type AttemptStartInput = {
  process_kind: "window";
  process_id: string;
  target_type: "evidence";
  target_id: string;
  stage: string;
  provider: string;
  model: string;
  operation_type: "chat";
  workflow_id: string;
  system_prompt: string;
  user_prompt: string;
  metadata_json?: string | null;
};

type AttemptFinishInput = {
  attempt_id: string;
  status: "succeeded" | "failed";
  assistant_output?: string | null;
  error_message?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

type StageResultInput = {
  window_id: string;
  evidence_id: string;
  stage: Exclude<WindowStageKey, "collect">;
  attempt_id: string;
  output: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

type StageFailureInput = {
  window_id: string;
  evidence_id: string;
  stage: Exclude<WindowStageKey, "collect">;
  attempt_id: string;
  error_message: string;
};

const workerApi = {
  getWindowExecutionContext: makeFunctionReference<"query">(
    "packages/worker:getWindowExecutionContext",
  ),
  bindWindowWorkflow: makeFunctionReference<"mutation">(
    "packages/worker:bindWindowWorkflow",
  ),
  projectProcessState: makeFunctionReference<"mutation">(
    "packages/worker:projectProcessState",
  ),
  insertWindowEvidenceBatch: makeFunctionReference<"mutation">(
    "packages/worker:insertWindowEvidenceBatch",
  ),
  listWindowStageInputs: makeFunctionReference<"query">(
    "packages/worker:listWindowStageInputs",
  ),
  recordLlmAttemptStart: makeFunctionReference<"mutation">(
    "packages/worker:recordLlmAttemptStart",
  ),
  recordLlmAttemptFinish: makeFunctionReference<"mutation">(
    "packages/worker:recordLlmAttemptFinish",
  ),
  applyWindowStageResult: makeFunctionReference<"mutation">(
    "packages/worker:applyWindowStageResult",
  ),
  markWindowStageFailure: makeFunctionReference<"mutation">(
    "packages/worker:markWindowStageFailure",
  ),
  markWindowNoEvidence: makeFunctionReference<"mutation">(
    "packages/worker:markWindowNoEvidence",
  ),
  markWindowProcessError: makeFunctionReference<"mutation">(
    "packages/worker:markWindowProcessError",
  ),
  reserveQuota: makeFunctionReference<"mutation">(
    "packages/worker:reserveQuota",
  ),
  settleQuota: makeFunctionReference<"mutation">(
    "packages/worker:settleQuota",
  ),
} as const;

export class ConvexWorkerClient {
  private readonly client: ConvexHttpClient;

  constructor(url = requireConvexUrl()) {
    this.client = new ConvexHttpClient(url);
  }

  getWindowExecutionContext(window_id: string) {
    return this.client.query(workerApi.getWindowExecutionContext, {
      window_id,
    }) as Promise<WindowExecutionContext>;
  }

  bindWindowWorkflow(args: {
    window_id: string;
    workflow_id: string;
    workflow_run_id: string;
  }) {
    return this.client.mutation(workerApi.bindWindowWorkflow, args);
  }

  projectProcessState<TStage extends string>(
    input: ProjectProcessStateInput<TStage>,
  ) {
    return this.client.mutation(workerApi.projectProcessState, input);
  }

  insertWindowEvidenceBatch(args: {
    window_id: string;
    evidences: Array<{
      title: string;
      url: string;
      raw_content: string;
    }>;
  }) {
    return this.client.mutation(workerApi.insertWindowEvidenceBatch, args) as Promise<{
      inserted: number;
      total: number;
    }>;
  }

  listWindowStageInputs(args: {
    window_id: string;
    stage: Exclude<WindowStageKey, "collect">;
  }) {
    return this.client.query(workerApi.listWindowStageInputs, args) as Promise<
      WindowStageInput[]
    >;
  }

  recordLlmAttemptStart(args: AttemptStartInput) {
    return this.client.mutation(workerApi.recordLlmAttemptStart, args) as Promise<{
      attempt_id: string;
    }>;
  }

  recordLlmAttemptFinish(args: AttemptFinishInput) {
    return this.client.mutation(workerApi.recordLlmAttemptFinish, args);
  }

  applyWindowStageResult(args: StageResultInput) {
    return this.client.mutation(workerApi.applyWindowStageResult, args);
  }

  markWindowStageFailure(args: StageFailureInput) {
    return this.client.mutation(workerApi.markWindowStageFailure, args);
  }

  markWindowNoEvidence(args: { window_id: string }) {
    return this.client.mutation(workerApi.markWindowNoEvidence, args);
  }

  markWindowProcessError(args: {
    window_id: string;
    stage: WindowStageKey | null;
    error_message: string;
  }) {
    return this.client.mutation(workerApi.markWindowProcessError, args);
  }

  reserveQuota(args: QuotaReservationInput) {
    return this.client.mutation(workerApi.reserveQuota, args) as Promise<QuotaReservationResult>;
  }

  settleQuota(args: QuotaSettlementInput) {
    return this.client.mutation(workerApi.settleQuota, args);
  }
}

let cachedWorkerClient: ConvexWorkerClient | null = null;

export function getConvexWorkerClient() {
  cachedWorkerClient ??= new ConvexWorkerClient();
  return cachedWorkerClient;
}
