import type {
  ProjectProcessStateInput,
  RunStageKey,
  StageActivityResult,
  WindowStageKey,
} from "@judge-gym/engine-settings";
import { getConvexWorkerClient } from "./convex/client";
import { runWindowStageActivity } from "./window/service";

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
  await getConvexWorkerClient().projectProcessState(input);
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
  return runWindowStageActivity(input.windowId, input.stage);
}
