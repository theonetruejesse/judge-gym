# Certainty Report

## Evidence Scores
- k_001: 0.87 (Strong direct code-path grounding in scheduler/orchestrator services.)
- k_002: 0.85 (Retry behavior is explicit and consistent across job/batch paths.)
- k_003: 0.83 (Codex diagnostics are well-defined and partially validated by tests.)
- k_004: 0.79 (Synthetic harness exists; confidence depends on matrix quality.)
- k_005: 0.68 (Authoritative platform docs but not project-specific stress evidence.)
- k_006: 0.72 (Useful historical baselines; scenario drift risk remains.)

## Hypothesis Scores
- h_A_01_001: 0.77 (Likely true, but queue-age quantification still missing.)
- h_A_02_001: 0.66 (Plausible; severity depends on sustained limiter behavior.)
- h_A_03_001: 0.61 (Real but lower-frequency under snapshot-first paths.)
- h_A_04_001: 0.84 (Operationally useful, but falsifier flagged over-claim risk.)
- h_A_05_001: 0.80 (Well aligned with Convex limit-aware operations.)

## Step Scores
- S1 Matrix Definition: 0.90
- S2 Temp Synthetic Runner Script: 0.84
- S3 Core Execution Matrix: 0.82
- S4 Forced-Failure Matrix: 0.81
- S5 Recovery/Heal Matrix: 0.78
- S6 Diagnostics Limit-Proximity Matrix: 0.73
- S7 Rollout Gate And Canary: 0.78

## Lowest-Confidence Items
- k_005 (0.68): needs project-local high-volume measurements.
- h_A_03_001 (0.61): needs explicit parity measurement between health summary and full scans.
- h_A_02_001 (0.66): needs sustained limiter-deny simulation results.
