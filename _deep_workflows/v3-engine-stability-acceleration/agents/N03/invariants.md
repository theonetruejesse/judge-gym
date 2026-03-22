# Cleanup Invariants

## Required Reset Invariant

Destructive deletion is only truly safe when at least one of these is true:

1. The workflow is guaranteed unable to send any more Convex callbacks.
2. The callback targets remain present as tombstones or soft-deleted rows until late callbacks are harmless.
3. The worker-side Convex mutations treat missing rows as safe no-ops with traceable diagnostics.

## Current Violation

- `projectProcessState` and `recordLlmAttemptFinish` assume their target rows still exist.
- `deleteRunDataPass` and other cleanup helpers can remove those rows.
- `workflows.ts` explicitly performs a non-cancellable final projection on cancellation.

That combination means the system can be operationally correct and still emit hard Convex errors during normal cleanup.
