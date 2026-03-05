# Blueprint: L3 Seed Debate

This blueprint resolves the `L3` design question as a structured debate for the V3 pilot: what `L3` should mean, what alternatives matter, and what default seed is justified under the dual telescope objective (model differences + institutional/news interpretation).

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/jg/judge-gym/_blueprints/l3-seed-debate
- **Research Question:** Given judge-gym's dual telescope goal (model differences + political institutions/news coverage), what should L3 be by default, what alternatives matter, and what seed specification should be used for V3?
- **Scope:** L3 conceptual definition, alternatives, measurable invariants, V3 mapping.
- **Non-goals:** Implementing new code paths, changing experiment matrix counts, rerunning full pilots.
- **Constraints:** Use existing docs/code artifacts; descriptive-first claims.

---

## 1. Debate Frame

### Position A: Identity-preserving L3 default
- Keep named actors/institutions when causally central.
- Abstract non-central identifiers only.
- Pros: strongest institutional interpretability; preserves accountability chains in political narratives.
- Risks: identity priors may confound pure model comparison.
- Evidence: `k_001`, `k_004`.

### Position B: Role-anonymized L3 default
- Replace names with role tokens while preserving causal graph.
- Pros: stronger control of identity cue confounds.
- Risks: can collapse distinct political actors and lose institutional specificity.
- Evidence: `k_004`.

### Position C: Structural-skeleton default
- Max abstraction into proposition skeleton.
- Pros: maximal comparability.
- Risks: over-compression and loss of policy/legal nuance.
- Evidence: `k_004`, `k_002`.

### Debate Outcome
Use **identity-preserving L3** as the operational default seed, but only under explicit invariant gating and a pre-baseline check. Treat role-anonymized as a sensitivity sidecar (not default) and structural-skeleton as diagnostic only.

---

## 2. Evidence Ledger

- `k_001_conceptual_target.md`:
  L3 is a construct-validity decision, not just text cleaning. The target is adjudicative geometry under contested concepts.
- `k_002_pipeline_invariants.md`:
  L3 requires hard guardrails: non-expansion, quantity/date retention, structural fidelity, and no transport-level duplicate artifacts.
- `k_003_v3_matrix_implications.md`:
  Because L3 is default in most tiers, semantic confounding must be gated before strong interpretation.
- `k_004_l3_options_tradeoffs.md`:
  Option comparison supports identity-preserving default for dual telescope goals.

Critical gaps:
- Post-patch proof that central-actor retention now passes in canary set is still required.
- Pre-baseline A1 gate completion is still pending.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A1 | Conceptual target/construct validity | Russell (`019cbcf2-04e8-79e0-9bea-7eb3c9d7356d`) | k_001 |
| A2 | Prompt + pipeline invariants | Newton (`019cbcf2-0500-7202-952e-a8987d84930a`) | k_002 |
| A3 | V3 matrix interpretability | Ohm (`019cbcf2-0522-7652-b549-f68abb504772`) | k_003 |
| A4 | L3 alternatives/tradeoffs | Bacon (`019cbcf2-0585-7291-9495-71fa62606505`) | k_004 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A1_001 | Identity-preserving L3 default best fits dual telescope objective | k_001, k_004 | 0.60 |
| h_A2_001 | L3 baseline validity requires hard invariant gate | k_002 | 0.84 |
| h_A3_001 | L3 default acceptable if pre-baseline gate passes | k_003 | 0.47 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A1_001 | Failed (current-state) | unresolved actor over-abstraction in canary artifacts |
| h_A2_001 | Weakened | minor retention misses + incomplete calibration |
| h_A3_001 | Failed (current-state) | pre-baseline gate remains TODO in V3 checklist |

Source: `null_challenges/nc_h_set_l3_seed_challenge.json`.

---

## 6. Certainty Summary

- **Report:** `certainty/certainty_report.md`
- **Highest-confidence actionable point:** enforce invariant gating (`h_A2_001`, 0.84).
- **Lowest-confidence point:** declaring L3 fully default-ready before gate completion (`h_A3_001`, 0.47).

---

## 7. Seed Specification (Proposed)

### L3 Seed (default)
`L3_identity_preserving_v1`

Contract:
1. Preserve causally central actors and institutions as named entities.
2. Preserve temporal anchors and material quantities exactly.
3. Preserve attribution/causal/modality structure from L2.
4. Apply abstraction only to non-central identifiers and style surface.
5. Enforce non-expansion (`L3 <= L2`; target <=90% where feasible).

### Gate to lock default for V3 interpretation
Before interpreting L3-driven results as model effects, pass this gate on a small matched A1 slice:
1. actor retention pass for causally central entities,
2. 100% temporal/material quantity recall,
3. non-expansion pass,
4. no contradiction between A1 l2/l3 direction and A2/B/Swap narrative,
5. abstain behavior remains interpretable.

If gate fails:
- keep L3 as experimental condition only,
- maintain descriptive-only claims,
- defer stronger causal interpretation.

---

## 8. Prebuilt Implementation Plan

### S1: Lock L3 policy contract
- **Objective:** Freeze and document exact L3 default semantics.
- **Evidence:** k_001, k_004.
- **Outputs:** short policy block in pilot docs + runbook.
- **Verification:** reviewer can classify any output violation against explicit clauses.
- **Confidence:** 0.88.

### S2: Run invariant canary
- **Objective:** Validate actor/date/number/non-expansion invariants on representative narrative + survey items.
- **Evidence:** k_002.
- **Outputs:** updated canary report with pass/fail table.
- **Verification:** machine checks + manual spot check on central actor cases.
- **Confidence:** 0.79.

### S3: Execute pre-baseline A1 mini gate
- **Objective:** Confirm semantic-level choice does not invert interpretive conclusions.
- **Evidence:** k_003.
- **Outputs:** short gate memo with separation/stability/abstain/rubric-swap checks.
- **Verification:** all gate criteria pass or are explicitly failed.
- **Confidence:** 0.70.

### S4: Optional sidecar sensitivity
- **Objective:** Estimate identity-cue confounding with small role-anonymized sidecar.
- **Evidence:** k_004.
- **Outputs:** sensitivity delta note (direction + magnitude).
- **Verification:** sidecar run compared against same pool/config subset.
- **Confidence:** 0.66.

### S5: Promotion decision
- **Objective:** Decide whether L3 is interpretive default or condition-only.
- **Evidence:** S2 + S3 outputs; certainty report.
- **Outputs:** explicit status flag in V3 docs.
- **Verification:** decision trace includes pass/fail rationale.
- **Confidence:** 0.61.

---

## 9. Open Questions

- What threshold of minor non-critical misses is acceptable for descriptive pilot claims?
- Should role-anonymized sidecar be mandatory for every concept or only for contested political narratives?
- Do we need an additional low-contestation control before locking final interpretation policy?

---

## Appendix: Sources

- /Users/jesselee/dev/research/jg/judge-gym/paper.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v1_distribution_exploration.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v2_engine_prototype_testing.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_specs.md
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/evidence_prompts.ts
- /Users/jesselee/dev/research/jg/judge-gym/docs/window_prompt_canary_2026-03-05.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/window_full_article_comparison.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/telemetry_baselines.md
