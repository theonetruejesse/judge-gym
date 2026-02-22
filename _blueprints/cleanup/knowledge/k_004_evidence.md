# Window evidence flow missing persistence and stage progression

**Confidence:** 0.67

**Sources:**
- packages/engine/convex/domain/window/window_service.ts
- packages/engine/convex/domain/window/window_repo.ts
- packages/engine/convex/domain/window/evidence_search.ts

**Summary:**
Window orchestration can enqueue stage processing for evidences, but the current window repo only returns search results and does not insert evidences into the database. The window service sets window status and enqueues stage "l1_cleaned" but does not handle collecting/searching evidence or advancing window stage after results are applied.
