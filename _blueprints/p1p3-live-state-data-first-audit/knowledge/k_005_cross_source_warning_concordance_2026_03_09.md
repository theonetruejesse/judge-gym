# Cross-source warning/error concordance (Since P1 launch)

**Confidence:** 0.93

**Sources:**
- Convex MCP: `mcp__convex__insights` (development deployment `rightful-grouse-57`)
- Convex MCP: `packages/codex:getProcessHealth` and direct `runs`/`_scheduled_functions` reads
- Incident ledger: `knowledge/k_004_live_recovery_ledger_2026_03_08.md`

**Summary:**
Convex Insights critical/warning families are consistent with both MCP process health observations and the live incident ledger. The main concordant classes are: (1) read-limit pressure in `domain/runs/run_service:reconcileRunStage`, `packages/codex:getStuckWork`, `packages/codex:autoHealProcess`, and `packages/lab:*` summary endpoints; (2) OCC retry/fail pressure concentrated on `process_observability`, `llm_requests`, and scheduler mutation pathways; and (3) transient timeout/internal-error behavior during boundary reconcile spikes. This aligns with the operational pattern observed during the batch: scheduler was generally recoverable, stage-boundary advancement intermittently required explicit reconcile, and high-cost diagnostic/reporting surfaces were less reliable than bounded per-run health reads.

## Concordance Matrix

| Warning/Error family | Convex Insights | MCP process/direct tables | Incident ledger (k_004) | Concordance |
| :-- | :-- | :-- | :-- | :-- |
| `reconcileRunStage` read-limit pressure | Repeated bytes/doc read-limit entries | Boundary reconcile calls intermittently timed out/errored under load | Snapshots F/H/O documented repeated reconcile failures/timeouts | High |
| `getStuckWork` read/doc-limit pressure | Repeated limit hits with `_scheduled_functions` + `llm_requests` heavy scans | Not required for core live loop; direct reads remained usable | Earlier plan explicitly avoided this endpoint at peak load | High |
| `autoHealProcess` read-limit pressure | Read-limit and OCC entries present | Dry-run/apply sometimes succeeded, sometimes timed out/limit-hit | Snapshots C/D/E/F/O captured same mixed reliability | High |
| `packages/lab:getRunSummary/getExperimentSummary/listExperiments` read pressure | Repeated bytes/doc-limit warnings/errors | Bounded alternatives (`getProcessHealth`, direct run rows) stable | Existing blueprint switched ops lane away from heavy lab summaries | High |
| Scheduler OCC conflict noise (`startScheduler`) | OCC retried/failed signals exist | Scheduler lock often `idle` between ticks while progress continued | Multiple intervals showed progress after scheduler kicks | Medium-High |
| Telemetry contention (`recordProcessObservability`, `applyRequestResult` OCC retries) | High OCC retry counts on `process_observability` | Core run progress still possible but noisy | Repeatedly surfaced as background contention | High |

## Core-vs-Operator Classification

- **Core autonomy path (P0/P1):**
  - `domain/runs/run_service:reconcileRunStage`
  - `domain/runs/run_service:applyRequestResult`
  - telemetry write-path contention affecting run throughput (`recordProcessObservability`)
- **Operator/tooling path (separate reliability class):**
  - `packages/lab:listExperiments`
  - `packages/lab:getRunSummary`
  - `packages/lab:getExperimentSummary`
  - `packages/codex:getStuckWork`
  - `packages/codex:autoHealProcess` (operator recovery tool, but impacts live operability)
  - `domain/maintenance/danger:nukeTables` (intentionally heavy maintenance)
