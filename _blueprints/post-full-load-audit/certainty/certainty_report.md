# Certainty Report

## Evidence Scores
- `k_001_convex_terminal_state`: 0.92 — direct Convex aggregates and summaries agree.
- `k_002_axiom_failure_pattern`: 0.95 — Axiom counts cleanly isolate the dominant failure class.
- `k_003_recovery_gap`: 0.96 — direct health + heal evidence demonstrates the gap.
- `k_004_attempt_model_mismatch`: 0.88 — table snapshots are clear, though the redesign implications remain a judgment call.

## Step Scores
- `S1` isolate provider-timeout vs engine-recovery failure: 0.95
- `S2` patch stuck detection for retryable-no-transport: 0.93
- `S3` add automatic requeue path for stranded retryables: 0.91
- `S4` harden score apply path OCC around `sample_score_targets`: 0.81
- `S5` normalize batch/job attempt semantics to `attempt_index`: 0.87
