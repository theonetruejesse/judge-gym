import type {
  ProjectProcessStateInput,
  RunStageKey,
  StageActivityResult,
} from "@judge-gym/engine-settings/process";
import { getConvexWorkerClient } from "./convex/client";
import { runRunStageActivity } from "./run/service";

function assertRequiredProcessId(
  value: unknown,
  field: "runId" | "processId",
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
