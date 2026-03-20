"use node";

import z from "zod";
import { Client, Connection } from "@temporalio/client";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils/custom_fns";
import { rootCertificates } from "node:tls";

const ProcessTypeSchema = z.enum(["run", "window"]);
const ProcessSnapshotSchema = z.object({
  processKind: z.enum(["run", "window"]),
  processId: z.string(),
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
const RunPauseAfterSchema = z.enum([
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
]);
const WindowPauseAfterSchema = z.enum([
  "collect",
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
]);
const ControlActionSchema = z.enum([
  "set_pause_after",
  "pause_now",
  "resume",
  "cancel",
  "repair_bounded",
]);
const RepairBoundedOperationSchema = z.enum([
  "reproject_snapshot",
  "resume_if_paused",
  "clear_pause_after",
]);
const TemporalTaskQueueKindSchema = z.enum(["run", "window"]);
const TemporalTaskQueuePollerSchema = z.object({
  identity: z.string(),
  last_access_time_ms: z.number().nullable(),
});
const TemporalTaskQueueHealthRowSchema = z.object({
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
const TemporalTaskQueueHealthSchema = z.object({
  namespace: z.string(),
  checked_at_ms: z.number(),
  all_ready: z.boolean(),
  queues: z.array(TemporalTaskQueueHealthRowSchema),
});
const TemporalWorkflowInspectionSchema = z.object({
  process_type: ProcessTypeSchema,
  process_id: z.string(),
  workflow_id: z.string(),
  workflow_found: z.boolean(),
  workflow_run_id: z.string().nullable(),
  workflow_type: z.string().nullable(),
  task_queue: z.string().nullable(),
  temporal_status: z.string().nullable(),
  history_length: z.number().nullable(),
  start_time_ms: z.number().nullable(),
  execution_time_ms: z.number().nullable(),
  close_time_ms: z.number().nullable(),
  snapshot: ProcessSnapshotSchema.nullable(),
  snapshot_query_error: z.string().nullable(),
});
const ControlProcessWorkflowResultSchema = z.object({
  process_type: ProcessTypeSchema,
  process_id: z.string(),
  action: ControlActionSchema,
  cmd_id: z.string(),
  accepted: z.boolean(),
  reason: z.string().nullable(),
  workflow_id: z.string(),
  temporal_status: z.string().nullable(),
  snapshot: ProcessSnapshotSchema.nullable(),
  repair_result: z.object({
    accepted: z.boolean(),
    cmdId: z.string(),
    operation: RepairBoundedOperationSchema,
    reason: z.string().optional(),
  }).nullable(),
});

function getTemporalConfig() {
  const tlsEnabled = process.env.TEMPORAL_TLS_ENABLED === "1";
  const tlsServerName = process.env.TEMPORAL_TLS_SERVER_NAME ?? undefined;
  return {
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    tls: tlsEnabled
      ? {
          ...(tlsServerName ? { serverNameOverride: tlsServerName } : {}),
          ...(rootCertificates.length > 0
            ? {
                serverRootCACertificate: Buffer.from(
                  rootCertificates.join("\n"),
                ),
              }
            : {}),
        }
      : undefined,
    taskQueues: {
      run:
        process.env.TEMPORAL_RUN_TASK_QUEUE ?? "judge-gym.run",
      window:
        process.env.TEMPORAL_WINDOW_TASK_QUEUE ?? "judge-gym.window",
    },
  };
}

function buildCmdId(
  action: z.infer<typeof ControlActionSchema>,
  process_kind: z.infer<typeof ProcessTypeSchema>,
  process_id: string,
) {
  return `cmd:${action}:${process_kind}:${process_id}:${Date.now()}`;
}

function workflowIdForProcess(
  process_kind: z.infer<typeof ProcessTypeSchema>,
  process_id: string,
) {
  return `${process_kind}:${process_id}`;
}

function toMillisFromTimestamp(
  value: { seconds?: unknown; nanos?: number | null } | null | undefined,
) {
  if (!value) return null;
  const seconds = toNumber(value.seconds);
  const nanos = value.nanos ?? 0;
  if (seconds == null && nanos === 0) return null;
  return Math.max(
    0,
    Math.round((seconds ?? 0) * 1000 + nanos / 1_000_000),
  );
}

function toMillisFromDuration(
  value: { seconds?: unknown; nanos?: number | null } | null | undefined,
) {
  return toMillisFromTimestamp(value);
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value !== null) {
    const candidate = value as { toNumber?: () => number };
    if (typeof candidate.toNumber === "function") {
      const parsed = candidate.toNumber();
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function normalizePollers(
  pollers: Array<{
    identity?: string | null;
    lastAccessTime?: { seconds?: unknown; nanos?: number | null } | null;
  }> | null | undefined,
) {
  return (pollers ?? []).map((poller) => ({
    identity: poller.identity ?? "unknown",
    last_access_time_ms: toMillisFromTimestamp(poller.lastAccessTime),
  }));
}

async function describeTaskQueue(
  connection: Connection,
  args: {
    namespace: string;
    taskQueue: string;
    taskQueueType: 1 | 2;
  },
) {
  return connection.workflowService.describeTaskQueue({
    namespace: args.namespace,
    taskQueue: { name: args.taskQueue },
    taskQueueType: args.taskQueueType,
    reportPollers: true,
    reportStats: true,
  });
}

function isWorkflowNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|execution not found|workflow.*not found/i.test(message);
}

async function safeDescribe(handle: ReturnType<Client["workflow"]["getHandle"]>) {
  try {
    return await handle.describe();
  } catch (error) {
    if (isWorkflowNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function safeQuerySnapshot(handle: ReturnType<Client["workflow"]["getHandle"]>) {
  try {
    return {
      snapshot: await handle.query("getProcessSnapshot") as z.infer<typeof ProcessSnapshotSchema>,
      snapshot_query_error: null,
    };
  } catch (error) {
    return {
      snapshot: null,
      snapshot_query_error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function startWindowWorkflowExecution(args: {
  window_id: string;
  pause_after?: z.infer<typeof WindowPauseAfterSchema> | null;
}) {
  const config = getTemporalConfig();
  const connection = await Connection.connect({
    address: config.address,
    tls: config.tls,
  });

  try {
    const client = new Client({
      connection,
      namespace: config.namespace,
    });

    const handle = await client.workflow.start("windowWorkflow", {
      args: [{
        windowId: args.window_id,
        pauseAfter: args.pause_after ?? null,
      }],
      taskQueue: config.taskQueues.window,
      workflowId: `window:${args.window_id}`,
    });

    return {
      workflow_id: handle.workflowId,
      workflow_run_id: handle.firstExecutionRunId,
    };
  } finally {
    await connection.close();
  }
}

export async function startRunWorkflowExecution(args: {
  run_id: string;
  pause_after?: "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic" | null;
}) {
  const config = getTemporalConfig();
  const connection = await Connection.connect({
    address: config.address,
    tls: config.tls,
  });

  try {
    const client = new Client({
      connection,
      namespace: config.namespace,
    });

    const handle = await client.workflow.start("runWorkflow", {
      args: [{
        runId: args.run_id,
        pauseAfter: args.pause_after ?? null,
      }],
      taskQueue: config.taskQueues.run,
      workflowId: `run:${args.run_id}`,
    });

    return {
      workflow_id: handle.workflowId,
      workflow_run_id: handle.firstExecutionRunId,
    };
  } finally {
    await connection.close();
  }
}

async function withTemporalClient<T>(
  fn: (client: Client) => Promise<T>,
) {
  const config = getTemporalConfig();
  const connection = await Connection.connect({
    address: config.address,
    tls: config.tls,
  });

  try {
    const client = new Client({
      connection,
      namespace: config.namespace,
    });
    return await fn(client);
  } finally {
    await connection.close();
  }
}

export async function inspectProcessWorkflowExecution(args: {
  process_type: z.infer<typeof ProcessTypeSchema>;
  process_id: string;
}) {
  return withTemporalClient(async (client) => {
    const workflow_id = workflowIdForProcess(args.process_type, args.process_id);
    const handle = client.workflow.getHandle(workflow_id);
    const description = await safeDescribe(handle);
    if (!description) {
      return {
        process_type: args.process_type,
        process_id: args.process_id,
        workflow_id,
        workflow_found: false,
        workflow_run_id: null,
        workflow_type: null,
        task_queue: null,
        temporal_status: null,
        history_length: null,
        start_time_ms: null,
        execution_time_ms: null,
        close_time_ms: null,
        snapshot: null,
        snapshot_query_error: null,
      };
    }

    const queried = await safeQuerySnapshot(handle);
    return {
      process_type: args.process_type,
      process_id: args.process_id,
      workflow_id,
      workflow_found: true,
      workflow_run_id: description.runId,
      workflow_type: description.type,
      task_queue: description.taskQueue,
      temporal_status: description.status.name,
      history_length: description.historyLength,
      start_time_ms: description.startTime.getTime(),
      execution_time_ms: description.executionTime?.getTime() ?? null,
      close_time_ms: description.closeTime?.getTime() ?? null,
      snapshot: queried.snapshot,
      snapshot_query_error: queried.snapshot_query_error,
    };
  });
}

export async function inspectTemporalTaskQueuesExecution(args?: {
  queue_kinds?: Array<z.infer<typeof TemporalTaskQueueKindSchema>>;
}) {
  const config = getTemporalConfig();
  const connection = await Connection.connect({
    address: config.address,
    tls: config.tls,
  });

  try {
    const requestedQueueKinds = args?.queue_kinds?.length
      ? args.queue_kinds
      : ["run", "window"] as Array<z.infer<typeof TemporalTaskQueueKindSchema>>;
    const checked_at_ms = Date.now();
    const queues = await Promise.all(requestedQueueKinds.map(async (queue_kind) => {
      const task_queue = config.taskQueues[queue_kind];
      const [workflowInfo, activityInfo] = await Promise.all([
        describeTaskQueue(connection, {
          namespace: config.namespace,
          taskQueue: task_queue,
          taskQueueType: 1,
        }),
        describeTaskQueue(connection, {
          namespace: config.namespace,
          taskQueue: task_queue,
          taskQueueType: 2,
        }),
      ]);

      const workflow_pollers = normalizePollers(workflowInfo.pollers);
      const activity_pollers = normalizePollers(activityInfo.pollers);
      const stats = workflowInfo.stats ?? activityInfo.stats ?? null;
      const workflow_poller_count = workflow_pollers.length;
      const activity_poller_count = activity_pollers.length;

      return {
        queue_kind,
        task_queue,
        workflow_poller_count,
        activity_poller_count,
        workflow_pollers,
        activity_pollers,
        approximate_backlog_count: toNumber(stats?.approximateBacklogCount),
        approximate_backlog_age_ms: toMillisFromDuration(
          stats?.approximateBacklogAge,
        ),
        tasks_add_rate: stats?.tasksAddRate ?? null,
        tasks_dispatch_rate: stats?.tasksDispatchRate ?? null,
        ready: workflow_poller_count > 0 && activity_poller_count > 0,
      };
    }));

    return {
      namespace: config.namespace,
      checked_at_ms,
      all_ready: queues.every((queue) => queue.ready),
      queues,
    };
  } finally {
    await connection.close();
  }
}

export async function controlProcessWorkflowExecution(args: {
  process_type: z.infer<typeof ProcessTypeSchema>;
  process_id: string;
  action: z.infer<typeof ControlActionSchema>;
  cmd_id?: string;
  pause_after?: string | null;
  operation?: z.infer<typeof RepairBoundedOperationSchema>;
  note?: string;
}) {
  return withTemporalClient(async (client) => {
    const workflow_id = workflowIdForProcess(args.process_type, args.process_id);
    const handle = client.workflow.getHandle(workflow_id);
    const cmd_id = args.cmd_id ?? buildCmdId(args.action, args.process_type, args.process_id);

    try {
      let snapshot: z.infer<typeof ProcessSnapshotSchema> | null = null;
      let repair_result: z.infer<typeof ControlProcessWorkflowResultSchema.shape.repair_result> = null;

      switch (args.action) {
        case "set_pause_after":
          snapshot = await handle.executeUpdate("setPauseAfter", {
            args: [{
              cmdId: cmd_id,
              pauseAfter: args.pause_after ?? null,
            }],
          }) as z.infer<typeof ProcessSnapshotSchema>;
          break;
        case "pause_now":
          snapshot = await handle.executeUpdate("pauseNow", {
            args: [{ cmdId: cmd_id }],
          }) as z.infer<typeof ProcessSnapshotSchema>;
          break;
        case "resume":
          snapshot = await handle.executeUpdate("resume", {
            args: [{ cmdId: cmd_id }],
          }) as z.infer<typeof ProcessSnapshotSchema>;
          break;
        case "cancel":
          await handle.cancel();
          break;
        case "repair_bounded":
          repair_result = await handle.executeUpdate("repairBounded", {
            args: [{
              cmdId: cmd_id,
              operation: args.operation ?? "reproject_snapshot",
              note: args.note,
            }],
          }) as z.infer<typeof ControlProcessWorkflowResultSchema.shape.repair_result>;
          break;
      }

      const description = await safeDescribe(handle);
      const queried = snapshot == null ? await safeQuerySnapshot(handle) : null;
      return {
        process_type: args.process_type,
        process_id: args.process_id,
        action: args.action,
        cmd_id,
        accepted: repair_result?.accepted ?? true,
        reason: repair_result?.reason ?? queried?.snapshot_query_error ?? null,
        workflow_id,
        temporal_status: description?.status.name ?? null,
        snapshot: snapshot ?? queried?.snapshot ?? null,
        repair_result,
      };
    } catch (error) {
      if (isWorkflowNotFoundError(error)) {
        return {
          process_type: args.process_type,
          process_id: args.process_id,
          action: args.action,
          cmd_id,
          accepted: false,
          reason: "workflow_not_found",
          workflow_id,
          temporal_status: null,
          snapshot: null,
          repair_result: null,
        };
      }
      throw error;
    }
  });
}

export async function resumeRunWorkflowExecution(args: {
  run_id: string;
  pause_after?: "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic" | null;
  cmd_id?: string;
}) {
  return withTemporalClient(async (client) => {
    const handle = client.workflow.getHandle(`run:${args.run_id}`);
    const cmd_id = args.cmd_id ?? buildCmdId("resume", "run", args.run_id);
    if (args.pause_after !== undefined) {
      await handle.executeUpdate("setPauseAfter", {
        args: [{
          cmdId: buildCmdId("set_pause_after", "run", args.run_id),
          pauseAfter: args.pause_after ?? null,
        }],
      });
    }
    return handle.executeUpdate("resume", {
      args: [{
        cmdId: cmd_id,
      }],
    });
  });
}

export async function resumeWindowWorkflowExecution(args: {
  window_id: string;
  pause_after?: z.infer<typeof WindowPauseAfterSchema> | null;
  cmd_id?: string;
}) {
  return withTemporalClient(async (client) => {
    const handle = client.workflow.getHandle(`window:${args.window_id}`);
    const cmd_id = args.cmd_id ?? buildCmdId("resume", "window", args.window_id);
    if (args.pause_after !== undefined) {
      await handle.executeUpdate("setPauseAfter", {
        args: [{
          cmdId: buildCmdId("set_pause_after", "window", args.window_id),
          pauseAfter: args.pause_after ?? null,
        }],
      });
    }
    return handle.executeUpdate("resume", {
      args: [{
        cmdId: cmd_id,
      }],
    });
  });
}

export const startWindowWorkflow = zInternalAction({
  args: z.object({
    window_id: zid("windows"),
    pause_after: WindowPauseAfterSchema.nullable().optional(),
  }),
  returns: z.object({
    workflow_id: z.string(),
    workflow_run_id: z.string(),
  }),
  handler: async (_ctx, args) => {
    return startWindowWorkflowExecution({
      window_id: String(args.window_id),
      pause_after: args.pause_after ?? null,
    });
  },
});

export const startRunWorkflow = zInternalAction({
  args: z.object({
    run_id: zid("runs"),
    pause_after: z.enum(["rubric_gen", "rubric_critic", "score_gen", "score_critic"]).nullable().optional(),
  }),
  returns: z.object({
    workflow_id: z.string(),
    workflow_run_id: z.string(),
  }),
  handler: async (_ctx, args) => {
    return startRunWorkflowExecution({
      run_id: String(args.run_id),
      pause_after: args.pause_after ?? null,
    });
  },
});

export const resumeRunWorkflow = zInternalAction({
  args: z.object({
    run_id: zid("runs"),
    pause_after: z.enum(["rubric_gen", "rubric_critic", "score_gen", "score_critic"]).nullable().optional(),
  }),
  returns: z.any(),
  handler: async (_ctx, args) => {
    return resumeRunWorkflowExecution({
      run_id: String(args.run_id),
      pause_after: args.pause_after,
    });
  },
});

export const resumeWindowWorkflow = zInternalAction({
  args: z.object({
    window_id: zid("windows"),
    pause_after: WindowPauseAfterSchema.nullable().optional(),
    cmd_id: z.string().optional(),
  }),
  returns: z.any(),
  handler: async (_ctx, args) => {
    return resumeWindowWorkflowExecution({
      window_id: String(args.window_id),
      pause_after: args.pause_after,
      cmd_id: args.cmd_id,
    });
  },
});

export const inspectProcessWorkflow = zInternalAction({
  args: z.object({
    process_type: ProcessTypeSchema,
    process_id: z.string(),
  }),
  returns: TemporalWorkflowInspectionSchema,
  handler: async (_ctx, args) => {
    return inspectProcessWorkflowExecution(args);
  },
});

export const inspectTemporalTaskQueues = zInternalAction({
  args: z.object({
    queue_kinds: z.array(TemporalTaskQueueKindSchema).optional(),
  }),
  returns: TemporalTaskQueueHealthSchema,
  handler: async (_ctx, args) => {
    return inspectTemporalTaskQueuesExecution(args);
  },
});

export const controlProcessWorkflow = zInternalAction({
  args: z.object({
    process_type: ProcessTypeSchema,
    process_id: z.string(),
    action: ControlActionSchema,
    cmd_id: z.string().optional(),
    pause_after: z.string().nullable().optional(),
    operation: RepairBoundedOperationSchema.optional(),
    note: z.string().optional(),
  }),
  returns: ControlProcessWorkflowResultSchema,
  handler: async (_ctx, args) => {
    return controlProcessWorkflowExecution(args);
  },
});
