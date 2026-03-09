# Partial P1 run reflects genuine score-generation exhaustion across score units

**Confidence:** 0.90

**Sources:**
- Convex MCP `runOneoffQuery` on dev deployment for run `kh765a6z2njwef2cp5y4cavxbd82k2z3`
- Convex MCP targeted `runOneoffQuery` for sample `jh741xzy0y15cchjwnbyf4g7v982jt8e` and unit `m97eqxprzjyc1annpfpw14d2vx82jtxf`
- Convex MCP `packages/lab:getRunSummary` for run `kh765a6z2njwef2cp5y4cavxbd82k2z3`

**Summary:**
The partial P1 run `kh765a6z2njwef2cp5y4cavxbd82k2z3` is not blocked at the rubric stage. Raw counts show `samples.total=30`, `rubric_present=30`, `rubric_critic_present=30`, `sample_evidence_scores.total=600`, `score_present=300`, `score_critic_present=300`, `scores.total=300`, and `score_critics.total=300`. Failures are spread across every sample rather than concentrated upstream: `affected_samples=30`, `fully_missing_samples=0`, `partially_missing_samples=30`. A targeted missing unit has a present rubric and rubric critic, an exhausted `score_gen` target with `max_attempts=3`, latest error `Missing reasoning before VERDICT line`, and no `score_critic` target because the score was never created. `getRunSummary` matches this exactly with `score_gen 300 completed / 300 failed` and `score_critic 300 completed / 300 failed` while both rubric stages are `30/30`. This is genuine terminal failure at the score-unit stage.
