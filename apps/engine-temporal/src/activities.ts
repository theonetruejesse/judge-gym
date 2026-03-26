import type {
  EvidenceAcquisitionWorkflowInput,
  EvidenceTransformStageKey,
  ProjectProcessStateInput,
  RunStageKey,
  StageActivityResult,
} from "@judge-gym/engine-settings/process";
import { getConvexWorkerClient } from "./convex/client";
import { runEvidenceAcquisitionCycleActivity } from "./evidence_acquisition/service";
import { runEvidenceTransformStageActivity } from "./evidence_transform/service";
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

export async function runEvidenceTransformStage(
  input: {
    evidenceTransformRunId: string;
    stage: EvidenceTransformStageKey;
  },
): Promise<StageActivityResult<EvidenceTransformStageKey>> {
  assertRequiredProcessId(input.evidenceTransformRunId, "processId");
  return runEvidenceTransformStageActivity(input.evidenceTransformRunId, input.stage);
}

export async function runEvidenceAcquisitionCycle(
  input: EvidenceAcquisitionWorkflowInput,
) {
  assertRequiredProcessId(input.acquisitionRunId, "processId");
  return runEvidenceAcquisitionCycleActivity(input.acquisitionRunId);
}
