# Blueprint: V4 Target Resource Viability

> This blueprint determines which shortlisted V4 candidate papers are currently supportable as fair `judge-gym` audit targets, with certainty scores tied to public-resource sufficiency rather than intuition alone. The main result is that `Gilardi` and a scoped `Ziems` subset are supportable primary targets, `Zheng / MT-Bench` is the cleanest comparator, `Thakur` is a strong alternate comparator, `Santurkar` is resource-real but better sequenced as an expansion wave, and `Törnberg` remains conditional.
>
> This document is a prebuilt execution plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-target-resource-viability
- **Research Question:** Determine whether the shortlisted V4 candidate papers for judge-gym have sufficiently reconstructable public resources, materials, prompts, datasets, and evaluation protocols to support fair evaluator-regime audits, and assign certainty scores to each target recommendation.
- **Scope:** candidate-paper resource sufficiency, fairness-of-reconstruction, engine-fit implications, and certainty-scored sequencing.
- **Non-goals:** full bundle ingestion, code implementation, or final paper-specific engine adaptation.
- **Constraints:** research only; no code changes; certainty is capped until replication bundles are directly inspected.

---

## 1. Worldview Register (Single Source of Truth)

`worldview.json` is the registry for subagent assignments, evidence, and synthesis status.

- **Agent Registry:** lead, researchers, bounded falsifier status, certainty scorer, synthesizer
- **Assignments:** list of Areas of Analysis and assigned subagents
- **Evidence Registry:** `knowledge/k_..._evidence.md`
- **Hypotheses Registry:** `hypotheses/hyp_...json`
- **Null Challenges:** `null_challenges/nc_...json`
- **Certainty Report:** `certainty/certainty_report.md`

---

## 2. Evidence Ledger (Grounding)

- `k_001_social_science_evidence.md`: `Gilardi` is the cleanest immediate primary; `Ziems` works only at subset scope; `Törnberg` is viable but fairness-conditional.
- `k_002_comparator_evidence.md`: `Zheng` is the strongest comparator; `Thakur` is also viable; `Wei`, `Shi`, and `Stureborg` are weaker first-wave candidates.
- `k_003_opinion_expansion_evidence.md`: `Santurkar` has real materials and protocol clarity, but the audit surface is higher-lift and distributional.
- `k_004_engine_fit_evidence.md`: the critical distinction is between missing materials and high engine-lift cost.

Critical gaps:

- replication bundles for the top targets still need direct inspection;
- `Ziems` needs a precommitted subset rule;
- the comparator slot still requires a final choice between `Zheng` and `Thakur`.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_social_science | Gilardi, Ziems, Törnberg | Aristotle | k_001 |
| A_comparators | Zheng, Thakur, Wei, Shi, Stureborg | Tesla | k_002 |
| A_expansion | Santurkar | Ptolemy | k_003 |
| A_engine_fit | fairness-of-reconstruction and engine lift | lead | k_004 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A_social_001 | Gilardi is a primary target now. | k_001, k_004 | 0.86 |
| h_A_social_002 | Ziems is a primary target only at subset scope. | k_001, k_004 | 0.74 |
| h_A_comp_001 | Zheng is the cleanest comparator. | k_002, k_004 | 0.91 |
| h_A_comp_002 | Thakur is a viable clean comparator. | k_002, k_004 | 0.81 |
| h_A_exp_001 | Santurkar should be sequenced as an expansion target. | k_003, k_004 | 0.82 |
| h_A_social_003 | Törnberg should remain conditional for now. | k_001, k_004 | 0.68 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A_social_001 | Passed | data completeness and API drift caveats remain |
| h_A_social_002 | Passed with weakening | whole-suite breadth and subset-cherry-picking risk |
| h_A_comp_001 | Passed | GPT-4 replay drift does not erase protocol visibility |
| h_A_comp_002 | Passed with caveat | human-comparison artifact discoverability |
| h_A_exp_001 | Passed | main blocker remains engine lift rather than resources |
| h_A_social_003 | Passed with pressure toward promotion | stronger-than-expected resource surface, but fairness risk remains |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviews evidence and steps.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence item:** `Törnberg conditional` at `0.68`, because the materials are plausible but still uninspected and fairness is highly exposed to model drift.
- **Highest-confidence item:** `Zheng clean comparator` at `0.91`, because the benchmark, labels, and pipeline are unusually public.

---

## 7. Prebuilt Implementation Plan

Each step must cite evidence, specify outputs, and include verification criteria. This plan is intended to be executed without re-deriving decisions.

#### S1: Finalize The Launch Bundle

