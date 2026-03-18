# Start Handoff Patterns for Run/Window Creation (Temporal + Convex)

**Confidence:** 0.76

**Sources:**
- https://docs.temporal.io/sending-messages
- https://api-docs.temporal.io/
- https://community.temporal.io/t/what-is-recommended-approach-on-starting-workflow-in-transaction/16248

**Summary:**
Convex and Temporal cannot share an atomic transaction for "create row + start workflow". That means judge-gym must treat start as an idempotent handoff problem with explicit reconciliation. Temporal provides With-Start primitives and explicit Workflow ID conflict/reuse policies that make "ensure workflow exists" achievable without building a scheduler, but Update-With-Start is explicitly not atomic and can start a workflow even if the Update cannot be delivered.

The safest default for judge-gym is to make Workflow IDs business-keyed (`runId`/`windowId`), make start idempotent (conflict policy set to attach/use-existing), and make Convex writes idempotent. Choose the start pattern per flow based on: whether the Convex row must exist before start, whether the caller needs an acknowledged response, and whether you require "eventual start even if the caller crashes without retry".

---

## Evidence Notes (Key Excerpts)

- Signal-With-Start semantics: if a workflow execution with the Workflow ID is running it is signaled; otherwise, it starts and is immediately signaled. This is presented as a way to "lazily initialize" workflows. (docs.temporal.io)  
- Update-With-Start semantics: recommends specifying `WorkflowIDConflictPolicy`, uses Workflow ID + Update ID as idempotency keys, and **explicitly warns it is not atomic**: a workflow can still start even if the update can't be delivered (e.g. no worker). (docs.temporal.io)  
- Workflow ID conflict/reuse policies exist in the API and define behavior when starting with a running workflow ID (fail/use-existing/terminate-existing) or a closed workflow ID (allow/reject/failed-only, etc.). (api-docs.temporal.io)  
- Cross-system atomicity is not available; community guidance recommends either (a) a transactional outbox or (b) making the DB transaction idempotent and making the workflow start idempotent (business-keyed workflow id), then retrying safely after crashes. (community.temporal.io)

---

## Pattern Comparison (Pragmatic)

### 1) Create-Then-Start (Convex row first, then Temporal start)

**Use when:** you want the domain row to exist immediately for UI and later projection/audit to reference a stable `runId/windowId`.

**Mechanics:** create the Convex row in a Convex transaction; then call Temporal StartWorkflow using `workflowId = runId/windowId` and `WorkflowIdConflictPolicy = USE_EXISTING` (or equivalent per SDK) so retries attach rather than error.

**Failure modes & reconciliation:**
- DB commit succeeds, start call fails: row is `not_started` / `needs_start`; a later manual/agent retry starts the workflow idempotently.
- Start succeeds, projection patch fails: treat as a normal idempotent projection retry from the workflow (or allow a cheap "attach started workflow id/run id" repair step).

**Pros:** simplest mental model; avoids outbox if you accept "client retries" as the eventual-start mechanism.  
**Cons:** if the process must start even when the caller dies and no retry happens, you need either an outbox-like dispatcher or a background scan for `needs_start` rows.

### 2) Start-Then-Project (Temporal start first, workflow creates/patches Convex)

**Use when:** you prefer Temporal to be the durable driver and are okay with the Convex row being a projection that might appear slightly later.

**Mechanics:** StartWorkflow with `workflowId = runId/windowId`; first workflow step is an Activity `ensureConvexRowExists(runId/windowId, config)` (idempotent upsert).

**Failure modes & reconciliation:**
- Workflow starts but Convex is down: the Activity retries; the run exists in Temporal and will project once Convex recovers.
- UI depends on Convex row: you need the UI to be able to render "pending projection" from Temporal (or you accept a brief gap).

**Pros:** avoids split-brain where row exists but workflow never starts; avoids outbox; Temporal drives retries.  
**Cons:** your UI needs either Temporal reads or a "placeholder row" strategy.

### 3) Signal-With-Start

**Use when:** you want to ensure a workflow exists and deliver a best-effort async message, without requiring acknowledgement beyond "signal accepted".

**Mechanics:** `signalWithStart(workflowId, signal, payload)`; if running, signal; else start and signal.

**Pros:** clean "ensure exists" tool; good for lazy init patterns.  
**Cons:** signal is not a synchronous command with a result; if you need validation/ack, use Updates.

### 4) Update-With-Start

**Use when:** you want "ensure exists + apply a validated command + optionally return a result" in one client roundtrip.

**Mechanics:** `updateWithStart(workflowId, updateId, updateFn, conflictPolicy=USE_EXISTING)`; update handlers validate/ack.

**Critical caveat:** Temporal docs state Update-With-Start is **not atomic** and may start a workflow even if the update can't be delivered (e.g. no worker). That implies you must handle `started-but-not-updated` states.

**Pros:** simplest UX for "create-if-missing then apply command"; good for agent control ops that must be acknowledged.  
**Cons:** requires explicit handling of the non-atomicity footgun.

### 5) DB-First Intent/Outbox (Convex writes intent, dispatcher starts Temporal)

**Use when:** you need *eventual start* even if the caller crashes after committing the DB write and never retries.

**Mechanics:** Convex transaction writes `start_intent` row; a small dispatcher service reads intents and issues StartWorkflow/SignalWithStart/UpdateWithStart idempotently, then marks the intent done.

**Pros:** strongest "eventual start" guarantee from the DB perspective.  
**Cons:** can easily regress into "homemade queue" if you add leases, retries, reconciliation, and complex state; must stay minimal and only for the start handoff.

---

## Decision Matrix (Recommended Defaults)

| Requirement | Recommended Start Pattern |
| --- | --- |
| Convex row must exist before anything else | Create-Then-Start |
| Temporal is truth and Convex is projection; row may appear later | Start-Then-Project |
| Ensure workflow exists + fire-and-forget config change | Signal-With-Start |
| Ensure workflow exists + acknowledged/validated control command | Update-With-Start (with explicit `started-but-not-updated` reconciliation) |
| Must guarantee eventual start without relying on caller retries | DB-first intent/outbox (minimal) |

---

## Reconciliation States to Model Explicitly

At minimum, you need to be able to represent and repair these:

- `row_exists_but_workflow_missing` (Convex wrote row, Temporal start failed or never attempted)
- `workflow_exists_but_row_missing` (Temporal started, Convex projection not created yet)
- `workflow_started_but_update_missing` (Update-With-Start started workflow but update delivery failed)

The repair loop should be small and bounded: use idempotent start (business-keyed workflow id + conflict policy), idempotent Convex upserts, and prefer With-Start primitives over building new leasing/requeue machinery.

