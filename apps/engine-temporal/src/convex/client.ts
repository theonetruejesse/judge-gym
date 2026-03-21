import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type {
  ProjectProcessStateInput,
  RunStageKey,
  WindowStageKey,
} from "@judge-gym/engine-settings/process";
import type {
  QuotaReservationInput,
  QuotaReservationResult,
  QuotaSettlementInput,
} from "@judge-gym/engine-settings/quota";

function requireConvexUrl() {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL is not set");
  }
  return url;
}

type WindowExecutionContext = {
  window_run_id: string;
  window_id: string;
  workflow_id: string | null;
  workflow_run_id: string | null;
  status: string;
  current_stage: string;
  pause_after: string | null;
  target_stage: string;
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

type WindowSearchResult = {
  title: string;
  url: string;
  raw_content: string;
};

type RunExecutionContext = {
  run_id: string;
  experiment_id: string;
  workflow_id: string | null;
  workflow_run_id: string | null;
  status: string;
  current_stage: string;
  target_count: number;
  completed_count: number;
  pause_after: string | null;
};

type RunStageInput = {
  target_type: "sample" | "sample_score_target";
  target_id: string;
  model: string;
  system_prompt: string;
  user_prompt: string;
  metadata_json: string | null;
};

type AttemptStartInput = {
  attempt_key?: string;
  process_kind: "window" | "run";
  process_id: string;
  target_type: "evidence" | "sample" | "sample_score_target";
  target_id: string;
  stage: string;
  provider: string;
  model: string;
  operation_type: "chat" | "batch";
  workflow_id: string;
  system_prompt: string;
  user_prompt: string;
  metadata_json?: string | null;
};

type BatchExecutionInput = {
  batch_key: string;
  process_kind: "window" | "run";
  process_id: string;
  stage: string;
  provider: string;
  model: string;
  workflow_id: string;
  item_count: number;
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

type ProcessHeartbeatInput = {
  process_kind: "window" | "run";
  process_id: string;
  stage: string;
  event_name?: string;
  payload_json?: string | null;
};

type StageResultInput = {
  window_run_id: string;
  evidence_id: string;
  stage: Exclude<WindowStageKey, "collect">;
  attempt_id: string;
  output: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

type StageFailureInput = {
  window_run_id: string;
  evidence_id: string;
  stage: Exclude<WindowStageKey, "collect">;
  attempt_id: string;
  error_message: string;
};

const workerApi = {
  getRunExecutionContext: makeFunctionReference<"query">(
    "packages/worker:getRunExecutionContext",
  ),
  bindRunWorkflow: makeFunctionReference<"mutation">(
    "packages/worker:bindRunWorkflow",
  ),
  getWindowExecutionContext: makeFunctionReference<"query">(
    "packages/worker:getWindowExecutionContext",
  ),
  searchWindowEvidence: makeFunctionReference<"action">(
    "packages/worker:searchWindowEvidence",
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
  listRunStageInputs: makeFunctionReference<"query">(
    "packages/worker:listRunStageInputs",
  ),
  recordLlmAttemptStart: makeFunctionReference<"mutation">(
    "packages/worker:recordLlmAttemptStart",
  ),
  recordLlmAttemptFinish: makeFunctionReference<"mutation">(
    "packages/worker:recordLlmAttemptFinish",
  ),
  recordProcessHeartbeat: makeFunctionReference<"mutation">(
    "packages/worker:recordProcessHeartbeat",
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
  applyRunStageResult: makeFunctionReference<"mutation">(
    "packages/worker:applyRunStageResult",
  ),
  markRunStageFailure: makeFunctionReference<"mutation">(
    "packages/worker:markRunStageFailure",
  ),
  finalizeRunStage: makeFunctionReference<"mutation">(
    "packages/worker:finalizeRunStage",
  ),
  markRunProcessError: makeFunctionReference<"mutation">(
    "packages/worker:markRunProcessError",
  ),
  getBatchExecution: makeFunctionReference<"query">(
    "packages/worker:getBatchExecution",
  ),
  ensureBatchExecution: makeFunctionReference<"mutation">(
    "packages/worker:ensureBatchExecution",
  ),
  bindBatchExecutionSubmitted: makeFunctionReference<"mutation">(
    "packages/worker:bindBatchExecutionSubmitted",
  ),
  finalizeBatchExecution: makeFunctionReference<"mutation">(
    "packages/worker:finalizeBatchExecution",
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

  getRunExecutionContext(run_id: string) {
    return this.client.query(workerApi.getRunExecutionContext, {
      run_id,
    }) as Promise<RunExecutionContext>;
  }

  bindRunWorkflow(args: {
    run_id: string;
    workflow_id: string;
    workflow_run_id: string;
  }) {
    return this.client.mutation(workerApi.bindRunWorkflow, args);
  }

  getWindowExecutionContext(window_run_id: string) {
    return this.client.query(workerApi.getWindowExecutionContext, {
      window_run_id,
    }) as Promise<WindowExecutionContext>;
  }

  searchWindowEvidence(args: {
    query: string;
    country: string;
    start_date: string;
    end_date: string;
    limit: number;
  }) {
    return this.client.action(workerApi.searchWindowEvidence, args) as Promise<WindowSearchResult[]>;
  }

  bindWindowWorkflow(args: {
    window_run_id: string;
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
    window_run_id: string;
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
    window_run_id: string;
    stage: Exclude<WindowStageKey, "collect">;
  }) {
    return this.client.query(workerApi.listWindowStageInputs, args) as Promise<
      WindowStageInput[]
    >;
  }

  listRunStageInputs(args: {
    run_id: string;
    stage: RunStageKey;
  }) {
    return this.client.query(workerApi.listRunStageInputs, args) as Promise<
      RunStageInput[]
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

  recordProcessHeartbeat(args: ProcessHeartbeatInput) {
    return this.client.mutation(workerApi.recordProcessHeartbeat, args);
  }

  applyWindowStageResult(args: StageResultInput) {
    return this.client.mutation(workerApi.applyWindowStageResult, args);
  }

  markWindowStageFailure(args: StageFailureInput) {
    return this.client.mutation(workerApi.markWindowStageFailure, args);
  }

  markWindowNoEvidence(args: { window_run_id: string }) {
    return this.client.mutation(workerApi.markWindowNoEvidence, args);
  }

  markWindowProcessError(args: {
    window_run_id: string;
    stage: WindowStageKey | null;
    error_message: string;
  }) {
    return this.client.mutation(workerApi.markWindowProcessError, args);
  }

  applyRunStageResult(args: {
    run_id: string;
    target_id: string;
    stage: RunStageKey;
    attempt_id: string;
    output: string;
  }) {
    return this.client.mutation(workerApi.applyRunStageResult, args);
  }

  markRunStageFailure(args: {
    run_id: string;
    target_id: string;
    stage: RunStageKey;
    attempt_id: string;
    error_message: string;
  }) {
    return this.client.mutation(workerApi.markRunStageFailure, args);
  }

  finalizeRunStage(args: {
    run_id: string;
    stage: RunStageKey;
  }) {
    return this.client.mutation(workerApi.finalizeRunStage, args) as Promise<{
      total: number;
      completed: number;
      failed: number;
      has_pending: boolean;
      halt_process: boolean;
      terminal_execution_status: "completed" | "failed" | "canceled" | null;
      error_message: string | null;
    }>;
  }

  markRunProcessError(args: {
    run_id: string;
    stage: RunStageKey | null;
    error_message: string;
  }) {
    return this.client.mutation(workerApi.markRunProcessError, args);
  }

  getBatchExecution(args: { batch_key: string }) {
    return this.client.query(workerApi.getBatchExecution, args) as Promise<{
      batch_execution_id: string;
      provider_batch_id: string | null;
      status: string;
      output_file_id?: string | null;
      error_file_id?: string | null;
    } | null>;
  }

  ensureBatchExecution(args: BatchExecutionInput) {
    return this.client.mutation(workerApi.ensureBatchExecution, args) as Promise<{
      batch_execution_id: string;
      provider_batch_id: string | null;
      status: string;
      output_file_id?: string | null;
      error_file_id?: string | null;
    }>;
  }

  bindBatchExecutionSubmitted(args: {
    batch_execution_id: string;
    provider_batch_id: string;
    input_file_id?: string | null;
    provider_status: string;
  }) {
    return this.client.mutation(workerApi.bindBatchExecutionSubmitted, args);
  }

  finalizeBatchExecution(args: {
    batch_execution_id: string;
    status: "submitted" | "completed" | "failed" | "cancelled";
    provider_status: string;
    output_file_id?: string | null;
    error_file_id?: string | null;
    error_message?: string | null;
  }) {
    return this.client.mutation(workerApi.finalizeBatchExecution, args);
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
