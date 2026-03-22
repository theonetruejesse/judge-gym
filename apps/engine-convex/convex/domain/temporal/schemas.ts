import z from "zod";
import {
  ControlActionSchema,
  ProcessKindSchema,
  ProcessSnapshotSchema,
  RepairBoundedOperationSchema,
} from "@judge-gym/engine-settings/process";

export {
  ControlActionSchema,
  ProcessSnapshotSchema,
  RepairBoundedOperationSchema,
};

export const ProcessTypeSchema = ProcessKindSchema;

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
