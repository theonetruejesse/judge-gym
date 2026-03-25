import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type {
  EvidenceTransformStageKey,
  EvidenceTransformWorkflowInput,
  ProjectProcessStateInput,
  RunStageKey,
} from "@judge-gym/engine-settings/process";
import type { ModelType } from "@judge-gym/engine-settings/provider";
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

function assertRequiredProcessId(
  value: unknown,
  field: string,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

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
  model: ModelType;
  system_prompt: string;
  user_prompt: string;
  metadata_json: string | null;
};

type EvidenceTransformRunExecutionContext = {
  evidence_transform_run_id: string;
  evidence_set_id: string;
  source_record_kind: "source_text" | "paper_original";
  target_view_kinds: EvidenceTransformStageKey[];
  model: ModelType;
  prompt_version: string;
  status: string;
  workflow_id: string | null;
  workflow_run_id: string | null;
  current_stage: EvidenceTransformStageKey | null;
  total_count: number;
  completed_count: number;
  failed_count: number;
  last_error_message: string | null;
};

type EvidenceTransformStageInput = {
  evidence_set_item_id: string;
  evidence_item_id: string;
  model: ModelType;
  stage: EvidenceTransformStageKey;
  system_prompt: string;
  user_prompt: string;
  metadata_json: string | null;
};

type AttemptStartInput = {
  attempt_key?: string;
  process_kind: "run";
  process_id: string;
  target_type: "sample" | "sample_score_target";
  target_id: string;
  stage: string;
  provider: string;
  model: ModelType;
  operation_type: "chat" | "batch";
  workflow_id: string;
  system_prompt: string;
  user_prompt: string;
  metadata_json?: string | null;
};

type BatchExecutionInput = {
  batch_key: string;
  process_kind: "run";
  process_id: string;
  stage: string;
  provider: string;
  model: ModelType;
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
  process_kind: "run";
  process_id: string;
  stage: string;
  event_name?: string;
  payload_json?: string | null;
};

