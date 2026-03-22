# V3 Engine Stability Acceleration

## Recommendation

Execute the next patch train before another V3 relaunch.

The workflow confirms a tight strategy:

1. Patch Convex missing-row callback semantics first.
2. Pair that with a clearer reset/drain invariant.
3. Then run one fresh V3 relaunch as a validation pass for the already-deployed runtime preflight hardening.

That is a stronger path than either:

- launching again immediately and mixing runtime validation with known cleanup noise
- starting a broad engine-wide refactor without a blocker-linked target

## Why

### Runtime side

- The March 22 Temporal patch is coherent and well-targeted to the captured score-stage freshness gap.
- The live system is parked clean, with one worker identity polling both queues and no backlog.
- But the patch is still unproven by a fresh end-to-end relaunch.

### Convex/control-plane side

- `packages/worker:projectProcessState` and `packages/worker:recordLlmAttemptFinish` still hard-throw when their target rows are missing.
- `workflows.ts` performs a non-cancellable final projection on cancellation.
- Reset/delete helpers can remove run-scoped artifacts and rows in paged passes without a callback-safe tombstone or no-op path.

That means autonomous cleanup is still structurally unsafe even if the runtime bug is fixed.

## Proposed Next Patch Order

1. `apps/engine-convex/convex/packages/worker.ts`
   Make `projectProcessState` and `recordLlmAttemptFinish` safe no-ops when the target row is gone, with explicit diagnostics instead of hard failures.
2. `apps/engine-convex/convex/domain/maintenance/v3_campaign.ts` and `apps/engine-convex/convex/domain/maintenance/danger.ts`
   Tighten reset/drain semantics so destructive deletion is less eager and easier to reason about.
3. Campaign/protocol surfaces
   Encode the relaunch gate so the next pass has explicit green/yellow/red criteria.

## Relaunch Gate

Do not relaunch until:

- missing-row callback failures stop recurring during idle/reset conditions
- reset returns the cohort to `preflight_clean` without abnormal manual cleanup becoming the default path
- queue state is clean and unambiguous
- the next loop is treated as a runtime validation pass, not a claim of full autonomy

## Deep Investigation Scope

The areas worth deep investigation are not “the whole engine.” They are:

- callback/deletion idempotency
- reset/drain legality
- autonomy gate and observability

Everything else should stay out of scope unless one of those investigations points back to it.
