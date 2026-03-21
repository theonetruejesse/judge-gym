# Certainty Report

## Evidence Scores

- `k_001`: `0.87` — live snapshot directly captured the current cohort state and queue readiness
- `k_002`: `0.81` — code audit plus live symptom alignment strongly support the batch/apply brittleness diagnosis
- `k_003`: `0.84` — direct code inspection supports the projection/status-path diagnosis

## Hypothesis Scores

- `h_A_01_001`: `0.81` — strong enough to guide the current patch set, though not proof against every future batch reconciliation edge case

## Step Scores

- Patch retries/timeouts/status scoping now: `0.86`
- Defer deeper reconciler work until after next reset: `0.68`
