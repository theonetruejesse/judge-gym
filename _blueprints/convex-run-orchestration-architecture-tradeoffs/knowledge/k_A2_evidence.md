# A2 Evidence: Scheduler-Only Convex Orchestration (No `@convex-dev/workflow`)

**Confidence:** 0.78

## Scope
Evaluate feasibility and tradeoffs of removing `@convex-dev/workflow` and using only Convex scheduler + internal mutations/actions for orchestration in `packages/engine/convex/domain/orchestrator`.

## Sources
- **S1** Convex Scheduling Functions: https://docs.convex.dev/scheduling/scheduled-functions
- **S2** Convex Scheduler API (`runAfter`): https://docs.convex.dev/api/interfaces/server.Scheduler
- **S3** Convex Actions: https://docs.convex.dev/functions/actions
- **S4** Convex Functions Overview/limits notes: https://docs.convex.dev/functions
- **S5** Convex Limits: https://docs.convex.dev/production/state/limits
- **S6** Convex Workflow component docs/overview: https://stack.convex.dev/workflow
- **L1** Local orchestrator scheduler: `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts`
- **L2** Local workflow handlers: `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts`
- **L3** Convex component config: `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/convex.config.ts`
- **L4** Engine dependency graph (`@convex-dev/workflow`): `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/package.json`

## Evidence-backed claims

1. **Scheduler-only is architecturally feasible in this codebase with moderate refactor scope.**
   - Evidence: Current orchestration already has a single internal scheduler loop (`startScheduler`/`runScheduler`) that enumerates active jobs/batches and dispatches units of work; workflow use is centralized in `processWorkflow.start(...)` call-sites in `runScheduler` (L1). Handler logic is already extracted as plain functions (`handleQueuedBatchWorkflow`, `handleRunningBatchWorkflow`, `handleQueuedJobWorkflow`, `handleRunningJobWorkflow`) in L2.
   - Inference: Replacing `processWorkflow.start` with `ctx.scheduler.runAfter(0, internal...handlerMutation, args)` plus wrapper internal mutations/actions is mechanically straightforward because domain logic is not deeply coupled to workflow steps.

2. **Current system already encodes idempotency/concurrency control at domain level, reducing dependency on workflow-level exactly-once semantics.**
   - Evidence: Batch/job handlers enforce status guards (`queued`/`running` checks), lease claims (`claimQueuedBatchForSubmit`, `claimRunningBatchForPoll`), and early exits (L2, L1). Scheduler tick also respects `next_poll_at`/`next_run_at` and active leases (L1).
   - Inference: Migration risk is lower because correctness currently relies on explicit state transitions and leases, not only workflow runtime guarantees.

3. **Convex scheduler semantics support this dispatch pattern, but ordering and dedupe are application responsibilities.**
   - Evidence: `runAfter` schedules mutation/action execution; scheduled functions are stored as documents in `_scheduled_functions`; ordering is not guaranteed for same timestamp; scheduling from actions may execute immediately and can duplicate if the action is retried (S1, S2).
   - Inference: Scheduler-only can replicate fan-out, but duplicate execution and out-of-order starts must continue to be handled with guards/leases (already partly present).

4. **There are hard platform limits that can become first-order constraints under scheduler-only fan-out.**
   - Evidence: A single function can schedule at most 1,000 functions; total argument size across scheduled calls from one function is capped (8MB); mutation/action argument size max is 16MB; action concurrency cap is 1,000 (S2, S4, S5).
   - Inference: If one scheduler tick dispatches very large numbers of due jobs/batches, scheduler-only architecture needs explicit throttling/chunking and backpressure to avoid hitting per-function scheduling caps and action concurrency saturation.

5. **Action behavior raises reliability caveats for external side effects in scheduler-only flows.**
   - Evidence: Convex actions can have side effects and are not automatically retried by Convex; scheduling from actions can duplicate on retries (S3, S1).
   - Inference: External-provider calls in orchestration should remain wrapped in idempotent state transitions and compensating re-poll/requeue logic; relying on action invocation once-only behavior is unsafe.

6. **Removing workflow would simplify dependency and component surface area.**
   - Evidence: Workflow component is installed in `convex.config.ts` (`app.use(workflow)`) and `@convex-dev/workflow` is a direct dependency (L3, L4).
   - Inference: Scheduler-only removes one Convex component and one package dependency, reducing upgrade/compatibility surface.

7. **Removing workflow also removes built-in workflow runtime features that may need replacement.**
   - Evidence: Workflow docs expose workflow execution model with retries/status tracking APIs (`define`, `run`, `status`) and configurable retry behavior (S6). Local code sets `defaultRetryBehavior`, `maxParallelism`, and `retryActionsByDefault` via `WorkflowManager` options (L2).
   - Inference: Scheduler-only must explicitly reintroduce any required equivalents (e.g., execution observability, retry policy centralization, backoff, and per-work-item lifecycle tracking) or accept reduced operability.

8. **In this repository, migration blast radius is localized but non-trivial.**
   - Evidence: Workflow references are concentrated in `process_workflows.ts`, `scheduler.ts`, `convex.config.ts`, dependency declarations, and tests importing workflow handlers (L1-L4 + grep results).
   - Inference: A focused migration is practical, but test harnesses and operational telemetry expectations around workflow-driven async execution will need updates.

## Uncertainties and open questions
- Whether `@convex-dev/workflow` currently provides implicit durability/visibility semantics the team relies on operationally (beyond what local code shows).
- The maximum realistic due-work fan-out per scheduler tick in production, which determines whether Convex scheduling caps become binding.
- Whether any downstream tooling depends on workflow-run identifiers/status APIs (if yes, replacement instrumentation is required).
- Exact cost/performance delta between many `ctx.scheduler.runAfter` calls vs workflow workpool dispatch under current load profile.

## Bottom line (A2)
Scheduler-only orchestration appears **viable** for this codebase because domain handlers are already explicit and idempotency-aware, but it is not “free”: reliability/operability features currently centralized in workflow settings would need deliberate replacement, and scheduler fan-out must be throttled against Convex per-function scheduling limits.
