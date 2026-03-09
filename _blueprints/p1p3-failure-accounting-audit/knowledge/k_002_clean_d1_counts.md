# Clean D1 run has null sample score fields but full per-unit completion

**Confidence:** 0.95

**Sources:**
- Convex MCP `runOneoffQuery` on dev deployment for run `kh77e0h2fp5pmr9geaf5q9myh982gecn`
- Convex MCP `packages/lab:getRunSummary` for run `kh77e0h2fp5pmr9geaf5q9myh982gecn`

**Summary:**
The clean D1 control run `kh77e0h2fp5pmr9geaf5q9myh982gecn` is a direct proof that sample-level score fields are not the completion source for subset scoring. Raw table counts show `samples.total=30`, `samples.rubric_present=30`, `samples.rubric_critic_present=30`, but `samples.score_present=0` and `samples.score_critic_present=0`. At the same time, the run has `sample_evidence_scores.total=300`, `sample_evidence_scores.score_present=300`, `sample_evidence_scores.score_critic_present=300`, `scores.total=300`, and `score_critics.total=300`. `getRunSummary` matches the unit-level view with `30/30`, `30/30`, `300/300`, `300/300`, `has_failures=false`. This means null sample-level score fields can coexist with a fully successful run.
