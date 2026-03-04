# V3 - OpenAI Comprehensive (Run-Ready Spec)

This document is the active execution spec for v3. It integrates findings from:
- `pilots/v1_distribution_exploration.md`
- `pilots/v2_engine_prototype_testing.md`
- `paper.md`
- current engine constraints (`AGENTS.md`, `README.md`, `packages/engine/convex/settings.ts`)

## 1. Core Objective

Validate whether adjudicative geometry differences in GPT-series models are stable, and isolate likely mechanism classes with prioritized ablations.

Primary output is a descriptive geometry map, not a causal claim.

Scoring prompt framing is treated as a fixed default in v3 (not an ablation axis).

## 2. What v1/v2 imply for v3

1. Geometry divergence is real enough to replicate at higher quality controls.
2. Compression-like behavior in GPT-5.2-chat was observed, but mechanism is unresolved.
3. Largest interpretability gaps are still:
   - rubric mechanism contribution,
   - forced-choice inflation magnitude,
   - sensitivity to semantic evidence level and rubric scale.
4. Operationally, large sweeps must be staged with strict canary gates and recovery runbook.

## 3. Research Questions and Decision Thresholds

## RQ1: Does compression-like geometry reproduce in GPT-5 variants?

- **Metric family:** mid-range occupancy, stage entropy, abstention mass.
- **Decision threshold:** reproduce low-mid occupancy + high stage-1/abstain concentration in at least one GPT-5 condition relative to GPT-4.1 baseline under same evidence.

## RQ2: How much is rubric mechanism vs model mechanism?

- **Ablation:** rubric swap across high-divergence pairs.
- **Decision threshold:** if geometry remains largely model-attached after swap, prioritize model-internal explanation over rubric mechanism.

## RQ3: Is forced-choice inflating disagreement in this setup?

- **Ablation:** `abstain_enabled=true` vs `abstain_enabled=false` (holding method/randomizations fixed).
- **Decision threshold:** if forced-choice materially shifts geometry and divergence metrics, carry this as a first-class interpretation caveat.

## RQ4: How sensitive is geometry to semantic evidence level and rubric scale?

- **Ablation:** semantic level (`evidence_view`) and rubric stage count (`scale_size`).
- **Decision threshold:** if geometry shifts materially across semantic level or scale, treat these as mandatory controls for all model comparisons.

## 4. Current Engine Constraints (must-hold)

From `ENGINE_SETTINGS` and runbook:
- `max_batch_size: 100`
- `min_batch_size: 25`
- `max_batch_retries: 2`
- `max_request_attempts: 2`
- `retry_backoff_ms: 60_000`
- `job_request_concurrency: 8`

Operational assumptions:
- Native Convex scheduler orchestration (no workpool in hot path).
- Use bounded diagnostics and dry-run-first recovery.
- Treat telemetry sequence IDs as non-contiguous by design.

## 5. Experimental Scope (v3)

## Concepts

| ID | Concept | Contestation |
| :-- | :-- | :-- |
| C1 | fascism | high |
| C2 | democratic backsliding | medium |
| C3 | democratic quality | lower |

## Evidence Windows (near-term production plan)

| Window | Date Range | Procedure | Target Evidence |
| :-- | :-- | :-- | --: |
| W1 | 2026-01-01 to 2026-01-07 | 10 queries, fetch 10/query, sample 2/query | 20 |

Total initial evidence pool: `20`.

Query set for W1 (10 total): elections, courts, rule of law, civil liberties, media freedom, executive authority, legislative conflict, political violence, immigration enforcement, foreign policy.

## Models (GPT-only v3)

| ID | Model |
| :-- | :-- |
| M1 | gpt-4.1 |
| M2 | gpt-4.1-mini |
| M3 | gpt-5.2-chat |
| M4 | gpt-5.2 |

## Sampling defaults

- Rubrics per `(model, concept)`: `30`.
- Score samples per `(rubric, evidence)`: `1`.
- Randomizations: use the experiment's configured default randomization set as baseline.

## 6. Phased Execution Plan

## Phase 0: Preflight (required)

1. Confirm telemetry/debug loop commands work:
   - `bun run debug:watch`
   - `bun run debug:analyze`
   - `bun run debug:stuck`
   - `bun run debug:heal`
2. Confirm synthetic fault knobs are off (if present): all zero.
3. Run a tiny single-run canary (`target_count=1`) and verify full stage completion.

Pass criteria:
- No persistent queued/running targets > 2 poll intervals after provider completion.
- No retry explosion patterns.

## Phase 1: Stability canary

