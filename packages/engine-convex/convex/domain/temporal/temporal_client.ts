"use node";

import z from "zod";
import { Client, Connection } from "@temporalio/client";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils/custom_fns";

function getTemporalConfig() {
  return {
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    taskQueues: {
      run:
        process.env.TEMPORAL_RUN_TASK_QUEUE ??
        process.env.TEMPORAL_TASK_QUEUE ??
        "judge-gym.run",
      window:
        process.env.TEMPORAL_WINDOW_TASK_QUEUE ??
        process.env.TEMPORAL_TASK_QUEUE ??
        "judge-gym.window",
    },
  };
}

export async function startWindowWorkflowExecution(args: {
  window_id: string;
}) {
  const config = getTemporalConfig();
  const connection = await Connection.connect({
    address: config.address,
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
