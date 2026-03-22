# Cleanup-Race Patch Candidates

## Preferred Narrow Fix

1. Make `packages/worker:projectProcessState` a safe no-op when the target run/window row is missing.
2. Make `packages/worker:recordLlmAttemptFinish` a safe no-op when the attempt row is missing.
3. Emit a structured trace/log signal for these ignored late callbacks so the system remains diagnosable.

This is the smallest patch set most likely to remove the current reset noise without changing live workflow behavior.

## Complementary Control-Plane Fix

- Tighten reset sequencing so destructive deletion happens only after a stronger cancellation/drain check, especially for active or recently active workflows.

## Larger Refactor To Avoid For Now

- Do not introduce full tombstone tables or broad workflow/storage redesign unless the narrow idempotency fix proves insufficient.
