export const PROCESS_KINDS = ["run", "window"] as const;
export type ProcessKind = (typeof PROCESS_KINDS)[number];

export const RUN_STAGE_KEYS = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
] as const;
export type RunStageKey = (typeof RUN_STAGE_KEYS)[number];

export const WINDOW_STAGE_KEYS = [
  "collect",
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
] as const;
export type WindowStageKey = (typeof WINDOW_STAGE_KEYS)[number];

export type ProcessStageKey = RunStageKey | WindowStageKey;

export const PROCESS_STAGE_STATUSES = [
  "pending",
  "running",
  "paused",
  "done",
  "failed",
] as const;
export type ProcessStageStatus = (typeof PROCESS_STAGE_STATUSES)[number];

export const PROCESS_EXECUTION_STATUSES = [
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "canceled",
] as const;
export type ProcessExecutionStatus =
  (typeof PROCESS_EXECUTION_STATUSES)[number];

export const CONTROL_ACTIONS = [
  "set_pause_after",
  "pause_now",
  "resume",
  "cancel",
  "repair_bounded",
] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export const CONTROL_ISSUERS = ["user", "agent", "system"] as const;
export type ControlIssuer = (typeof CONTROL_ISSUERS)[number];

export const TEMPORAL_WORKFLOW_TYPES = {
  run: "RunWorkflow",
  window: "WindowWorkflow",
} as const;

export const TEMPORAL_TASK_QUEUES = {
  run: "judge-gym.run",
  window: "judge-gym.window",
} as const;

export const QUOTA_DIMENSIONS = [
  "requests",
  "input_tokens",
  "output_tokens",
  "total_tokens",
  "batch_enqueued_input_tokens",
] as const;
export type QuotaDimension = (typeof QUOTA_DIMENSIONS)[number];

export const TEMPORAL_CONTROL_HANDLERS = {
  querySnapshot: "getProcessSnapshot",
  setPauseAfter: "setPauseAfter",
  pauseNow: "pauseNow",
  resume: "resume",
  repairBounded: "repairBounded",
} as const;

export const WORKER_AUTH_HEADER = "x-judge-gym-worker-secret";

export const ENGINE_ENV_KEYS = {
  convexUrl: "CONVEX_URL",
  workerSecretActive: "CONVEX_WORKER_SECRET_ACTIVE",
  upstashUrl: "UPSTASH_REDIS_REST_URL",
  upstashToken: "UPSTASH_REDIS_REST_TOKEN",
  upstashKeyPrefix: "UPSTASH_KEY_PREFIX",
  temporalAddress: "TEMPORAL_ADDRESS",
  temporalNamespace: "TEMPORAL_NAMESPACE",
  temporalRetryDelayMs: "TEMPORAL_RETRY_DELAY_MS",
  temporalTaskQueue: "TEMPORAL_TASK_QUEUE",
  temporalRunTaskQueue: "TEMPORAL_RUN_TASK_QUEUE",
  temporalWindowTaskQueue: "TEMPORAL_WINDOW_TASK_QUEUE",
  temporalTestServerMode: "TEMPORAL_TEST_SERVER_MODE",
  temporalTestServerDownloadDir: "TEMPORAL_TEST_SERVER_DOWNLOAD_DIR",
  temporalTestServerExecutable: "TEMPORAL_TEST_SERVER_EXECUTABLE",
  openaiApiKey: "OPENAI_API_KEY",
  anthropicApiKey: "ANTHROPIC_API_KEY",
  googleGenerativeAiApiKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  firecrawlApiKey: "FIRECRAWL_API_KEY",
  axiomDataset: "AXIOM_DATASET",
  axiomToken: "AXIOM_TOKEN",
} as const;

export interface ControlCommand<
  TAction extends ControlAction = ControlAction,
  TPayload = Record<string, unknown>,
> {
  cmdId: string;
  action: TAction;
  processKind: ProcessKind;
  processId: string;
  workflowId: string;
  issuedBy: ControlIssuer;
  issuedAt: number;
  payload: TPayload;
}

export interface ProcessSnapshot<TStage extends string = string> {
  processKind: ProcessKind;
  processId: string;
  workflowId: string;
  workflowRunId: string;
  workflowType: string;
  executionStatus: ProcessExecutionStatus;
  stage: TStage | null;
  stageStatus: ProcessStageStatus;
  pauseAfter: TStage | null;
  stageHistory: TStage[];
  lastControlCommandId: string | null;
  lastErrorMessage: string | null;
}

export interface StageActivityResult<TStage extends string = string> {
  processKind: ProcessKind;
  processId: string;
  stage: TStage;
  summary: string;
}

export interface ProjectProcessStateInput<TStage extends string = string>
  extends ProcessSnapshot<TStage> {}

export interface RunWorkflowInput {
  runId: string;
  pauseAfter?: RunStageKey | null;
}

export interface WindowWorkflowInput {
  windowId: string;
  pauseAfter?: WindowStageKey | null;
}

export interface SetPauseAfterInput<TStage extends string = string> {
  cmdId: string;
  pauseAfter: TStage | null;
}

export interface PauseNowInput {
  cmdId: string;
}

export interface ResumeInput {
  cmdId: string;
}

export interface RepairBoundedInput {
  cmdId: string;
  operation: string;
  note?: string;
}

export interface RepairBoundedResult {
  accepted: boolean;
  cmdId: string;
  operation: string;
  reason?: string;
}

export interface QuotaDimensions {
  requests?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  batch_enqueued_input_tokens?: number;
}

export interface QuotaReservationInput {
  reservationId: string;
  provider: string;
  model?: string;
  operationType: string;
  scopeKey: string;
  dimensions: QuotaDimensions;
  processKind?: ProcessKind;
  processId?: string;
  workflowId?: string;
}

export interface QuotaReservationResult {
  allowed: boolean;
  reservationId: string;
  bucketKeys: string[];
  dimensions: QuotaDimensions;
  reason?: string;
}

export interface QuotaSettlementInput {
  reservationId: string;
  provider: string;
  model?: string;
  operationType: string;
  scopeKey: string;
  reserved: QuotaDimensions;
  observed?: QuotaDimensions;
  status: "applied" | "refunded" | "failed";
}
