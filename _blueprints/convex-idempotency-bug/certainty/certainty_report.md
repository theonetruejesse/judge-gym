# Certainty Report

## Evidence Scores
- k_001: 0.72 (direct code trace from startExperiment to startRunFlow and scheduler)
- k_002: 0.74 (direct orchestration logic in BaseOrchestrator)
- k_003: 0.73 (scheduler/workflow code shows no explicit lock)
- k_004: 0.78 (apply path clearly inserts without guards)
- k_005: 0.67 (workflow replay and retry semantics are clear, impact magnitude uncertain)
- k_006: 0.64 (batch retry creates new requests with same custom_key)

## Hypothesis Scores
- h_orch_001: 0.72 (strong evidence that apply is non-idempotent)
- h_sched_001: 0.60 (overlap plausible but needs runtime confirmation)
- h_wf_001: 0.50 (action retries can contribute but unclear frequency)

## Step Scores
- S1: 0.65 (telemetry will validate causal chain)
- S2: 0.72 (guards are straightforward and effective)
- S3: 0.60 (schema change is heavier but robust)
- S4: 0.52 (locking requires careful concurrency design)
- S5: 0.58 (tests are feasible but may be tricky to simulate)