const workerApi = {
  getRunExecutionContext: makeFunctionReference<"query">(
    "packages/worker:getRunExecutionContext",
  ),
  bindRunWorkflow: makeFunctionReference<"mutation">(
    "packages/worker:bindRunWorkflow",
  ),
  getEvidenceTransformRunExecutionContext: makeFunctionReference<"query">(
    "packages/evidence_transform:getEvidenceTransformRunExecutionContext",
  ),
  markEvidenceTransformStageRunning: makeFunctionReference<"mutation">(
    "packages/evidence_transform:markEvidenceTransformStageRunning",
  ),
  listEvidenceTransformStageInputs: makeFunctionReference<"action">(
    "packages/evidence_transform:listEvidenceTransformStageInputs",
  ),
  applyEvidenceTransformStageResult: makeFunctionReference<"action">(
    "packages/evidence_transform:applyEvidenceTransformStageResult",
  ),
  markEvidenceTransformStageFailure: makeFunctionReference<"mutation">(
    "packages/evidence_transform:markEvidenceTransformStageFailure",
  ),
  finalizeEvidenceTransformStage: makeFunctionReference<"mutation">(
    "packages/evidence_transform:finalizeEvidenceTransformStage",
  ),
  markEvidenceTransformRunError: makeFunctionReference<"mutation">(
    "packages/evidence_transform:markEvidenceTransformRunError",
  ),
  projectProcessState: makeFunctionReference<"mutation">(
    "packages/worker:projectProcessState",
  ),
  listRunStageInputs: makeFunctionReference<"action">(
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
  recordBatchExecutionPreparationProgress: makeFunctionReference<"mutation">(
    "packages/worker:recordBatchExecutionPreparationProgress",
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
    assertRequiredProcessId(run_id, "run_id");
    return this.client.query(workerApi.getRunExecutionContext, {
      run_id,
    }) as Promise<RunExecutionContext>;
  }

  getEvidenceTransformRunExecutionContext(evidence_transform_run_id: string) {
    assertRequiredProcessId(evidence_transform_run_id, "evidence_transform_run_id");
    return this.client.query(workerApi.getEvidenceTransformRunExecutionContext, {
      evidence_transform_run_id,
    }) as Promise<EvidenceTransformRunExecutionContext>;
  }

  bindRunWorkflow(args: {
    run_id: string;
    workflow_id: string;
    workflow_run_id: string;
  }) {
    return this.client.mutation(workerApi.bindRunWorkflow, args);
  }

  projectProcessState<TStage extends string>(
    input: ProjectProcessStateInput<TStage>,
  ) {
    assertRequiredProcessId(input.processId, "processId");
    return this.client.mutation(workerApi.projectProcessState, input);
  }

  listRunStageInputs(args: {
    run_id: string;
    stage: RunStageKey;
  }) {
    return this.client.action(workerApi.listRunStageInputs, args) as Promise<
      RunStageInput[]
    >;
  }

  markEvidenceTransformStageRunning(args: {
    evidence_transform_run_id: string;
    stage: EvidenceTransformStageKey;
  }) {
    return this.client.mutation(workerApi.markEvidenceTransformStageRunning, args);
  }

  listEvidenceTransformStageInputs(args: {
    evidence_transform_run_id: string;
    stage: EvidenceTransformStageKey;
  }) {
    return this.client.action(workerApi.listEvidenceTransformStageInputs, args) as Promise<
      EvidenceTransformStageInput[]
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

  applyRunStageResult(args: {
    run_id: string;
    target_id: string;
    stage: RunStageKey;
    attempt_id: string;
    output: string;
  }) {
    return this.client.mutation(workerApi.applyRunStageResult, args);
  }

  applyEvidenceTransformStageResult(args: {
    evidence_transform_run_id: string;
    evidence_item_id: string;
    stage: EvidenceTransformStageKey;
    output: string;
  }) {
    return this.client.action(workerApi.applyEvidenceTransformStageResult, args);
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

  markEvidenceTransformStageFailure(args: {
    evidence_transform_run_id: string;
    evidence_item_id: string;
    stage: EvidenceTransformStageKey;
    error_message: string;
  }) {
    return this.client.mutation(workerApi.markEvidenceTransformStageFailure, args);
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

  finalizeEvidenceTransformStage(args: {
    evidence_transform_run_id: string;
    stage: EvidenceTransformStageKey;
  }) {
    return this.client.mutation(workerApi.finalizeEvidenceTransformStage, args) as Promise<{
      total: number;
      completed: number;
      failed: number;
      has_pending: boolean;
      halt_process: boolean;
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

  markEvidenceTransformRunError(args: {
    evidence_transform_run_id: string;
    stage: EvidenceTransformStageKey;
    error_message: string;
  }) {
    return this.client.mutation(workerApi.markEvidenceTransformRunError, args);
  }

  getBatchExecution(args: { batch_key: string }) {
    return this.client.query(workerApi.getBatchExecution, args) as Promise<{
      batch_execution_id: string;
      provider_batch_id: string | null;
      status: string;
      output_file_id?: string | null;
      error_file_id?: string | null;
      provider_artifacts_json?: string | null;
      attempt_recorded_count?: number | null;
      attempt_records_json?: string | null;
    } | null>;
  }

  ensureBatchExecution(args: BatchExecutionInput) {
    return this.client.mutation(workerApi.ensureBatchExecution, args) as Promise<{
      batch_execution_id: string;
      provider_batch_id: string | null;
      status: string;
      output_file_id?: string | null;
      error_file_id?: string | null;
      provider_artifacts_json?: string | null;
      attempt_recorded_count?: number | null;
      attempt_records_json?: string | null;
    }>;
  }

  recordBatchExecutionPreparationProgress(args: {
    batch_execution_id: string;
    attempt_recorded_count: number;
    attempt_records_json: string;
  }) {
    return this.client.mutation(workerApi.recordBatchExecutionPreparationProgress, args);
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
    provider_artifacts_json?: string | null;
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
