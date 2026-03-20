import type {
  ProjectProcessStateInput,
  RunStageKey,
  StageActivityResult,
  WindowStageKey,
} from "@judge-gym/engine-settings";

function buildStageSummary(
  processKind: "run" | "window",
  processId: string,
  stage: string,
) {
  return `${processKind}:${processId}:${stage}`;
}

export async function projectProcessState<TStage extends string>(
  input: ProjectProcessStateInput<TStage>,
): Promise<ProjectProcessStateInput<TStage>> {
  return {
    ...input,
  };
}

export async function runRunStage(
  input: {
    runId: string;
    stage: RunStageKey;
  },
): Promise<StageActivityResult<RunStageKey>> {
  return {
    processKind: "run",
    processId: input.runId,
    stage: input.stage,
    summary: buildStageSummary("run", input.runId, input.stage),
  };
}

export async function runWindowStage(
  input: {
    windowId: string;
    stage: WindowStageKey;
  },
): Promise<StageActivityResult<WindowStageKey>> {
  return {
    processKind: "window",
    processId: input.windowId,
    stage: input.stage,
    summary: buildStageSummary("window", input.windowId, input.stage),
  };
}
