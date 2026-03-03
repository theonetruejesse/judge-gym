# A1 Evidence: Workflow-heavy orchestration with payload/contention fixes

## Scope
Evaluate keeping `@convex-dev/workflow` as the primary orchestrator for run/batch/job handling in this repo.

## Evidence-backed claims

1. `@convex-dev/workflow` is designed for durable long-running execution, retries, and failure recovery, which matches this codebase's poll/requeue style orchestration.
- External evidence: Convex component page describes durable, fault-tolerant workflows with automatic retries and queued execution.
- Source: https://www.convex.dev/components/workflow

2. Workflow-specific limits are strict: each step input/output is limited to 1MB and total workflow journal to 8MB, so prompt/result payload growth is a real architectural risk.
- External evidence: component docs and repo README list `step` argument/return and journal limits.
- Sources:
  - https://www.convex.dev/components/workflow
  - https://github.com/get-convex/workflow/blob/main/README.md

3. Convex function payload limits are also bounded (arguments+return+error), so orchestration must constrain payload size before action boundaries.
- External evidence: Convex limits docs list action limits (Convex runtime: 8MiB; Node.js runtime: 5MiB) and mutation/query limits.
- Source: https://docs.convex.dev/production/state/limits

4. Current batch submission path sends full prompt bodies for all requests as one action arg array, which can hit payload caps before provider submission.
- Local evidence: `submitBatch` maps every request to `{system_prompt,user_prompt,...}` and passes `{ requests: payload }` to `submitOpenAiBatchAction`.
- Local sources:
  - `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_service.ts:247`
  - `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/providers/provider_services.ts:19`

5. The system already has contention controls for batch polling/submission (lease ownership + expiry + release in `finally`), which supports a fix-forward strategy rather than replacement.
- Local evidence: claim/release flow with `poll_claim_owner`, `poll_claim_expires_at`, and lease checks for queued/running batches.
- Local sources:
  - `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts:90`
  - `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:168`
  - `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:285`

6. Scheduler fan-out is centralized and starts async workflows per active entity each tick, so scale pressure will show up as scheduled-job churn and concurrent starts.
- Local evidence: `runScheduler` loops queued/running batches/jobs and calls `processWorkflow.start(..., { startAsync: true })`, then reschedules itself.
- External evidence: scheduled function quotas are bounded (e.g., per-second and concurrent limits by plan).
- Sources:
  - `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts:65`
  - https://docs.convex.dev/production/state/limits

7. OCC conflicts are expected in Convex under overlapping writes; this architecture has potential hot documents (batch/job/request status docs) updated by retries/polling, so reducing write contention is likely higher ROI than swapping orchestrators.
- External evidence: Convex documents OCC behavior and retries/failures for concurrent transactions.
- Local evidence: repeated status/attempt/lease patching in batch/job/request repos and services.
- Sources:
  - https://docs.convex.dev/error#write-conflict-optimistic-concurrency-control
  - `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_service.ts:108`
  - `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_job_service.ts:187`

8. Existing orchestration already supports policy-based route split (batch vs job) and batch chunking (`max_batch_size`), which is a native place to add payload-aware chunking and contention-aware throttles while keeping workflow primary.
- Local evidence: `decideRoute`, `createBatch` chunk loop, and run policy thresholds.
- Source: `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/base.ts:74`

## Counterevidence / uncertainties

- Workflow determinism constraints mean code changes can impact in-flight workflows; the repo and component docs highlight determinism caveats. This raises operational risk when deploying frequent orchestration refactors.
- Source: https://github.com/get-convex/workflow/blob/main/README.md

- The component docs mention both benefits and limits, but do not prescribe one canonical pattern for very large prompt payloads; implementation details (reference-by-id vs inline prompts) remain a design choice.
- Sources:
  - https://www.convex.dev/components/workflow
  - https://docs.convex.dev/production/state/limits

- It is not fully clear from docs alone whether your specific actions run in Convex runtime vs Node runtime for limit accounting in every environment; payload budgets should assume the stricter bound when uncertain.
- Source: https://docs.convex.dev/production/state/limits
