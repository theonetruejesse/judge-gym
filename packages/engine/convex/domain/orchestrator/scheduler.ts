import z from "zod";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { zInternalMutation } from "../../utils/custom_fns";
import { ENGINE_SETTINGS } from "../../settings";
import { shouldRunAt } from "../../utils/scheduling";
import type { ActiveBatchesResult } from "../llm_calls/llm_batch_repo";
import type { ActiveJobsResult } from "../llm_calls/llm_job_repo";
import { zid } from "convex-helpers/server/zod4";
import { resolveRequeueHandler } from "./target_registry";
import { emitTraceEvent } from "../telemetry/emit";

const SCHEDULER_LOCK_ENTITY_ID = "scheduler_lock";
const SCHEDULER_LOCK_TTL_MS = 20_000;
const SCHEDULER_START_DEBOUNCE_MS = 5_000;
const MAX_QUEUED_BATCHES_PER_TICK = 10;
const MAX_RUNNING_BATCHES_PER_TICK = 20;
const MAX_QUEUED_JOBS_PER_TICK = 20;
const MAX_RUNNING_JOBS_PER_TICK = 30;
const MAX_ORPHANED_REQUESTS_PER_TICK = 30;
const SCHEDULER_SCAN_MULTIPLIER = 3;
const SCHEDULED_SCAN_MAX_ROWS = 2_000;

export const requeueRequest = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.runQuery(
      internal.domain.llm_calls.llm_request_repo.getLlmRequest,
      { request_id: args.request_id },
    );

    const handler = resolveRequeueHandler(request.custom_key);
    if (!handler) throw new Error(`Unsupported target type for retry: ${request.custom_key}`);

    await ctx.runMutation(handler, { request_id: request._id });
  },
});

function isSchedulerRun(name: string): boolean {
  return (
    name === "domain/orchestrator/scheduler:runScheduler" ||
    name === "domain/orchestrator/scheduler.js:runScheduler"
  );
}

function hasActiveBatchPollLease(
  batch: ActiveBatchesResult["running_batches"][number],
  now: number,
): boolean {
  return batch.poll_claim_owner != null
    && batch.poll_claim_expires_at != null
    && batch.poll_claim_expires_at > now;
}

function hasActiveJobRunLease(
  job: ActiveJobsResult["running_jobs"][number] | ActiveJobsResult["queued_jobs"][number],
  now: number,
): boolean {
  return job.run_claim_owner != null
    && job.run_claim_expires_at != null
    && job.run_claim_expires_at > now;
}

async function isSchedulerScheduled(ctx: MutationCtx): Promise<boolean> {
  const scheduled = await ctx.db.system
    .query("_scheduled_functions")
    .order("desc")
    .take(SCHEDULED_SCAN_MAX_ROWS);
  return scheduled.some(
    (row) => isSchedulerRun(row.name) && row.completedTime == null,
  );
}

async function listSchedulerLocks(
  ctx: MutationCtx,
): Promise<Doc<"scheduler_locks">[]> {
  const rows = await ctx.db
    .query("scheduler_locks")
    .withIndex("by_lock_key", (q) => q.eq("lock_key", SCHEDULER_LOCK_ENTITY_ID))
    .take(8);
  return rows.sort((left, right) => left._creationTime - right._creationTime);
}

async function tryAcquireSchedulerLock(
  ctx: MutationCtx,
  now: number,
): Promise<{ acquired: boolean; lock_id: string }> {
  const [existing, ...duplicates] = await listSchedulerLocks(ctx);

  const payload = {
    lock_key: SCHEDULER_LOCK_ENTITY_ID,
    status: "running" as const,
    heartbeat_ts_ms: now,
    expires_at_ms: now + SCHEDULER_LOCK_TTL_MS,
  };

  if (!existing) {
    const lockId = await ctx.db.insert("scheduler_locks", payload);
    return { acquired: true, lock_id: String(lockId) };
  }

  for (const duplicate of duplicates) {
    await ctx.db.patch(duplicate._id, {
      status: "idle",
      heartbeat_ts_ms: now,
      expires_at_ms: now,
    });
  }

  const isLocked = existing.status === "running"
    && existing.expires_at_ms > now;
  if (isLocked) {
    return { acquired: false, lock_id: String(existing._id) };
  }

  await ctx.db.patch(existing._id, payload);
  return { acquired: true, lock_id: String(existing._id) };
}

