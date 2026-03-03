# Blueprint: Convex Run Orchestration Architecture Tradeoffs

> This blueprint evaluates competing architectural options for run orchestration throughput/correctness in Convex and selects a phased implementation plan.
>
> Decision: use a **hybrid phased plan** that first removes scan/read amplification and payload-limit failure modes, then incrementally introduces partitioned queue execution and counters, and only then decides whether to remove workflow entirely.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/convex-run-orchestration-architecture-tradeoffs`
- **Research Question:** Evaluate architecture options for judge-gym run throughput/correctness in Convex and choose the most structurally sound implementation plan.
- **Scope:** run orchestration for `rubric_*` and `score_*` stages; scheduler/workflow/workpool behavior; batch/job/request state transitions; Convex limits; parallel run behavior.
- **Non-goals:** provider prompt quality tuning, lab UI changes, analysis-package modeling.
- **Constraints:** Convex platform limits, workflow component limits, existing production-safe behavior, incremental migration requirement.

---

## 1. Worldview Register

All assignments and artifacts are tracked in `worldview.json`.

- Evidence: `knowledge/k_A*_evidence.md`
- Hypotheses: `hypotheses/hyp_A*_v1_*.json`
- Null challenges: `null_challenges/nc_A*_challenge.json`
- Certainty: `certainty/certainty_report.md`

---

## 2. Evidence Ledger

- **A1 Workflow-heavy**: viable with strict payload constraints and lease/idempotency hardening, but determinism and 1 MiB workflow-step limits create operational risk. [knowledge/k_A1_evidence.md](knowledge/k_A1_evidence.md)
- **A2 Scheduler-only**: feasible and may reduce component complexity, but needs strong idempotency + throttling + observability replacement. [knowledge/k_A2_evidence.md](knowledge/k_A2_evidence.md)
- **A3 Map-reduce counters**: strongly reduces scan amplification, but introduces hot-counter OCC risk unless sharded/reconciled. [knowledge/k_A3_evidence.md](knowledge/k_A3_evidence.md)
- **A4 Queue/table-driven workers**: good structural model, but gains depend on shard/claim/idempotency design quality. [knowledge/k_A4_evidence.md](knowledge/k_A4_evidence.md)
- **A5 Hybrid migration**: best practical sequencing with lowest near-term risk, but overlap period introduces determinism/complexity risk. [knowledge/k_A5_evidence.md](knowledge/k_A5_evidence.md)

Critical direct platform evidence:
- Convex limits: <https://docs.convex.dev/production/state/limits>
- Scheduling semantics: <https://docs.convex.dev/scheduling/scheduled-functions>
- Workflow constraints: <https://github.com/get-convex/workflow>

---

## 3. Areas of Analysis (Competition)

| Area | Competing Idea | Evidence | Null Challenge Outcome |
| :--- | :--- | :--- | :--- |
| A1 | Keep workflow-centric orchestration | `k_A1_evidence.md` | Failed |
| A2 | Remove workflow; scheduler-only dispatch | `k_A2_evidence.md` | Mixed |
| A3 | Map-reduce stage counters | `k_A3_evidence.md` | Failed |
| A4 | Queue table + claim/lease workers | `k_A4_evidence.md` | Failed |
| A5 | Hybrid phased migration | `k_A5_evidence.md` | Failed |

Interpretation: null challenges mostly failed due over-strong claims, not because ideas are unusable. Architectures remain viable with stricter guardrails.

---

## 4. Micro-Hypotheses (Ranked by Certainty)

| Hypothesis | Statement (short) | Score |
| :--- | :--- | :--- |
| `h_A2_002` | Explicit throttling/chunking is mandatory under Convex limits | 0.86 |
| `h_A2_003` | Scheduler-only is operationally viable if observability is replaced | 0.63 |
| `h_A1_002` | Lease/patch tuning can reduce contention materially | 0.62 |
| `h_A5_001` | Hybrid phased migration is best risk-adjusted path | 0.61 |
| `h_A3_map_reduce_counters_001` | Counter-based progression reduces scans safely | 0.58 |
| `h_A2_001` | Scheduler-only preserves correctness with current guards | 0.52 |
| `h_A1_001` | Workflow-heavy is fine if payloads are chunked | 0.50 |
| `h_A4_001` | Queue pipeline alone improves predictability/duplicates | 0.49 |
| `h_A1_003` | Workflow-first remains broadly preferable | 0.44 |

Source: [certainty/certainty_report.md](certainty/certainty_report.md)

---

## 5. Structurally Sound Plan (Recommended)

### Summary
Use a **five-step phased architecture plan**:
1. Instrument and baseline.
2. Remove scan-heavy reads via indexed query narrowing.
3. Introduce partitioned due-work queue semantics with leases/idempotency.
4. Add stage counters with reconciliation and hotspot controls.
5. Demote global scheduler to watchdog; decide workflow retention/removal after measured stability.

This plan wins because it captures A2/A3/A4 throughput ideas while limiting correctness risk identified by null challenges.

---

## 6. Prebuilt Implementation Plan

### S1: Baseline Instrumentation
- **Objective:** quantify actual bottlenecks before structural rewrites.
- **Evidence:** [knowledge/k_A5_evidence.md](knowledge/k_A5_evidence.md), [knowledge/k_A2_evidence.md](knowledge/k_A2_evidence.md)
- **Inputs:** `scheduler.ts`, `run_orchestrator.ts`, telemetry tables.
- **Actions:**
  1. Add telemetry counters for per-tick read docs/bytes, due-work counts, claim-denied counts, stage-progress scan cost.
  2. Add run-level latency histograms (enqueue-to-apply, stage complete latency).
- **Outputs:** baseline report for p50/p95 throughput and contention.
- **Verification:** reproducible baseline from 3 identical runs, including concurrent-run case.
- **Risks/Assumptions:** instrumentation overhead stays low.
- **Confidence:** 0.91

### S2: Index-First Query Narrowing
- **Objective:** eliminate global status scans from hot paths.
- **Evidence:** [knowledge/k_A3_evidence.md](knowledge/k_A3_evidence.md), [knowledge/k_A2_evidence.md](knowledge/k_A2_evidence.md)
- **Inputs:** `schema.ts`, `run_orchestrator.ts`, request state lookup paths.
- **Actions:**
  1. Add run/stage-scoped request indexing strategy (or explicit stage/run fields with indexes).
  2. Replace `by_status.collect()+filter` patterns with bounded index ranges.
- **Outputs:** reduced per-mutation reads in stage progress/pending-target logic.
- **Verification:** p95 read-bytes drops >=40% at same workload.
- **Risks/Assumptions:** migration keeps key semantics backward compatible.
- **Confidence:** 0.82

### S3: Partitioned Due-Work Queue + Claims
- **Objective:** convert global dispatch into bounded shard dispatch.
- **Evidence:** [knowledge/k_A4_evidence.md](knowledge/k_A4_evidence.md), [knowledge/k_A5_evidence.md](knowledge/k_A5_evidence.md)
- **Inputs:** scheduler/workflow dispatch paths, batch/job lease model.
- **Actions:**
  1. Create due-work queue abstraction (run unit rows or equivalent shard partitions).
  2. Claim work via OCC-guarded lease with receive-count and dead-letter policy.
  3. Enforce idempotency keys on external side-effect boundaries.
- **Outputs:** stable queue depth, predictable claim behavior under concurrency.
- **Verification:** duplicate terminal transitions decrease; no stranded units under failure injection.
- **Risks/Assumptions:** shard key avoids hotspots.
- **Confidence:** 0.67

### S4: Stage Counters + Reconciliation
- **Objective:** reduce completion checks from scan-based to incremental.
- **Evidence:** [knowledge/k_A3_evidence.md](knowledge/k_A3_evidence.md), [null_challenges/nc_A3_challenge.json](null_challenges/nc_A3_challenge.json)
- **Inputs:** run stage transitions, request outcome handlers.
- **Actions:**
  1. Add transactional per-stage counters (`pending/success/failed`) with guarded transitions.
  2. Add background reconciliation and optional counter sharding.
- **Outputs:** O(1)-style stage-completion checks with drift detection.
- **Verification:** stage progression correctness matches baseline test suite + replay tests.
- **Risks/Assumptions:** hotspot OCC retries remain bounded.
- **Confidence:** 0.61

### S5: Scheduler as Watchdog + Workflow Decision Gate
- **Objective:** simplify steady-state orchestration and choose final component strategy based on data.
- **Evidence:** [knowledge/k_A2_evidence.md](knowledge/k_A2_evidence.md), [knowledge/k_A5_evidence.md](knowledge/k_A5_evidence.md), [null_challenges/nc_A1_challenge.json](null_challenges/nc_A1_challenge.json)
- **Inputs:** post-S1..S4 operational metrics.
- **Actions:**
  1. Reduce central scheduler duties to orphan/stuck-work recovery and periodic audits.
  2. Hold architecture gate: keep workflow-lite or migrate fully scheduler-only based on measured failure/latency profile.
- **Outputs:** final architecture decision record with rollback plan.
- **Verification:** two-week burn-in with no stage stalls and acceptable error budget.
- **Risks/Assumptions:** observability parity maintained if workflow surface shrinks.
- **Confidence:** 0.72

---

## 7. Validation Gates

1. **Evidence gate:** every step cites at least one evidence artifact.
2. **Falsification gate:** all high-impact hypotheses have null challenges.
3. **Correctness gate:** no duplicate terminal transitions; no stuck pending units beyond SLO.
4. **Performance gate:** read bytes + stage latency trend down; throughput trend up.
5. **Rollback gate:** each phase has reversible toggles.

---

## 8. Open Questions

- What concrete throughput target defines success (requests/min, concurrent runs)?
- Best shard key for due-work partitioning (`run_id`, `experiment_id`, or time bucket)?
- How much workflow-level observability is currently relied upon operationally?
- Should counters be sharded from day one or after hotspot evidence?

---

## Appendix: Artifacts and Sources

- Evidence: `knowledge/k_A1_evidence.md`, `knowledge/k_A2_evidence.md`, `knowledge/k_A3_evidence.md`, `knowledge/k_A4_evidence.md`, `knowledge/k_A5_evidence.md`
- Hypotheses: `hypotheses/hyp_A*_v1_*.json`
- Null challenges: `null_challenges/nc_A*_challenge.json`
- Certainty report: `certainty/certainty_report.md`
- External primary sources:
  - <https://docs.convex.dev/production/state/limits>
  - <https://docs.convex.dev/scheduling/scheduled-functions>
  - <https://docs.convex.dev/functions/actions>
  - <https://docs.convex.dev/database/advanced/occ>
  - <https://github.com/get-convex/workflow>
