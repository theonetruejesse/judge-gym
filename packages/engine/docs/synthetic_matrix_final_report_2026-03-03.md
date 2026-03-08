# Synthetic Matrix Final Report (2026-03-03)

## Scope

Executed low-sample synthetic matrix with nuke-before/after each scenario and telemetry capture (`getProcessHealth`, `analyzeProcessTelemetry`, `getRunDiagnostics`).

Phases executed:
- baseline (no injected faults)
- parse fault 20%
- parse fault 50%
- rate-limit deferral 20%

## Report Artifacts

- Baseline: `packages/engine/docs/synthetic_matrix_report_2026-03-03.md`
- Parse 20%: `packages/engine/docs/synthetic_matrix_parse20_2026-03-03.md`
- Parse 50%: `packages/engine/docs/synthetic_matrix_parse50_2026-03-03.md`
- Rate-limit 20% (final): `packages/engine/docs/synthetic_matrix_ratelimit20_retry2_2026-03-03.md`

## Key Outcomes

### 1) Baseline

- `window_job_baseline`: completed cleanly, `route=job`, `events_after_terminal=0`, `duplicate_apply_success_total=0`.
- `window_batch_baseline`: completed cleanly, `route=batch`, `events_after_terminal=0`, `duplicate_apply_success_total=0`.
- `window_scheduler_recovery`: auto-heal dry-run/apply both planned `start_scheduler_if_idle`; completed cleanly.
- `run_mixed_baseline`: completed with expected mixed transport behavior:
  - rubric stages: job
  - score_gen: job-heavy / mixed
  - score_critic: batch
  - invariants held (`duplicate_apply_success_total=0`, no repeated job finalization).

### 2) Parse Fault 20%

- Window case produced expected partial continuation:
  - stage `l1`: batch route with errors
  - stages `l2`/`l3`: dropped below batch threshold and switched to job route
  - terminal status `completed` with reduced artifact counts (`l1=23`, `l2=22`, `l3=18` out of 30).
- Run case completed with substantial parse-failure evidence persisted:
  - many `synthetic_parse_error_injected` rows retained
  - score stage continued and terminalized without duplicate-apply anomalies.

### 3) Parse Fault 50%

- Window stress case completed with heavy attrition but no orchestration break:
  - `l1_completed=11`, `l2_completed=6`, `l3_completed=5` out of 30
  - route became mixed (batch first, then job)
  - `events_after_terminal=0`, `duplicate_apply_success_total=0`.

### 4) Rate-limit Deferral 20%

- First attempt exposed an injector bug: deterministic keying could permanently defer the same request.
- Patched injection keying to include mutable scheduling/time components so deferral eligibility changes over time.
- Re-run completed successfully:
  - window case finished (slower polling cadence and longer stage durations, but terminalized)
  - run case finished all stages (`score_gen=48/48`, `score_critic=48/48`) with no duplicate-apply issues.

## Bugs Found And Fixed During This Pass

1. **Matrix runner recovery parsing bug**
- Symptom: crash on `autoHealProcess` shape mismatch (`actions` vs `planned_actions`).
- Fix: support both response shapes.

2. **Rate-limit injector permanent deferral bug**
- Symptom: some requests could be deferred forever under synthetic rate-limit mode.
- Fix: include mutable scheduling/time entropy in synthetic deferral key, preventing permanent lockout.

## Invariant Summary

Across completed scenarios:
- No duplicate apply regressions (`duplicate_apply_success_total=0` in analyzed outputs).
- No repeated job-finalization churn (`jobs_finalized_multiple_times=0` in analyzed outputs).
- Window terminal-ordering remained clean (`events_after_terminal=0`).
- Run traces still showed small post-terminal tail (`events_after_terminal=2`) from non-stage-advancing trailing events; no regression in completion correctness was observed.

## Current Engine State

- Synthetic fault knobs restored to safe default:
  - `parse_failure_rate=0`
  - `rate_limit_deferral_rate=0`
- Typecheck passes.

## Recommendation Before Evidence-Flow Rollout

- Proceed to evidence-flow canary with current orchestration.
- Keep `debug:matrix` script and reports as regression harness.
- If needed, add an explicit metric for queue-age percentiles to quantify bounded-backpressure behavior (currently inferred from stage durations and polling counts).
