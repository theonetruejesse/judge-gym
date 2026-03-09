# Axiom quantitative pass (Since P1 launch)

**Confidence:** 0.91

**Sources:**
- Axiom MCP `judge-gym` dataset (schema + aggregate queries)
- Convex MCP insights for function-level warning/error families

**Summary:**
Axiom aggregates corroborate the same hotspots seen in Convex insights and live incident operations. Error concentration is overwhelmingly in run `score_gen` request parse/error paths, with lower-volume rubric-stage errors and sporadic batch apply errors (`unknown`/`orchestrator_error`). Lifecycle aggregates show complete stage advancement and completion counts for the run cohort, matching final terminal state checks. This quantitative pass reduces remaining uncertainty that the Convex warning panel might be source-specific noise.

## Key quantified findings

1. **Run-stage distribution (5d window)**
- `run/score_gen/success`: 9,896
- `run/score_critic/success`: 8,366
- `run/score_gen/error`: 1,926
- `run/rubric_critic/error`: 252
- `run/rubric_gen/error`: 58

2. **Top error event classes (5d window)**
- `request_parse_error @ score_gen`: 1,352
- `request_error @ score_gen`: 551
- `request_error @ rubric_critic`: 233
- `batch_apply_error @ rubric_critic (unknown)`: 15
- `batch_apply_error @ score_gen (unknown)`: 10

3. **Lifecycle consistency checks**
- `run_started` count: 19
- `run_stage_advanced` to `rubric_critic`: 19
- `run_stage_advanced` to `score_gen`: 19
- `run_stage_advanced` to `score_critic`: 19
- `run_completed`: 19

4. **High-error run concentration**
- Biggest score_gen error concentrations are tied to known heavy runs already documented in incident snapshots.

## Residual blind spots

- `starredQueries:read` is still denied, so we cannot diff against your saved Axiom query library.
- This pass is aggregate-level; it does not yet include automated hourly drift/delta reporting.
