import { TestWorkflowEnvironment } from "@temporalio/testing";
import { createTemporalTestWorkflowEnvironment } from "../testing";

let sharedEnvPromise: Promise<TestWorkflowEnvironment> | null = null;
let refCount = 0;

export async function acquireSharedTestWorkflowEnvironment() {
  if (!sharedEnvPromise) {
    sharedEnvPromise = createTemporalTestWorkflowEnvironment().catch((error) => {
      sharedEnvPromise = null;
      throw error;
    });
  }

  refCount += 1;
  return sharedEnvPromise;
}

export async function releaseSharedTestWorkflowEnvironment() {
  if (!sharedEnvPromise) {
    return;
  }

  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) {
    return;
  }

  const env = await sharedEnvPromise;
  sharedEnvPromise = null;
  await env.teardown();
}
