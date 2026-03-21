# Observability And Agent Loop For Temporal-Backed Pilot

**Confidence:** 0.74

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/maintenance/process_debug.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/maintenance/codex.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/telemetry/events.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/workflows.ts
- https://docs.temporal.io/cli
- https://docs.temporal.io/cli/task-queue
- https://typescript.temporal.io/api/namespaces/workflow

**Summary:**
The engine already exposes a workable local debug/control plane through Convex (`packages/codex:*`) that is consistent with a Temporal-owned execution model, but the agent still lacks (a) a first-class way to observe Temporal task queues/pollers/backlog, (b) a strong-truth “Temporal says X” snapshot surfaced inside the same control plane, and (c) safe, acknowledged repair primitives beyond “start or nudge” before we run a full pilot loop.

## What The Agent Needs To Answer Quickly (Pilot Loop Requirements)

For an autonomous “monitor, triage, repair, revalidate” loop, the agent must be able to answer, quickly and with low read-cost:

- Is the process bound to a Temporal workflow (and what workflow/run id)?
- Is the workflow making progress (recent heartbeat/projection freshness), or stalled?
- Are workers polling the task queue that the workflow uses?
- Is there backlog, and is it increasing?
- For a stalled process: is it a workflow-level stall, an activity-level stall, provider quota/rate-limit, or an artifact apply/parse issue?
- What is the minimal safe “repair” action that can be tried once (resume, nudge, re-run stage activity, or declare terminal failure)?

The existing `packages/codex:getProcessHealth` / `getStuckWork` / `autoHealProcess` surfaces already cover the first two bullets from Convex state + `process_observability` + `llm_attempts`, but not the task-queue + poller + backlog reality from Temporal itself.

## Current State In This Repo

### What We Have (Good)

- Convex “local mirror” exists: `process_observability` stores a small capped recent-events tail, plus `updated_at_ms` and `last_milestone_at_ms` used to compute “no progress for ms”. (/packages/engine-convex/convex/domain/telemetry/events.ts)
- `getProcessHealth` is Temporal-native now:
  - reports `execution_binding.workflow_bound`, `workflow_id`, and `workflow_run_id`
  - includes projection freshness computation (`ACTIVE_PROJECTION_FRESH_MS`), stage progress, error summaries, and recent local events.
  - does not depend on legacy queue/batch/job tables. (/packages/engine-convex/convex/domain/maintenance/process_debug.ts)
- Workflow control primitives exist in workflow code:
  - query: `getProcessSnapshot`
  - updates: `setPauseAfter`, `pauseNow`, `resume`, `repairBounded` (currently stubbed).
  - This matches Temporal’s recommended “Queries/Signals/Updates via setHandler” model, including restrictions on query handler purity. (Temporal TS workflow namespace docs: `setHandler` guidance). (https://typescript.temporal.io/api/namespaces/workflow)

### What We Don’t Have Yet (Gaps)

- **Task queue visibility inside the agent loop.**
  - Temporal CLI `task-queue describe` is explicitly the supported mechanism to “Display a list of active Workers that have recently polled a Task Queue” plus backlog statistics like `ApproximateBacklogCount` and age. (https://docs.temporal.io/cli/task-queue)
  - But we don’t expose this data through our existing Convex `packages/codex:*` surfaces, and we don’t store it in a bounded way for the agent to reason about.
- **Strong-truth workflow inspection inside the agent loop.**
  - We have a workflow query (`getProcessSnapshot`), but the agent loop currently uses Convex’s projection and the Axiom trace ref; it doesn’t have a unified “DescribeWorkflowExecution” equivalent surfaced via the same control plane.
- **Bounded repair isn’t implemented in Temporal yet.**
  - `repairBoundedUpdate` currently returns `{ accepted: false, reason: "repair_not_implemented" }` in /packages/engine-temporal/src/workflows.ts.
  - That forces repair behavior into Convex-only nudges (restart/resume), which is weaker than having explicit Temporal-native repair operations (e.g. “rerun current stage activity once”, “refresh projection”, “pause now”, “force fail with reason”).
- **The local telemetry analyzer still carries queue-era event taxonomy.**
  - `analyzeProcessTelemetry` in /packages/engine-convex/convex/domain/maintenance/codex.ts counts `job_*` and `batch_*` events. That’s fine for legacy forensic reports, but if the new runtime is interactive activities + Temporal, the analyzer should evolve to include: `activity_started`, `activity_failed`, `activity_retried`, `quota_denied`, etc. Otherwise the agent has to infer too much.

## Recommended “Pilot-Ready Observability” Additions

### 1. Temporal Task Queue Health Surface

Add a small, explicit surface that returns (at minimum) for `judge-gym.window` and `judge-gym.run`:

- active pollers count (workflow + activity)
- last access time
- approximate backlog count
- backlog age
- add/dispatch/backlog increase rates (if available)

Temporal documents `temporal task-queue describe` as the supported way to see worker pollers and backlog/age, and notes time-based removal of workers and interpretation of “LastAccessTime”. (https://docs.temporal.io/cli/task-queue)

Implementation note (design-level only):
- run this from a place with network access to Temporal (Railway worker service is ideal).
- store only a bounded projection (e.g. last snapshot + rolling min/max) or expose it as a query endpoint used by the agent.

### 2. Workflow Describe / Snapshot Truth Stack

For each process, the agent should be able to obtain:

- workflow execution status (`RUNNING`/`FAILED`/etc.)
- “pending activity” hints (if available)
- last event time or history length to detect “stuck but polling”
- current workflow run id (and whether it continued-as-new)

Local `process_observability` is a good discovery tool, but the repair loop should confirm critical decisions against Temporal truth rather than only stale projection.

### 3. Finish `repairBounded` With Safe, Small Operations

Make `repairBounded` accept only a small allowlist, for example:

- `refresh_projection`: call `projectProcessState` activity without changing stage
- `rerun_stage_once`: rerun the current stage activity once if `stageStatus` is `failed`
- `force_pause_now`: equivalent to `pauseNow` (idempotent)
- `force_fail`: terminal failure with a tracked reason

Temporal’s TS docs explicitly warn that awaiting long async operations inside update/signal handlers must be done cautiously (workflow completion ordering). That suggests we should keep updates short: mark intent, then let the main workflow loop/activities do the heavy work. (https://typescript.temporal.io/api/namespaces/workflow)

## Counterevidence / Uncertainty

- Some “worker polling” observability is eventually consistent and time-windowed. Even the CLI describes worker removal after “5 minutes since last poll request”, so you should not treat it as a precise liveness oracle at second-level granularity. (https://docs.temporal.io/cli/task-queue)
- If we rely on a Railway-hosted worker to provide Temporal health to Convex, network failures between Railway and Convex can create a new blind spot. This argues for keeping repair decisions confirmable via multiple sources (Convex projection + Temporal describe + Axiom trace, when available).
- Our current telemetry analyzer is likely to be overhauled. It’s not obvious what the “right” minimal event vocabulary is for Temporal-owned activity execution without first running a pilot and seeing real failure modes.

