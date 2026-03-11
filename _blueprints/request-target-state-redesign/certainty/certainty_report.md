# Certainty Report

## Evidence Scores
- `k_001_attempt_log_semantics.md`: 0.92 — Retry creation paths and per-request artifact references strongly support the attempt-log reading.
- `k_002_target_snapshot_semantics.md`: 0.95 — The schema and refresh logic clearly show a derived snapshot with no explicit success/resolution field.
- `k_003_consumer_contracts.md`: 0.90 — The main consumer surfaces are easy to trace and show a consistent split between target-truth needs and history-heavy diagnostics.
- `k_004_reasoning_field_value.md`: 0.88 — Repo search strongly suggests low value, but this does not rule out undocumented external consumers.

## Hypothesis Scores
- `h_A_01_001`: 0.62 — Correct directionally, but too strong as originally phrased because the current system still derives target snapshots from request rows and some window logic reads raw requests directly.
- `h_A_02_001`: 0.88 — Strongly supported as a redesign goal, with the caveat that multiple consumers must be rewritten together.
- `h_A_03_001`: 0.95 — Strong local evidence that removing `assistant_reasoning` is safe.

## Step Scores
- `S1`: 0.95 — Remove `assistant_reasoning`.
- `S2`: 0.89 — Redesign `process_request_targets` around explicit current-target resolution.
- `S3`: 0.72 — Adapt `llm_request_repo` and retry/write semantics to maintain the new target snapshot correctly.
- `S4`: 0.87 — Update `codex` and `lab` to separate target truth from attempt history.
- `S5`: 0.74 — Update window consumers that still infer state from raw `llm_requests`.
- `S6`: 0.90 — Validate with focused tests, destructive reset, and canary reruns.
