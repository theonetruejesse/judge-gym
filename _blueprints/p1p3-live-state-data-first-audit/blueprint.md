# Blueprint Extension: Cross-source Warning Concordance and Autonomy Patch Plan

This extension confirms that Convex Insights warning/error signals are aligned with our MCP + incident-ledger observations, then converts that evidence into a decision-complete autonomy-hardening plan. This is research/spec only; no runtime code mutations are included.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/p1p3-live-state-data-first-audit`
- **Extension Objective:** Validate warning-source consistency and surface patch-ready autonomy bugs.
- **Analysis Window:** Since P1 launch.
- **Classification Policy:** Separate **core autonomy bugs** from **operator/tooling reliability bugs**.
- **Current terminal state anchor:** `activeCount=0`, `completedCount=18` in latest bounded run scan.

---

## 1. Evidence Set

- `knowledge/k_004_live_recovery_ledger_2026_03_08.md`
- `knowledge/k_005_cross_source_warning_concordance_2026_03_09.md`
- `knowledge/k_006_autonomy_bug_taxonomy_since_p1.md`
- Legacy supporting evidence: `k_001`, `k_002`, `k_003`

---

## 2. Bug Inventory (ranked)

### Core autonomy bugs (implementation priority)
1. **P0:** `reconcileRunStage` scaling/read pressure at stage boundaries.
2. **P0:** high OCC contention on `process_observability` during hot-path writes.
3. **P1:** recovery-path scalability gaps in `autoHealProcess` under backlog.

### Operator/tooling reliability bugs (separate track)
4. **P1:** read-heavy lab summary/list endpoints (`listExperiments`, `getRunSummary`, `getExperimentSummary`).
5. **P1:** read-heavy global stuck-work scans (`getStuckWork`).
6. **P2:** scheduler liveness perception gap (lock/tick semantics vs UI expectations).

---

## 3. Patch-ready Implementation Plan

### S1 — Stage-boundary reconcile hardening (P0)
- Refactor run-stage progress/reconcile queries to be fully bounded and stage-local.
- Eliminate remaining global request scans in reconcile paths; prefer process-scoped target snapshots/indexes.
- Add explicit stage-boundary counters for: settled, advanced, deferred, and reconcile-failed.
- **Verification:** under synthetic fanout, no read-limit/timeouts in reconcile; stage transitions complete without manual kick for equivalent load.

### S2 — Observability contention reduction (P0)
- Split hot-path observability writes into minimal critical path vs deferred enrichment path.
- Coalesce repeated state updates to `process_observability` by key/time bucket.
- Add backpressure-safe write guards (drop/reduce non-critical duplicate updates under contention).
- **Verification:** materially lower OCC retry counts for `recordProcessObservability` and `applyRequestResult` while preserving debugging signal integrity.

### S3 — Recovery path scaling (P1)
- Redesign `autoHealProcess` as chunked, resumable execution:
  - fixed caps per pass,
  - continuation cursor,
  - per-action result ledger.
- Keep default dry-run + apply parity, but ensure apply cannot exceed scan limits in one call.
- **Verification:** large-backlog heal completes in bounded multiple passes; no single-pass read-limit failure.

### S4 — Operator reporting path hardening (P1)
- Refactor lab summary/list endpoints to use low-cost aggregates and run-scoped indexes only.
- Add "heavy-mode" guardrails and fallback summaries instead of hard failures when nearing limits.
- **Verification:** dashboards remain queryable during active high-fanout runs without bytes/doc-limit errors.

### S5 — Autonomous safety gates and runbook closure (P1/P2)
- Add autonomous progression checks:
  - if stage settled + next stage pending + no transport for threshold, trigger bounded reconcile.
  - if reconcile deferred/fails, enqueue safe recovery action and emit explicit operator signal.
- Add acceptance gate that blocks "autonomous" label unless end-to-end run completion succeeds without manual reconcile/heal.
- **Verification:** canary workload completes with zero manual interventions and clear telemetry for all automatic recoveries.

---

## 4. Test and Acceptance Matrix

1. **Load-stage boundary test:** score_gen -> score_critic transition under high fanout without manual reconcile.
2. **Observability OCC test:** compare OCC retry volumes before/after S2 at matched load.
3. **Recovery chunk test:** `autoHealProcess` handles large backlog in deterministic bounded passes.
4. **Operator endpoint resilience test:** lab summary/list + stuck-work queries remain below read limits during active runs.
5. **Autonomy canary test:** full run lifecycle completes with no manual startScheduler/reconcile/heal calls.

All five must pass before calling the system fully autonomous.

---

## 5. Incident Report Registry

Primary incident chronology and live-loop operations are recorded in:
- `knowledge/k_004_live_recovery_ledger_2026_03_08.md`

Cross-source sanity-check extension is recorded in:
- `knowledge/k_005_cross_source_warning_concordance_2026_03_09.md`
- `knowledge/k_006_autonomy_bug_taxonomy_since_p1.md`