- **Objective:** Lock the first-wave V4 paper bundle using the certainty-scored shortlist.
- **Evidence to Review:** `k_001`, `k_002`, `k_003`, `k_004`
- **Inputs:** evidence ledger, null challenge, certainty report
- **Actions:**
  1. Fix `Gilardi` as a primary launch target.
  2. Fix `Ziems` as launchable only under explicit subset scope.
  3. Choose a single comparator lane: `Zheng` by default, `Thakur` if controlled human-alignment framing is preferred.
- **Outputs:** locked launch-bundle memo
- **Verification:** bundle names and rationale are explicit; each target class matches the certainty report
- **Risks/Assumptions:** cannot be fully locked until bundle inspection and Ziems subset criteria are defined
- **Confidence:** `0.72`

#### S2: Inspect Replication Bundles

- **Objective:** Raise or lower certainty by directly checking the released artifacts for the top candidates.
- **Evidence to Review:** `k_001`, `k_002`, `k_003`
- **Inputs:** official repos, replication packages, bundle manifests
- **Actions:**
  1. Inspect `Gilardi` replication materials for codebooks, task assets, and sample IDs.
  2. Inspect `Törnberg` repo contents for complete country samples, labels, prompts, and stored outputs.
  3. Inspect `Santurkar` bundle for weights, demographic fields, and run metadata.
  4. Inspect `Thakur` repo for exact human-comparison artifacts and paper configs.
- **Outputs:** bundle-completeness memo per target
- **Verification:** each memo answers whether any critical field or asset is missing
- **Risks/Assumptions:** some artifacts may still rely on deprecated model endpoints even when the bundles are complete
- **Confidence:** `0.95`

#### S3: Pre-Select A Ziems Subset

- **Objective:** Convert `Ziems` from a broad family into a fair, precommitted audit target.
- **Evidence to Review:** `k_001`, `k_004`
- **Inputs:** Ziems repo task list, target-selection rubric
- **Actions:**
  1. Define a subset rule before seeing outcome differences.
  2. Prefer public, label-based, contested or socially meaningful tasks with stable loaders.
  3. Exclude tasks that force large new generation-eval machinery in the first wave.
- **Outputs:** one-page subset selection spec
- **Verification:** the subset rule is written before audit execution and can be defended against cherry-picking objections
- **Risks/Assumptions:** some candidate tasks may fail download or reveal extra preprocessing burden
- **Confidence:** `0.92`

#### S4: Choose The Comparator

- **Objective:** Select between `Zheng` and `Thakur` for the clean-comparator slot.
- **Evidence to Review:** `k_002`, `k_004`
- **Inputs:** comparator memo, launch-bundle memo
- **Actions:**
  1. Choose `Zheng` if the goal is the most legible public benchmark comparator.
  2. Choose `Thakur` if the goal is a more controlled judge-to-human comparison with strong config visibility.
  3. Defer the nonchosen comparator to later-wave work.
- **Outputs:** comparator decision memo
- **Verification:** the comparator's role is explicit and nonredundant with the other targets
- **Risks/Assumptions:** `Thakur` may hide more artifact-discoverability work than is obvious now
- **Confidence:** `0.87`

#### S5: Reserve Santurkar For The Expansion Wave

- **Objective:** Sequence `Santurkar` appropriately instead of dropping it or overloading the launch.
- **Evidence to Review:** `k_003`, `k_004`
- **Inputs:** expansion memo, current V4 architecture plan
- **Actions:**
  1. Treat `Santurkar` as a validated later-wave target.
  2. Use it to define requirements for weighted group references, refusal-aware scoring, and distributional alignment metrics.
  3. Do not force it into the launch bundle unless V4 scope intentionally expands.
- **Outputs:** expansion-wave requirements memo
- **Verification:** the decision is framed as sequencing, not rejection
- **Risks/Assumptions:** a more ambitious V4 could still rationally move it earlier
- **Confidence:** `0.90`

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Comparator choice and Ziems subset scope are resolved or explicitly deferred.
3. **Null Challenge Gate:** No critical target remains unchallenged.
4. **Verification Gate:** Every step has a checkable outcome.

---

## 9. Open Questions

- Does the `Gilardi` replication package contain every task asset needed for a paper-faithful audit?
- Which exact `Ziems` tasks should define the subset rule?
- Does `Thakur` expose its exact human-comparison slice as cleanly as the public code/config surface implies?
- Does the `Santurkar` bundle include every weighting and demographic field needed for exact recomputation?

---

## Appendix: Sources

- `knowledge/k_001_social_science_evidence.md`
- `knowledge/k_002_comparator_evidence.md`
- `knowledge/k_003_opinion_expansion_evidence.md`
- `knowledge/k_004_engine_fit_evidence.md`
- `null_challenges/nc_resource_viability_challenge.json`
- `certainty/certainty_report.md`
