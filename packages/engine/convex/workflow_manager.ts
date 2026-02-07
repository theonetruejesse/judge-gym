import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 25,
    defaultRetryBehavior: {
      maxAttempts: 5,
      initialBackoffMs: 100,
      base: 1.5,
    },
    retryActionsByDefault: true,
  },
});