async function releaseSchedulerLock(
  ctx: MutationCtx,
  now: number,
): Promise<void> {
  const [existing, ...duplicates] = await listSchedulerLocks(ctx);
  if (!existing) return;
  await ctx.db.patch(existing._id, {
    status: "idle",
    heartbeat_ts_ms: now,
    expires_at_ms: now,
  });
  for (const duplicate of duplicates) {
    await ctx.db.patch(duplicate._id, {
      status: "idle",
      heartbeat_ts_ms: now,
      expires_at_ms: now,
    });
  }
}

export const startScheduler = zInternalMutation({
  args: z.object({}),
  handler: async (ctx) => {
    const now = Date.now();
    const [existing, ...duplicates] = await listSchedulerLocks(ctx);

    for (const duplicate of duplicates) {
      await ctx.db.patch(duplicate._id, {
        status: "idle",
        heartbeat_ts_ms: now,
        expires_at_ms: now,
      });
    }

    const lockActive = existing?.status === "running"
      && existing.expires_at_ms > now;
    if (lockActive) return;

    const recentlyKickedOff = existing != null
      && existing.heartbeat_ts_ms >= now - SCHEDULER_START_DEBOUNCE_MS;
    if (recentlyKickedOff) return;

    const hasScheduled = await isSchedulerScheduled(ctx);
    if (hasScheduled) return;

    if (!existing) {
      await ctx.db.insert("scheduler_locks", {
        lock_key: SCHEDULER_LOCK_ENTITY_ID,
        status: "idle",
        heartbeat_ts_ms: now,
        expires_at_ms: now,
      });
    } else {
      await ctx.db.patch(existing._id, {
        status: "idle",
        heartbeat_ts_ms: now,
        expires_at_ms: now,
      });
    }

    await ctx.scheduler.runAfter(
      0,
      internal.domain.orchestrator.scheduler.runScheduler,
      {},
    );
  },
});

