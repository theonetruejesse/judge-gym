import type {
  ProjectProcessStateInput,
  RunStageKey,
  StageActivityResult,
  WindowStageKey,
} from "@judge-gym/engine-settings/process";
import { getConvexWorkerClient } from "./convex/client";
import { runRunStageActivity } from "./run/service";
import { runWindowStageActivity } from "./window/service";

function assertRequiredProcessId(
  value: unknown,
  field: "runId" | "windowRunId" | "processId",
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

export async function projectProcessState<TStage extends string>(
  input: ProjectProcessStateInput<TStage>,
): Promise<ProjectProcessStateInput<TStage>> {
  assertRequiredProcessId(input.processId, "processId");
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
  assertRequiredProcessId(input.runId, "runId");
  return runRunStageActivity(input.runId, input.stage);
}

export async function runWindowStage(
  input: {
    windowRunId: string;
    stage: WindowStageKey;
  },
): Promise<StageActivityResult<WindowStageKey>> {
  assertRequiredProcessId(input.windowRunId, "windowRunId");
  return runWindowStageActivity(input.windowRunId, input.stage);
}
