# Null Challenges

## h_A_social_001 — Gilardi as primary

- Challenge: the replication package may still omit enough task assets that a paper-faithful rerun becomes partial.
- Challenge: historical `gpt-3.5-turbo` behavior is not reproducible exactly.
- Outcome: `Passed with caveat`
- Effect on confidence: reduces certainty ceiling, but does not demote the class below `primary`.

## h_A_social_002 — Ziems subset as primary

- Challenge: the paper is not one clean audit object; a careless subset choice could become cherry-picking.
- Challenge: some tasks may depend on brittle downloads or unavailable legacy models.
- Outcome: `Weakened`
- Effect on confidence: keeps the class at `primary` only if V4 explicitly precommits to a narrow, justified subset.

## h_A_comp_001 — Zheng as clean comparator

- Challenge: exact paper-era GPT-4 behavior cannot be replayed faithfully today.
- Challenge: a comparator audit that insists on exact score reproduction rather than protocol-faithful reconstruction would be weaker.
- Outcome: `Passed`
- Effect on confidence: remains high because the benchmark and human-label surfaces are unusually public.

## h_A_comp_002 — Thakur as clean comparator

- Challenge: the repo may require nontrivial digging to locate the exact paper slice and human-comparison artifacts.
- Challenge: if those human artifacts are partially internal, the recommendation class should fall.
- Outcome: `Passed with caveat`
- Effect on confidence: lowers certainty below Zheng, but does not currently force demotion.

## h_A_exp_001 — Santurkar as expansion target

- Challenge: if the released bundle is missing weighting or demographic fields, exact recomputation would be less secure than assumed.
- Challenge: if V4 expands scope aggressively, Santurkar might belong earlier despite high engine lift.
- Outcome: `Passed`
- Effect on confidence: supports the current class because the strongest blocker still appears to be engine-expansion cost rather than materials.

## h_A_social_003 — Törnberg as conditional

- Challenge: the resource surface may actually be good enough to upgrade this target once the repo is inspected more directly.
- Challenge: if sample data and baseline outputs are complete, the current demotion may be too conservative.
- Outcome: `Weakened toward promotion`
- Effect on confidence: keeps the target conditional for now, but narrows the gap between `conditional` and a real launch candidate.

## Overall Null-Challenge Result

No leading recommendation fully failed. The main changes from challenge pressure are:

- `Ziems` must stay subset-scoped to remain defensible.
- `Thakur` is real, but slightly less certain than `Zheng`.
- `Törnberg` is not a fake candidate; it is a fairness-conditional one.
