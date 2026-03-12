# Axiom Failure Pattern

**Confidence:** 0.95

**Sources:**
- Axiom dataset `judge-gym`
- Aggregation over `event_name`
- Aggregation over `request_error` and `batch_apply_error`

**Summary:**
Axiom confirms the dominant failure pattern is provider-side transient failure during `rubric_critic`. In the last 6 hours, `request_error` occurred `438` times, with `406` classified as `unknown` on `run / rubric_critic`. `batch_apply_error` occurred `30` times. Of those, `28` were provider-style timeouts or "try again later" messages on `rubric_critic`, while only `2` were engine-side `orchestrator_error` OCC conflicts touching `sample_score_targets` (`1` in `score_gen`, `1` in `score_critic`). This supports the interpretation that the main live issue is provider timeout / degraded completion, with a secondary engine concurrency tail.
