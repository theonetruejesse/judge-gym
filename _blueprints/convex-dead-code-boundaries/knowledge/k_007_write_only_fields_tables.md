# Write-only Fields and Tables

**Confidence:** 0.62

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/models/llm_calls.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/experiments_data.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/schema.ts

**Summary:**
`assistant_reasoning` is present in the LLM request schema but has no reads or writes outside the schema definition. `assistant_output`, `input_tokens`, and `output_tokens` are written on request success in run/window services, but there are no read paths in Convex code that consume them. `rubric_critics` and `score_critics` tables are inserted in run workflows and counted in `experiments_data`, but there are no query endpoints exposing their contents. This suggests unused storage or missing read surfaces for analytics/debugging.
