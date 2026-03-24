# Candidate Map

## Objective

Assign certainty-scored viability judgments to the current V4 candidate papers by checking whether their public resources are sufficient for fair evaluator-regime audits with `judge-gym`.

## Candidate Set

### Direct audit targets

- `Gilardi et al.`: coder-replacement / text annotation.
- `Ziems et al.`: computational social science task family, likely via scoped subset.
- `Törnberg`: political Twitter-message annotation / party inference.

### Expansion target

- `Santurkar et al.`: survey and opinion-reflection / distributional alignment.

### Comparator and methods targets

- `Zheng et al. / MT-Bench`
- `Thakur et al.`
- `Wei et al.`
- `Shi et al.`
- `Stureborg et al.`

## Prior Shortlist Logic

The previous V4 triage converged on this:

- `Gilardi` and a scoped `Ziems` subset are the strongest immediate targets.
- `Zheng` and `Thakur` are the cleanest comparator candidates.
- `Santurkar` is strong on materials but should be treated as an engine-expansion target rather than a low-lift third audit.
- `Törnberg` is attractive but conditional on a stronger materials check.
- `Wei`, `Shi`, and `Stureborg` are mainly support or narrow companion cases.

## Viability Criteria

Each target should be evaluated on:

1. `Resource sufficiency`
   Can we locate the dataset, prompt or rubric surface, and enough evaluation detail to reconstruct the original baseline fairly?

2. `Fairness of reconstruction`
   Would an audit require modest adaptation, or would we be forced to reverse-engineer too much of the original setup?

3. `Engine fit`
   Does the task map onto `judge-gym`'s near-term V4 primitives without requiring a qualitatively new platform?

4. `Audit payoff`
   If reconstructed, would perturbing the evaluator regime likely reveal something scientifically meaningful?

5. `Certainty ceiling`
   What prevents us from being more certain right now: missing materials, hidden preprocessing, unclear prompts, or large engine-generalization burdens?

## Output Requirement

Researchers should return:

- evidence-backed viability judgments;
- recommendation class: `primary`, `clean comparator`, `conditional`, `expansion`, or `support only`;
- a confidence view that distinguishes strong public-material signals from weaker inference.