- Start with one concept (`C1`) across `M1` and `M3`, `target_count=4`.
- Run baseline config only (including your default randomization settings).

Pass criteria:
- Completion without manual destructive interventions.
- Retry counts remain bounded by policy.
- Telemetry order appears sane (no terminal-after-terminal churn loops).

## Phase 2: Geometry replication pass

- Full model set (`M1..M4`), one concept (`C1`), `target_count=10`.
- Goal: verify GPT-series geometry separation reproduces at this scale.

Pass criteria:
- Expected request cardinality and completion counts match run plan.
- No orphan growth or infinite scheduler churn.

## Phase 3: Priority ablations (in order)

1. **Abstain Ablation:** abstain-enabled vs non-abstain.
2. **Semantic Level Ablation:** `evidence_view` across `l2_neutralized`, `l3_abstracted`.
3. **Rubric Scale Ablation:** vary `scale_size` as `4` vs `7`.
4. **Rubric Swap:** high-divergence pair swaps (start `M1 <-> M3`).

Only proceed to next ablation if current one completes with stable ops metrics.

## Phase 4: Full v3 matrix launch

Run full concept set (`C1..C3`) after all prior gates pass.

## 7. Ablation-to-Metric Mapping

| Ablation | Primary Metrics | Secondary Metrics | Why it matters |
| :-- | :-- | :-- | :-- |
| Abstain-enabled vs non-abstain | stage occupancy shift, divergence change | retry/error profiles | tests forced-choice inflation risk |
| Semantic cleaning level (`evidence_view`) | stage occupancy and divergence by level | certainty distribution, abstention rate | tests robustness to evidence representation |
| Rubric scale (`scale_size=4` vs `7`) | mid-range occupancy, entropy | certainty slope by stage, midpoint occupancy | tests scale-induced geometry artifacts and midpoint behavior |
| Rubric swap | divergence persistence after swap | certainty shift, disagreement concentration | tests framework sensitivity vs model-internal behavior |

## 8. Telemetry and Ops Coverage for each run

For each run, capture:
1. Stage-level target counts (expected vs observed).
2. Retry distribution by class (parse/apply/provider/rate-limit).
3. Time-to-stage-finalization.
4. Stuck-target snapshots and heal actions taken.
5. Final status summary: success/error counts.

Use bounded analysis (`debug:analyze --max-events`) for high-volume traces.

## 9. Hard Stop Conditions

Stop the run and triage immediately if any occurs:
1. Repeated scheduler tick loops with no net state progress over 3 intervals.
2. Retry counts hitting caps across large target cohorts unexpectedly.
3. Telemetry growth inconsistent with expected request volume.
4. Stuck work persists after dry-run + apply safe-heal cycle.

## 10. Recovery Protocol (non-destructive first)

1. `debug:stuck` to identify stalled entities.
2. `debug:heal` dry-run.
3. `debug:heal --apply` if safe actions are suggested.
4. Re-check via `debug:watch` + `debug:analyze`.
5. Use destructive cleanup only as explicit operator decision.

## 11. Interpretation guardrails

- Treat v3 as descriptive unless ablation thresholds pass.
- Do not claim mechanism causality from baseline-only results.
- Report uncertainty and unresolved assumptions explicitly.

## 12. Immediate Next Run Recommendation

Given current system state and risk posture:
1. Run **Phase 0 + Phase 1** first on `C1` with `W1` (`20` evidence total).
2. If stable, run **Phase 2** with all GPT models.
3. Only then run **Phase 3** ablations in listed priority.

This sequencing maximizes learning per unit risk while preserving infra safety.

## 13. Targeted Experimental Matrix (Cost-Controlled)

Use a targeted matrix instead of full factorial. Goal is to maximize information gain per run, not exhaust every combination.

### Fixed settings

- Scoring prompt framing: hypothetical default (fixed).
- Randomizations: fixed to your default run config.
- Evidence window: shared `W1` over `2026-01-01` to `2026-01-07`, built as `10 queries × 10 fetched, sample 2/query = 20 evidence`.
- `target_count` per run: `30`.

### Variable dimensions (available knobs)

| Dimension | Values | Count |
| :-- | :-- | --: |
| Model | `gpt-4.1`, `gpt-4.1-mini`, `gpt-5.2-chat`, `gpt-5.2` | 4 |
| Concept | `fascism`, `democratic backsliding`, `democratic quality` | 3 |
| Abstain | `abstain_enabled=true`, `abstain_enabled=false` | 2 |
| Semantic Level | `evidence_view=l2_neutralized`, `l3_abstracted` | 2 |
| Rubric Scale | `scale_size=4`, `scale_size=7` | 2 |

