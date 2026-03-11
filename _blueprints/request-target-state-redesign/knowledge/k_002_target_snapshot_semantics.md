# `process_request_targets` mixes target truth with historical residue

**Confidence:** 0.95

**Sources:**
- `packages/engine/convex/models/llm_calls.ts`
- `packages/engine/convex/domain/llm_calls/llm_request_repo.ts`
- `packages/engine/convex/domain/maintenance/codex.ts`
- `packages/engine/convex/domain/runs/run_progress.ts`
- `packages/engine/convex/domain/runs/experiments_data.ts`

**Summary:**
`process_request_targets` is a per-`custom_key` snapshot derived from all request rows. It stores `has_pending`, `oldest_pending_ts`, `max_attempts`, and latest error metadata, but no explicit success or resolution field. Consumers therefore infer terminal failure from combinations such as `!has_pending && max_attempts >= cap`, which leaks historical retry residue into current-state reporting. This schema is sufficient for cheap stage progress, but it is not sufficient for unambiguous operator truth because it does not directly encode whether the logical target eventually succeeded.
