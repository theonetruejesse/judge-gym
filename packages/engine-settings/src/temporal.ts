export const TEMPORAL_WORKFLOW_TYPES = {
  run: "RunWorkflow",
  evidence_transform: "EvidenceTransformWorkflow",
} as const;

export const TEMPORAL_TASK_QUEUES = {
  run: "judge-gym.run",
} as const;

export const TEMPORAL_CONTROL_HANDLERS = {
  querySnapshot: "getProcessSnapshot",
  setPauseAfter: "setPauseAfter",
  pauseNow: "pauseNow",
  resume: "resume",
  repairBounded: "repairBounded",
} as const;
