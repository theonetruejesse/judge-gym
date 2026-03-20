"use node";

import z from "zod";
import { Client, Connection } from "@temporalio/client";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils/custom_fns";

function getTemporalConfig() {
  const tlsEnabled = process.env.TEMPORAL_TLS_ENABLED === "1";
  const tlsServerName = process.env.TEMPORAL_TLS_SERVER_NAME ?? undefined;
  return {
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    tls: tlsEnabled
      ? {
          ...(tlsServerName ? { serverNameOverride: tlsServerName } : {}),
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

export async function startWindowWorkflowExecution(args: {
  window_id: string;
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
      args: [{ windowId: args.window_id }],
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

export async function resumeRunWorkflowExecution(args: {
  run_id: string;
  pause_after?: "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic" | null;
}) {
  return withTemporalClient(async (client) => {
    const handle = client.workflow.getHandle(`run:${args.run_id}`);
    if (args.pause_after !== undefined) {
      await handle.executeUpdate("setPauseAfter", {
        args: [{
          cmdId: `cmd:set-pause-after:${Date.now()}`,
          pauseAfter: args.pause_after ?? null,
        }],
      });
    }
    return handle.executeUpdate("resume", {
      args: [{
        cmdId: `cmd:resume:${Date.now()}`,
      }],
    });
  });
}

export async function resumeWindowWorkflowExecution(args: {
  window_id: string;
}) {
  return withTemporalClient(async (client) => {
    const handle = client.workflow.getHandle(`window:${args.window_id}`);
    return handle.executeUpdate("resume", {
      args: [{
        cmdId: `cmd:resume:${Date.now()}`,
      }],
    });
  });
}

export const startWindowWorkflow = zInternalAction({
  args: z.object({
    window_id: zid("windows"),
  }),
  returns: z.object({
    workflow_id: z.string(),
    workflow_run_id: z.string(),
  }),
  handler: async (_ctx, args) => {
    return startWindowWorkflowExecution({
      window_id: String(args.window_id),
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
  }),
  returns: z.any(),
  handler: async (_ctx, args) => {
    return resumeWindowWorkflowExecution({
      window_id: String(args.window_id),
    });
  },
});
