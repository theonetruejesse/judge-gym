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

export const REPAIR_BOUNDED_OPERATIONS = [
  "reproject_snapshot",
  "resume_if_paused",
  "clear_pause_after",
] as const;
export type RepairBoundedOperation =
  (typeof REPAIR_BOUNDED_OPERATIONS)[number];

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
  haltProcess?: boolean;
  terminalExecutionStatus?: Extract<
    ProcessExecutionStatus,
    "completed" | "failed" | "canceled"
  >;
  errorMessage?: string | null;
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
  operation: RepairBoundedOperation;
  note?: string;
}

export interface RepairBoundedResult {
  accepted: boolean;
  cmdId: string;
  operation: string;
  reason?: string;
}