export const runScheduler = zInternalMutation({
  args: z.object({}),
  handler: async (ctx) => {
    const now = Date.now();
    const lock = await tryAcquireSchedulerLock(ctx, now);
    if (!lock.acquired) {
      return { skipped: true, reason: "lock_not_acquired" };
    }

    try {
      const { queued_batches, running_batches } = (await ctx.runQuery(
        internal.domain.llm_calls.llm_batch_repo.listActiveBatches,
        {
          queued_limit: MAX_QUEUED_BATCHES_PER_TICK * SCHEDULER_SCAN_MULTIPLIER,
          running_limit: MAX_RUNNING_BATCHES_PER_TICK * SCHEDULER_SCAN_MULTIPLIER,
        },
      )) as ActiveBatchesResult;

      const { queued_jobs, running_jobs } = (await ctx.runQuery(
        internal.domain.llm_calls.llm_job_repo.listActiveJobs,
        {
          queued_limit: MAX_QUEUED_JOBS_PER_TICK * SCHEDULER_SCAN_MULTIPLIER,
          running_limit: MAX_RUNNING_JOBS_PER_TICK * SCHEDULER_SCAN_MULTIPLIER,
        },
      )) as ActiveJobsResult;

      const orphanedRequests = (await ctx.runQuery(
        internal.domain.llm_calls.llm_request_repo.listOrphanedRequests,
        { limit: MAX_ORPHANED_REQUESTS_PER_TICK * SCHEDULER_SCAN_MULTIPLIER },
      )) as Doc<"llm_requests">[];

      if (
        queued_batches.length === 0 &&
        running_batches.length === 0 &&
        queued_jobs.length === 0 &&
        running_jobs.length === 0 &&
        orphanedRequests.length === 0
      ) {
        return { done: true };
      }

      let processedQueuedBatches = 0;
      let processedRunningBatches = 0;
      let processedQueuedJobs = 0;
      let processedRunningJobs = 0;

      for (const batch of queued_batches) {
        if (processedQueuedBatches >= MAX_QUEUED_BATCHES_PER_TICK) break;
        if (!shouldRunAt(batch.next_poll_at, now)) continue;
        if (hasActiveBatchPollLease(batch, now)) continue;
        await ctx.scheduler.runAfter(
          0,
          internal.domain.orchestrator.process_workflows.processQueuedBatchWorkflow,
          { batch_id: batch._id },
        );
        processedQueuedBatches += 1;
      }

      for (const batch of running_batches) {
        if (processedRunningBatches >= MAX_RUNNING_BATCHES_PER_TICK) break;
        if (!shouldRunAt(batch.next_poll_at, now)) continue;
        if (hasActiveBatchPollLease(batch, now)) continue;
        await ctx.scheduler.runAfter(
          0,
          internal.domain.orchestrator.process_workflows.processRunningBatchWorkflow,
          { batch_id: batch._id },
        );
        processedRunningBatches += 1;
      }

      for (const job of queued_jobs) {
        if (processedQueuedJobs >= MAX_QUEUED_JOBS_PER_TICK) break;
        if (!shouldRunAt(job.next_run_at, now)) continue;
        if (hasActiveJobRunLease(job, now)) continue;
        await ctx.scheduler.runAfter(
          0,
          internal.domain.orchestrator.process_workflows.processQueuedJobWorkflow,
          { job_id: job._id },
        );
        processedQueuedJobs += 1;
      }

      for (const job of running_jobs) {
        if (processedRunningJobs >= MAX_RUNNING_JOBS_PER_TICK) break;
        if (!shouldRunAt(job.next_run_at, now)) continue;
        if (hasActiveJobRunLease(job, now)) continue;
        await ctx.scheduler.runAfter(
          0,
          internal.domain.orchestrator.process_workflows.processRunningJobWorkflow,
          { job_id: job._id },
        );
        processedRunningJobs += 1;
      }

      let requeuedOrphanedRequests = 0;
      for (const request of orphanedRequests) {
        if (requeuedOrphanedRequests >= MAX_ORPHANED_REQUESTS_PER_TICK) break;
        if (!shouldRunAt(request.next_attempt_at, now)) continue;
        await ctx.runMutation(internal.domain.orchestrator.scheduler.requeueRequest, {
          request_id: request._id,
        });
        requeuedOrphanedRequests += 1;
      }

      await ctx.scheduler.runAfter(
        ENGINE_SETTINGS.run_policy.poll_interval_ms,
        internal.domain.orchestrator.scheduler.runScheduler,
        {},
      );

      const result = {
        queued_batches: queued_batches.length,
        running_batches: running_batches.length,
        queued_jobs: queued_jobs.length,
        running_jobs: running_jobs.length,
        orphaned_requests: orphanedRequests.length,
        processed_queued_batches: processedQueuedBatches,
        processed_running_batches: processedRunningBatches,
        processed_queued_jobs: processedQueuedJobs,
        processed_running_jobs: processedRunningJobs,
        requeued_orphaned_requests: requeuedOrphanedRequests,
      };

      await emitTraceEvent(ctx, {
        trace_id: "scheduler:global",
        entity_type: "scheduler",
        entity_id: "scheduler",
        event_name: "scheduler_tick",
        status: "running",
        payload_json: JSON.stringify(result),
      });

      return result;
    } finally {
      await releaseSchedulerLock(ctx, Date.now());
    }
  },
});
