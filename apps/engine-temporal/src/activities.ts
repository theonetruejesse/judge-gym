import type {
  ProjectProcessStateInput,
  RunStageKey,
  StageActivityResult,
  WindowStageKey,
} from "@judge-gym/engine-settings/process";
import { getConvexWorkerClient } from "./convex/client";
import { runRunStageActivity } from "./run/service";
import { runWindowStageActivity } from "./window/service";

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
  return runRunStageActivity(input.runId, input.stage);
}

export async function runWindowStage(
  input: {
    windowRunId: string;
    stage: WindowStageKey;
  },
): Promise<StageActivityResult<WindowStageKey>> {
  return runWindowStageActivity(input.windowRunId, input.stage);
}
