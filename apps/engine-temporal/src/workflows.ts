import {
  CancellationScope,
  condition,
  defineQuery,
  defineUpdate,
  isCancellation,
  proxyActivities,
  setHandler,
  workflowInfo,
} from "@temporalio/workflow";
import type {
  PauseNowInput,
  ProcessSnapshot,
  RepairBoundedInput,
  RepairBoundedResult,
  ResumeInput,
  RunStageKey,
  RunWorkflowInput,
  SetPauseAfterInput,
  WindowStageKey,
  WindowWorkflowInput,
} from "@judge-gym/engine-settings/process";
import type * as activities from "./activities";

const RUN_STAGES: RunStageKey[] = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
];
const WINDOW_STAGES: WindowStageKey[] = [
  "collect",
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
];

const {
  projectProcessState,
  runRunStage,
  runWindowStage,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
});

export const getProcessSnapshotQuery =
  defineQuery<ProcessSnapshot>("getProcessSnapshot");
export const setPauseAfterUpdate =
  defineUpdate<ProcessSnapshot, [SetPauseAfterInput]>("setPauseAfter");
export const pauseNowUpdate =
  defineUpdate<ProcessSnapshot, [PauseNowInput]>("pauseNow");
export const resumeUpdate =
  defineUpdate<ProcessSnapshot, [ResumeInput]>("resume");
export const repairBoundedUpdate =
  defineUpdate<RepairBoundedResult, [RepairBoundedInput]>("repairBounded");

async function projectSnapshot<TStage extends string>(
  snapshot: ProcessSnapshot<TStage>,
) {
  return projectProcessState(snapshot);
}

async function projectSnapshotNonCancellable<TStage extends string>(
  snapshot: ProcessSnapshot<TStage>,
) {
  return CancellationScope.nonCancellable(() => projectProcessState(snapshot));
}

async function runStageActivity<TStage extends string>(
  snapshot: ProcessSnapshot<TStage>,
  stage: TStage,
) {
  if (snapshot.processKind === "run") {
    return runRunStage({
      runId: snapshot.processId,
      stage: stage as RunStageKey,
    });
  }

  return runWindowStage({
    windowRunId: snapshot.processId,
    stage: stage as WindowStageKey,
  });
}

function buildInitialSnapshot<TStage extends string>(args: {
  processKind: "run" | "window";
  processId: string;
  workflowType: string;
  pauseAfter: TStage | null;
}): ProcessSnapshot<TStage> {
  const info = workflowInfo();
  return {
    processKind: args.processKind,
    processId: args.processId,
    workflowId: info.workflowId,
    workflowRunId: info.runId,
    workflowType: args.workflowType,
    executionStatus: "queued",
    stage: null,
    stageStatus: "pending",
    pauseAfter: args.pauseAfter,
    stageHistory: [],
    lastControlCommandId: null,
    lastErrorMessage: null,
  };
}

