# Attempt Model Mismatch In Batch and Job Tables

**Confidence:** 0.88

**Sources:**
- Convex one-off query over `llm_batches`
- Convex one-off query over `llm_jobs`

**Summary:**
`llm_batches` and `llm_jobs` are not using the same attempt semantics as `llm_requests`. The batch table currently shows a compact `attempts` field with values like `1:error`, `1:success`, and `3:error`, but not an explicit monotonic `attempt_index`. The job table is worse: all `233` observed job rows report `attempts=undefined` while still succeeding. This makes forensic debugging and retry analysis inconsistent across request, batch, and job layers.
