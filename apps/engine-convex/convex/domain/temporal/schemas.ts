import z from "zod";

export const ProcessTypeSchema = z.enum(["run", "window"]);

export const ProcessSnapshotSchema = z.object({
  processKind: ProcessTypeSchema,
  processId: z.string().optional(),
  workflowId: z.string(),
  workflowRunId: z.string(),
  workflowType: z.string(),
  executionStatus: z.enum([
    "queued",
    "running",
    "paused",
    "completed",
    "failed",
    "canceled",
  ]),
  stage: z.string().nullable(),
  stageStatus: z.enum(["pending", "running", "paused", "done", "failed"]),
  pauseAfter: z.string().nullable(),
  stageHistory: z.array(z.string()),
  lastControlCommandId: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
});

export const ControlActionSchema = z.enum([
  "set_pause_after",
  "pause_now",
  "resume",
  "cancel",
  "repair_bounded",
]);

export const RepairBoundedOperationSchema = z.enum([
  "reproject_snapshot",
  "resume_if_paused",
  "clear_pause_after",
]);

export const TemporalTaskQueueKindSchema = z.enum(["run", "window"]);

export const TemporalTaskQueuePollerSchema = z.object({
  identity: z.string(),
  last_access_time_ms: z.number().nullable(),
});

export const TemporalTaskQueueHealthRowSchema = z.object({
  queue_kind: TemporalTaskQueueKindSchema,
  task_queue: z.string(),
  workflow_poller_count: z.number(),
  activity_poller_count: z.number(),
  workflow_pollers: z.array(TemporalTaskQueuePollerSchema),
  activity_pollers: z.array(TemporalTaskQueuePollerSchema),
  approximate_backlog_count: z.number().nullable(),
  approximate_backlog_age_ms: z.number().nullable(),
  tasks_add_rate: z.number().nullable(),
  tasks_dispatch_rate: z.number().nullable(),
  ready: z.boolean(),
});

export const TemporalTaskQueueHealthSchema = z.object({
  namespace: z.string(),
  checked_at_ms: z.number(),
  all_ready: z.boolean(),
  queues: z.array(TemporalTaskQueueHealthRowSchema),
});
