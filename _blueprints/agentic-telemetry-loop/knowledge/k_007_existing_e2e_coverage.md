# Existing E2E and Idempotency Coverage

**Confidence:** 0.83

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/tests/orchestrator_idempotency.test.ts:223
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/tests/orchestrator_live_run.test.ts:157
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/lab.ts:198

**Summary:**
The project already exercises production orchestration paths in tests, including duplicate apply replay checks. Live-provider end-to-end tests exist but are env-gated.
