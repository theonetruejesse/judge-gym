# Certainty Report

## Evidence Scores
- `k_001_scheduler_liveness_evidence.md`: 0.89 (historical but still consistent with ledger timeline)
- `k_002_run_failure_modes_evidence.md`: 0.9 (strong overlap with insights + live behavior)
- `k_003_observability_reliability_evidence.md`: 0.92 (repeated endpoint behavior)
- `k_004_live_recovery_ledger_2026_03_08.md`: 0.96 (primary incident chronology)
- `k_005_cross_source_warning_concordance_2026_03_09.md`: 0.93 (source agreement matrix)
- `k_006_autonomy_bug_taxonomy_since_p1.md`: 0.88 (derived prioritization from evidence)

## Hypothesis Scores
- `h_A1_001`: 0.83
- `h_A2_001`: 0.82
- `h_A3_001`: 0.91
- `h_A4_001`: 0.84
- `h_A5_001`: 0.9

## Step Scores
- `S1` Reconcile-path bounded progress reads: 0.86
- `S2` Observability write-path contention reduction: 0.79
- `S3` Recovery/debug path bounded scans and chunked heal: 0.85
- `S4` Lab summary endpoint bounded aggregation refactor: 0.82
- `S5` Autonomous canary + overload acceptance gates: 0.8

## Lowest-Confidence Items
- Exact minimal telemetry-write set that preserves debugging fidelity while materially reducing OCC on `process_observability`.
- Optimal chunk sizing strategy for `autoHealProcess` under mixed score/rubric backlog distributions.
