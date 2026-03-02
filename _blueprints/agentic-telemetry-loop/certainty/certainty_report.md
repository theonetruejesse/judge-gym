# Certainty Report

## Evidence Scores
- k_001: 0.86 (direct stage-ordering implementation evidence)
- k_002: 0.82 (routing/scheduler behavior is clear in code)
- k_003: 0.91 (strong direct evidence of missing append-only event model)
- k_004: 0.85 (correlation key strategy is explicit and stable)
- k_005: 0.88 (retry lineage gap is concrete and relevant)
- k_006: 0.80 (idempotent guards confirmed, coverage depth uncertain)
- k_007: 0.83 (tests exist, live path is env-gated)
- k_008: 0.89 (analysis export gap is concrete)
- k_009: 0.78 (docs-based limits are context-dependent by plan/config)
- k_010: 0.90 (OTel value/complexity tradeoff is well-supported)

## Hypothesis Scores
- h_A_exec_graph_001: 0.90 (strong support from current observability gap and architecture)
- h_A_tooling_001: 0.81 (logs-only insufficiency is likely true for historical/causal debugging)
- h_A_tooling_002: 0.87 (phased internal-first approach has strong pragmatic fit)
- h_A_agentic_001: 0.72 (feasible but weakened by current export and determinism gaps)

## Step Scores
- S1 (event taxonomy + schema): 0.94 (high confidence, low risk)
- S2 (wrapper/helper layer): 0.90 (high leverage, manageable complexity)
- S3 (choke point instrumentation): 0.88 (high value, moderate implementation risk)
- S4 (trace queries + lineage views): 0.84 (valuable, depends on event completeness)
- S5 (metrics aggregations): 0.79 (depends on indexing and event volume)
- S6 (agentic runbook/protocol): 0.86 (operationally straightforward after S1-S4)
- S7 (deterministic telemetry assertions in E2E tests): 0.74 (async flakiness risk)
- S8 (optional OTel bridge): 0.92 (clear optional phase with low immediate risk)

## Low-Confidence Warnings
- `h_A_agentic_001` / `S7` have the most uncertainty due to async nondeterminism and live-test constraints.
- `S5` needs disciplined indexing/retention policy to avoid performance regressions.
- `k_009` depends on actual Convex plan/features and team log-stream setup.
