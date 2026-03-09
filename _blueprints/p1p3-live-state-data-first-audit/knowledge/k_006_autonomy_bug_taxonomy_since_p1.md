# Autonomy bug taxonomy and patch prioritization (Since P1 launch)

**Confidence:** 0.88

**Sources:**
- `knowledge/k_002_run_failure_modes_evidence.md`
- `knowledge/k_003_observability_reliability_evidence.md`
- `knowledge/k_004_live_recovery_ledger_2026_03_08.md`
- `knowledge/k_005_cross_source_warning_concordance_2026_03_09.md`

**Summary:**
The strongest autonomy blockers are not random provider instability; they are systemic scaling pressure in stage reconciliation and observability write contention, plus expensive operator endpoints that degrade incident-response ergonomics. During the completed P1/P3 batch, explicit reconcile + scheduler nudges restored progress, confirming the control loop can work, but the system is not yet self-sufficient under heavy fanout. The patch plan should prioritize bounded stage-progress computation and low-contention observability writes first, then harden operator tools and summary endpoints.

## Ranked Bugs

1. **P0 — Stage-boundary reconcile overload**
   - Symptom: settled stages with large downstream pending, reconcile timeouts/errors.
   - Evidence: recurring `reconcileRunStage` read-limit warnings/errors + ledger snapshots.
   - Impact: direct risk of stuck `running` runs without manual intervention.

2. **P0 — Observability write hotspot contention**
   - Symptom: high OCC retries/fails in `process_observability` during `applyRequestResult` / `handleRequestError` / telemetry writes.
   - Impact: retry churn, elevated latency, noisy failure surface.

3. **P1 — Recovery tool scalability limits (`autoHealProcess`)**
   - Symptom: read-limit/timeouts when backlog is high.
   - Impact: manual recovery exists but is unreliable at peak load.

4. **P1 — Heavy reporting/debug endpoint read amplification (`lab:*`, `getStuckWork`)**
   - Symptom: frequent read/doc-limit warnings.
   - Impact: operator visibility degrades precisely when needed; can mislead state interpretation.

5. **P2 — Scheduler perception gap**
   - Symptom: lock often `idle` between ticks while work still advances.
   - Impact: false-positive concern; requires better explicit liveness UX, but less core than P0/P1.

## Verification Anchors (from completed batch)

- Batch finalized with `activeCount=0`, `completedCount=18` after repeated monitor/reconcile loop.
- Manual reconcile remained effective, proving orchestration correctness exists but needs autonomous scaling guardrails.
