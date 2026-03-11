# `assistant_reasoning` has low compatibility value

**Confidence:** 0.88

**Sources:**
- `packages/engine/convex/models/llm_calls.ts`
- `packages/engine/convex/domain/runs/run_service.ts`
- `packages/engine/convex/domain/window/window_service.ts`
- `packages/engine/convex/models/samples.ts`

**Summary:**
`assistant_reasoning` exists on `llm_requests`, but successful paths store justifications into artifact tables and generally patch only `assistant_output` plus token counts on the request row. The field is primarily populated in a run parse-failure path as a best-effort extracted reasoning snippet, which makes it a low-value, inconsistent field rather than a dependable cross-system contract. Removing it is lower risk than redesigning `llm_requests` IDs or transport semantics.