async function executeProcessWorkflow<TStage extends string>(args: {
  processKind: "run" | "window";
  processId: string;
  workflowType: string;
  stages: TStage[];
  pauseAfter: TStage | null;
}): Promise<ProcessSnapshot<TStage>> {
  const snapshot = buildInitialSnapshot(args);
  let paused = false;

  const awaitResume = async () => {
    if (!paused) return;
    snapshot.executionStatus = "paused";
    snapshot.stageStatus = "paused";
    await projectSnapshot(snapshot);
    await condition(() => !paused);
    snapshot.executionStatus = "running";
    snapshot.stageStatus = "pending";
    await projectSnapshot(snapshot);
  };

  setHandler(getProcessSnapshotQuery, () => snapshot);

  setHandler(setPauseAfterUpdate, async (input: SetPauseAfterInput) => {
    snapshot.pauseAfter = input.pauseAfter as TStage | null;
    snapshot.lastControlCommandId = input.cmdId;
    await projectSnapshot(snapshot);
    return snapshot;
  });

  setHandler(pauseNowUpdate, async (input: PauseNowInput) => {
    paused = true;
    snapshot.executionStatus = "paused";
    snapshot.stageStatus = "paused";
    snapshot.lastControlCommandId = input.cmdId;
    await projectSnapshot(snapshot);
    return snapshot;
  });

  setHandler(resumeUpdate, async (input: ResumeInput) => {
    paused = false;
    snapshot.lastControlCommandId = input.cmdId;
    if (snapshot.executionStatus === "paused") {
      snapshot.executionStatus = "running";
      if (snapshot.stage != null) {
        snapshot.stageStatus = "running";
      }
    }
    await projectSnapshot(snapshot);
    return snapshot;
  });

  setHandler(repairBoundedUpdate, async (input: RepairBoundedInput) => {
    snapshot.lastControlCommandId = input.cmdId;
    switch (input.operation) {
      case "reproject_snapshot":
        await projectSnapshot(snapshot);
        return {
          accepted: true,
          cmdId: input.cmdId,
          operation: input.operation,
        };
      case "resume_if_paused":
        if (!paused && snapshot.executionStatus !== "paused") {
          return {
            accepted: false,
            cmdId: input.cmdId,
            operation: input.operation,
            reason: "not_paused",
          };
        }
        paused = false;
        snapshot.executionStatus = "running";
        snapshot.stageStatus = snapshot.stage != null ? "running" : "pending";
        await projectSnapshot(snapshot);
        return {
          accepted: true,
          cmdId: input.cmdId,
          operation: input.operation,
        };
      case "clear_pause_after":
        snapshot.pauseAfter = null;
        await projectSnapshot(snapshot);
        return {
          accepted: true,
          cmdId: input.cmdId,
          operation: input.operation,
        };
    }
    return {
      accepted: false,
      cmdId: input.cmdId,
      operation: input.operation,
      reason: "repair_not_implemented",
    };
  });

  try {
    snapshot.executionStatus = "running";
    await projectSnapshot(snapshot);

    for (const stage of args.stages) {
      await awaitResume();

      snapshot.stage = stage;
      snapshot.stageStatus = "running";
      snapshot.executionStatus = paused ? "paused" : "running";
      await projectSnapshot(snapshot);

      const stageResult = await runStageActivity(snapshot, stage);

      snapshot.stageHistory = [...snapshot.stageHistory, stage];
      snapshot.stageStatus = "done";

      if (stageResult.errorMessage) {
        snapshot.lastErrorMessage = stageResult.errorMessage;
      }

      if (stageResult.haltProcess) {
        snapshot.executionStatus =
          stageResult.terminalExecutionStatus ?? "completed";
        await projectSnapshot(snapshot);
        return snapshot;
      }

      await projectSnapshot(snapshot);

      if (snapshot.pauseAfter === stage) {
        paused = true;
        await awaitResume();
      }
    }

    snapshot.executionStatus = "completed";
    snapshot.stageStatus = "done";
    await projectSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (isCancellation(error)) {
      snapshot.executionStatus = "canceled";
      snapshot.stageStatus =
        snapshot.stageStatus === "running" ? "paused" : snapshot.stageStatus;
      snapshot.lastErrorMessage = null;
      await projectSnapshotNonCancellable(snapshot);
      throw error;
    }
    snapshot.executionStatus = "failed";
    snapshot.stageStatus = "failed";
    snapshot.lastErrorMessage =
      error instanceof Error ? error.message : String(error);
    await projectSnapshot(snapshot);
    throw error;
  }
}

export async function runWorkflow(
  input: RunWorkflowInput,
): Promise<ProcessSnapshot<RunStageKey>> {
  return executeProcessWorkflow<RunStageKey>({
    processKind: "run",
    processId: input.runId,
    workflowType: "RunWorkflow",
    stages: RUN_STAGES,
    pauseAfter: input.pauseAfter ?? null,
  });
}

export async function windowWorkflow(
  input: WindowWorkflowInput,
): Promise<ProcessSnapshot<WindowStageKey>> {
  const terminalStage = input.targetStage ?? "l3_abstracted";
  const terminalStageIndex = WINDOW_STAGES.indexOf(terminalStage);
  return executeProcessWorkflow<WindowStageKey>({
    processKind: "window",
    processId: input.windowRunId,
    workflowType: "WindowWorkflow",
    stages:
      terminalStageIndex >= 0
        ? WINDOW_STAGES.slice(0, terminalStageIndex + 1)
        : WINDOW_STAGES,
    pauseAfter: input.pauseAfter ?? null,
  });
}
