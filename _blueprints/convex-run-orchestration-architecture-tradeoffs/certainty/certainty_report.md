# Certainty Report

## Scope and Method

This scoring pass is independent and evidence-locked.
No new evidence was collected. Scores are based only on:
- `knowledge/*.md`
- `hypotheses/*.json`
- `null_challenges/*.json`

Scoring heuristic (0.0-1.0):
- Higher score: direct local-code grounding, primary-source docs, precise constraints, and null-challenge resilience.
- Lower score: unresolved operational unknowns, strong falsification results, or missing empirical validation.

## Evidence Scores

- `k_A1_evidence.md`: **0.70**
  - Strong grounding in local code + Convex docs for payload/lease/contention risks, but null challenge shows key claims are partially over-optimistic (chunking alone not sufficient; determinism risk material).

- `k_A2_evidence.md`: **0.80**
  - Well-scoped feasibility assessment with explicit platform caps and concrete migration blast-radius discussion; uncertainty mainly around production burst profile and observability dependencies.

- `k_A3_evidence.md`: **0.72**
  - Correctly identifies scan amplification and denormalized-counter fit, but falsification highlights hot-counter OCC risk and reconciliation scan cost as meaningful caveats.

- `k_A4_evidence.md`: **0.74**
  - Strong queue/lease/idempotency framing and local-code mapping; certainty reduced because expected gains depend heavily on shard/claim design and action-boundary atomicity controls.

- `k_A5_evidence.md`: **0.78**
  - Best synthesis of options and phased path with local anchors; reduced by determinism hazards during hybrid overlap and unproven throughput-multiplier assumptions.

## Hypothesis Scores

- `h_A1_001`: **0.50**
  - Null challenge failed this claim: payload chunking/reference loading is necessary but not sufficient due to workflow/state and function-limit failure modes.

- `h_A1_002`: **0.62**
  - Plausible incremental contention reduction via lease/patch tuning, but not directly null-challenged and still dependent on true hotspot distribution.

- `h_A1_003`: **0.44**
  - Null challenge failed this claim: determinism and retry-semantics caveats significantly weaken blanket workflow-first preference.

- `h_A2_001`: **0.52**
  - Null challenge failed under action scheduling semantics (non-atomic scheduling/at-most-once actions); correctness can hold only with stricter mutation-bound dispatch and explicit idempotency boundaries.

- `h_A2_002`: **0.86**
  - Null challenge passed and primary docs show hard limits; need for throttling/chunking under burst is high-certainty.

- `h_A2_003`: **0.63**
  - Operationally credible and consistent with evidence; reduced by unknown real dependence on workflow-specific observability today.

- `h_A3_map_reduce_counters_001`: **0.58**
  - Null challenge failed overall: counters likely reduce scans, but unmitigated hot-counter OCC and reconciliation costs make correctness/perf outcome conditional.

- `h_A4_001`: **0.49**
  - Null challenge failed overall: queue+lease model is sound in principle, but claim overstates duplicate-risk reduction/predictability without stronger atomicity, sharding, and dead-letter guarantees.

- `h_A5_001`: **0.61**
  - Hybrid strategy remains plausible but null challenge identifies two major risk downgrades (workflow determinism during overlap; uncertain 2x gains under platform ceilings).

## Step Scores (Inferred from Materials + Null Challenges)

- `S1 Baseline instrumentation (scheduler scans, stage-progress scans, contention metrics)`: **0.91**
  - Low-risk, directly actionable, and strongly supported across A1/A5 uncertainty gaps.

- `S2 Index-first query narrowing for stage/progress reads`: **0.82**
  - High-certainty improvement aligned with Convex index/read-limit guidance; moderate migration complexity.

- `S3 Introduce partitioned due-work queue table with claim/lease + idempotency keys`: **0.67**
  - Potentially high upside, but certainty depends on queue shard design, action-vs-mutation boundaries, and replay safety controls.

- `S4 Add transactional stage counters with reconciliation and optional sharding`: **0.61**
  - Likely read-scan reduction, but certainty reduced by hot-document OCC risk and dual-write drift during transition.

- `S5 Reduce central scheduler to watchdog/recovery role after queue path stabilizes`: **0.72**
  - Directionally sound once S2-S4 prove stable; certainty depends on preserving stuck-work detection and rollback switches.

## Lowest-Certainty Items (Priority Risk)

1. `h_A1_003` (0.44)
2. `h_A4_001` (0.49)
3. `h_A1_001` (0.50)
4. `h_A2_001` (0.52)

