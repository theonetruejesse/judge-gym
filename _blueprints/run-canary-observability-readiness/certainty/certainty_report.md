# Certainty Report

Scale: `0.00` (very low certainty) to `1.00` (very high certainty)

## Evidence Scores
- `k_001`: `0.83` (strong coverage; fail-open telemetry + approximation visibility gap)
- `k_002`: `0.86` (idempotency/lease/retry coverage strong)
- `k_003`: `0.82` (canary ladder practical but not fully scale-representative)
- `k_004`: `0.84` (preservation boundaries clear; scan/safety caveats)
- `k_005`: `0.81` (Convex constraints align; operational setup dependency)

## Hypothesis Scores
- `h_A_01_001`: `0.76` (passed null challenge)
- `h_A_02_001`: `0.62` (failed null challenge; scale-risk ranking uncertain)
- `h_A_03_001`: `0.58` (failed null challenge; 1->4 alone insufficient)
- `h_A_04_001`: `0.66` (directionally right; safety/perf guardrails needed)
- `h_A_05_001`: `0.79` (passed null challenge; docs support)

## Step Scores
- `S1` Telemetry preflight and integrity baseline: `0.86`
- `S2` Reset boundaries and preservation workflow: `0.74`
- `S3` Canary API wiring: `0.84`
- `S4` Canary smoke run (`target_count=1`): `0.88`
- `S5` Canary medium run (`target_count=4`): `0.81`
- `S6` Canary intermediate scale run (`target_count=10`): `0.77`
- `S7` Recovery-path drill with safe auto-heal: `0.85`
- `S8` Go/No-Go gate for full matrix: `0.80`
