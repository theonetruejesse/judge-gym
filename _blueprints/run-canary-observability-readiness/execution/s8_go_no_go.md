# S8 Go / No-Go Decision

Date: 2026-03-04
Deployment: `ownDev` (`rightful-grouse-57`)

## Decision

- **GO** for controlled production-matrix canary runs.

## Gate results

1. Telemetry Integrity Gate: **PASS**
- Contiguous sequence/counter behavior verified.
- No duplicate/missing sequence numbers in canary traces.

2. Reset Safety Gate: **PASS**
- `deleteRunData` now blocks active runs by default.
- Explicit `allow_active=true` override required for destructive active-run deletion.

3. Start/Dispatch Wiring Gate: **PASS**
- Run start path, scheduler dispatch, and stage progression validated.

4. Canary (`target_count=1`) Gate: **PASS**
- Initial ordering defect fixed.
- Final canary shows `run_completed` terminal with `events_after_terminal=0`.

5. Canary (`target_count=4`) Gate: **PASS**
- 16/16 request success.
- No duplicate apply, no repeated finalization, no stuck work.

6. Intermediate (`target_count=10`) Gate: **PASS**
- 40/40 request success.
- Stable telemetry volume and zero stuck signals.

7. Recovery Drill Gate: **PASS**
- `autoHealProcess` dry-run/apply successfully resolved scheduler-not-running drill without manual mutation.

## Residual risks (known but acceptable for next stage)

- Throughput is currently job-route heavy for these canaries; batch-route behavior should still be re-validated under larger fanout.
- `getStuckWork` is threshold-sensitive for very fresh states; use alongside `getProcessHealth` and trace analysis.

## Required operating guardrails for next runs

- Keep using dry-run first for heal actions.
- Watch `terminal_stats.events_after_terminal`, duplicate apply counts, and repeated job finalization in `debug:analyze` / `packages/codex:analyzeProcessTelemetry`.
- Keep reset operations scoped to run IDs (avoid time-window telemetry deletion for active investigations).

## Evidence links

- `s1_telemetry_preflight.md`
- `s2_reset_safety.md`
- `s3_api_wiring_smoke.md`
- `s4_canary_target1.md`
- `s5_canary_target4.md`
- `s6_canary_target10.md`
- `s7_recovery_drill.md`
