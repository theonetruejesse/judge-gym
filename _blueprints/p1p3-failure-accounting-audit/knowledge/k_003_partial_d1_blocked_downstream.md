# Partial D1 failures are upstream rubric failures with blocked downstream score units

**Confidence:** 0.93

**Sources:**
- Convex MCP `runOneoffQuery` on dev deployment for run `kh7avay0pw0jdc15svq9jpz5p182gwjw`
- Convex MCP targeted `runOneoffQuery` for sample `jh70yznepv6sfbnkbwxpkjw9v182gftg` and unit `m974qrkze2a5tr2njqq2gm3s9d82ht85`
- Convex MCP `packages/lab:getRunSummary` for run `kh7avay0pw0jdc15svq9jpz5p182gwjw`

**Summary:**
The partial D1 run `kh7avay0pw0jdc15svq9jpz5p182gwjw` shows a clean blocked-downstream pattern rather than missing artifact loss. Aggregate table counts show `samples.total=30`, `rubric_present=27`, `rubric_critic_present=27`, `sample_evidence_scores.total=300`, `score_present=270`, `score_critic_present=270`, with `scores.total=270` and `score_critics.total=270`. The missing work is concentrated in exactly three samples, each with all ten score units missing (`affected_samples=3`, `fully_missing_samples=3`, `partially_missing_samples=0`). A targeted sample audit shows the failed sample has no rubric or critic ids, its rubric target is exhausted with `max_attempts=3`, and there is no `score_gen` target or score request for a downstream missing unit. `getRunSummary` reports the same shape: `rubric_gen 27 completed / 3 failed`, `score_gen 270 completed / 30 failed`, `score_critic 270 completed / 30 failed`. The missing score units were blocked by upstream rubric failure, not silently dropped after scheduling.