### Tiered execution design (recommended)

#### Tier A (full ablation coverage on primary pair)

- Models: `gpt-4.1`, `gpt-5.2`
- Run full ablation grid over:
  - concept (`3`)
  - abstain (`2`)
  - semantic level (`2`)
  - scale (`2`)
- Config count: `2 × 3 × 2 × 2 × 2 = 48`.

#### Tier B (reduced coverage on secondary models)

- Models: `gpt-4.1-mini`, `gpt-5.2-chat`
- Run baseline + minimal stress variants only:
  - concepts: `fascism`, `democratic backsliding` (`2`)
  - abstain: `true/false` (`2`)
  - semantic: `l3_abstracted` only (`1`)
  - scale: `7` only (`1`)
- Config count: `2 × 2 × 2 × 1 × 1 = 8`.

#### Tier C (focused probes, optional)

- Add targeted probes only if Tier A/B reveal ambiguity:
  - semantic sensitivity probe on one concept (`l2` vs `l3`) for one secondary model,
  - scale probe (`4` vs `7`) for one secondary model under fixed abstain setting.
- Typical count: `4-8` configs total.

### Rubric-swap extension matrix

Run this after Tier A/B stability checks pass.

- Primary pair (required): `gpt-4.1 <-> gpt-5.2`.
- Secondary pair (optional if budget/time permit): `gpt-4.1-mini <-> gpt-5.2-chat`.
- Required swap directions:
  - rubric generated by `gpt-4.1`, scored by `gpt-5.2`
  - rubric generated by `gpt-5.2`, scored by `gpt-4.1`
- Optional swap directions:
  - rubric generated by `gpt-4.1-mini`, scored by `gpt-5.2-chat`
  - rubric generated by `gpt-5.2-chat`, scored by `gpt-4.1-mini`
- Default (cost-controlled) swap slice:
  - pair: `gpt-4.1 <-> gpt-5.2`
  - concept: `fascism` only
  - abstain: both
  - semantic: `l3` only
  - scale: `7` only
  - count: `2 × 1 × 2 × 1 × 1 = 4`.
- Expanded swap slice (if needed):
  - `2 × 3 × 2 × 2 × 2 = 48`.

### Practical totals

- Lean default plan: `48 (Tier A) + 8 (Tier B) + 4 (swap default) = 60` configs.
- With optional Tier C probes: typically `64-68` configs.
- Only expand toward full slices if decision uncertainty remains high.

## 14. Control Concept (Post-Core Recommendation)

Recommended for a follow-up control pass after the v3 core matrix:

- Add a low-contestation control concept (example: **Norway democratic quality**).
- Run a reduced control slice first:
  - models: `gpt-4.1`, `gpt-5.2`
  - abstain: both settings
  - semantic: `l2`, `l3`
  - scale: `4`, `7`
- Purpose:
  - validate discriminant behavior outside highly contested US framing,
  - test whether compression/divergence patterns persist in a lower-contestation domain.

## 15. Synthetic Evidence Bed (Grounding Track)

Yes, include a synthetic grounding bed as a calibration sidecar.

### Why

- Real news evidence mixes conceptual signal with reporting noise and style variance.
- A synthetic ladder lets us test whether models can recover known monotonic severity structure.
- It gives a cleaner baseline for interpreting abstain behavior, midpoint usage (scale `7`), and compression.

### Synthetic bed spec

- Build `10` synthetic scenarios mapped to increasing conceptual severity (`S1..S10`).
- Keep style template-controlled (same structure/length envelope per scenario).
- Run the same scoring config axes as core where feasible (`abstain`, semantic level, scale).

### Recommended execution scope

- Start with a reduced slice:
  - models: `gpt-4.1`, `gpt-5.2`
  - abstain: both
  - semantic: `l2`, `l3`
  - scale: `4`, `7`
- Expand to full model set only if synthetic slice is stable and informative.

### Key checks on synthetic bed

1. Monotonicity: score/severity should increase from `S1` to `S10`.
2. Dynamic range: models should use interior stages (especially with scale `7`).
3. Abstain localization: abstain should concentrate near ambiguous boundary scenarios, not everywhere.
4. Cross-model comparability: divergence on synthetic should be lower than contested real-news runs; if not, geometry differences are likely model-internal.

### Execution note

Treat this as the full target matrix, but execute in phased slices from Section 6 (`Phase 0 -> Phase 4`) to keep operational risk bounded.
