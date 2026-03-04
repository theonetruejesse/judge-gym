# Certainty Report

## Evidence Scores
- k_001_window_apply_duplicate_branch: 0.96
- k_002_job_reentry_no_claim: 0.95
- k_003_patch_request_write_amplification: 0.95
- k_004_batch_finalizing_reentry_window: 0.72
- k_005_empirical_window_ab_baseline: 0.86
- k_006_convex_execution_model_constraints: 0.79

## Hypothesis Scores
- h_A_job_reentry_001: 0.85
- h_A_request_idempotency_002: 0.91
- h_A_terminal_ordering_003: 0.38

## Step Scores
- S1 Add job claim lease for queued/running handlers: 0.90
- S2 Add CAS-style finalize guard + emit job_finalized only on transition: 0.88
- S3 Add request no-op patch guard + snapshot no-op guard: 0.92
- S4 Add apply idempotency guard in run/window apply handlers: 0.89
- S5 Adjust terminal/event ordering or policy: 0.62
- S6 Add A/B telemetry validation harness and gates: 0.94

## Notes
- Strongest confidence: missing job claim controls + unconditional patch/snapshot writes.
- Lowest confidence item: strict interpretation of post-terminal events as purely duplicate-handler artifacts.
