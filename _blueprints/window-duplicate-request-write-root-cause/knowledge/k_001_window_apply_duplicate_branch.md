# Window Apply Duplicate Branch Emits and Writes Repeatedly

**Confidence:** 0.93

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts:96
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts:113
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts:114
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts:131
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/telemetry/events.ts:44

**Summary:**
In `applyRequestResult`, if the evidence stage output field already exists, the function still patches the request row to `success` and emits `request_apply_duplicate_success`. There is no event dedupe layer in telemetry emission, so each repeated invocation inserts another telemetry row. This behavior is the direct source of high duplicate-success event counts once duplicate apply invocations occur.
