# DST Blueprint: Transferable Belief Model for LLM-as-Judge

## Overview

We apply Smets' Transferable Belief Model (TBM) to quantify how LLM judges distribute
evidential support across ordinal rubric stages. Each model response becomes a mass function;
each sample uses a unique rubric (rubric is a stochastic variable), so we treat per-sample DST
intervals as draws from the model’s conceptual space. We aggregate belief/plausibility
intervals across rubric-samples to produce confidence-band estimates per evidence article.

## Theoretical Foundation

**Dempster-Shafer Theory (DST)** generalizes Bayesian probability by allowing belief to be
assigned to _sets_ of hypotheses, not just singletons. A mass function `m: 2^Theta -> [0,1]`
distributes a unit of belief across subsets of a frame of discernment `Theta`.

**Smets' TBM** extends classical DST with an **open-world assumption**: mass on the empty set
`m({})` is permitted and represents _contradiction_ — evidence that conflicts with every
hypothesis in the frame. This contrasts with Dempster's rule, which normalizes conflict away.

Key quantities derived from a mass function:

- **Belief** `Bel(A)`: sum of mass committed to subsets of A (lower probability bound)
- **Plausibility** `Pl(A)`: sum of mass on sets overlapping A (upper probability bound)
- **Pignistic probability** `BetP`: the "best-bet" point estimate obtained by uniformly
  distributing each focal set's mass across its members, then normalizing
- **Conflict** `m({})`: accumulated contradiction mass

## Frame of Discernment

```
Theta = {1, 2, ..., scale_size}
```

For a 4-point ordinal rubric: `Theta = {1, 2, 3, 4}`, where each element is a rubric stage
(e.g., 1 = "Not fascist", 4 = "Fully fascist"). The powerset `2^Theta` has 16 elements.

## Mass Assignment: Response → Mass Function

Each LLM response produces a verdict (a subset of Theta or an abstention) and probe signals:

- `p_score = expertAgreementProb ∈ (0, 1]` — confidence in the verdict for this evidence
- `p_rubric` — rubric quality proxy from critic scores:
  `p_rubric = observabilityScore × discriminabilityScore`

We fuse them into a single pivot `p` (default: `p = p_score × p_rubric`). This `p` partitions
mass differently depending on the response type:

### Normal Verdict (proper subset of Theta)

```
m(verdict) = p        — certainty allocated to the specific subset
m(Theta)   = 1 - p    — remainder is ignorance
```

Standard **simple support function**. The probe tells us how much mass goes to the specific
focal set versus total ignorance. Example: verdict `{2,3}` with `p = 0.8` yields
`m({2,3}) = 0.8`, `m(Theta) = 0.2`.

### Full Frame (model chose all stages, i.e., verdict = Theta)

```
m(Theta) = p          — genuine ignorance (confident "I don't know")
m({})    = 1 - p      — contradiction (unconfident "everything" ≈ failure)
```

A confident full-frame selection is real ignorance — the model genuinely considers all stages
plausible. An unconfident one signals that the model defaulted to the full frame as a failure
mode, which we treat as contradiction.

### Abstain (model refused to score)

```
m({})    = p          — genuine contradiction (confident refusal = real conflict)
m(Theta) = 1 - p      — ignorance (unconfident refusal ≈ "I just don't know")
```

A confident refusal is a strong conflict signal — the model is sure it cannot place the
evidence on the scale. An unconfident refusal is closer to ignorance.

### Symmetry

Full-frame and abstain are **mirror images** on the ignorance–contradiction axis:

```
              ignorance ←——— probe (p) ———→ informative interpretation

Normal:       m(Theta) = 1-p                m(verdict) = p
Full frame:   m({})    = 1-p                m(Theta)   = p
Abstain:      m(Theta) = 1-p                m({})      = p
```

The probe always acts as the pivot between the "meaningful" interpretation and its complement.

## Per-sample TBM, then Interval Aggregation

For each `(model, evidence)` pair, we compute a TBM mass function per sample and derive
`Bel_s(i)` / `Pl_s(i)` for each stage `i`. We then aggregate these intervals across the
`N` rubric-samples to produce confidence bands:

- **Central tendency:** mean or median of `Bel_s(i)` and `Pl_s(i)`
- **Interval:** quantiles over samples (e.g., 10–90 or 5–95)

These bands capture _total uncertainty_ from rubric stochasticity and scoring noise.
We do **not** bootstrap in the pilot.

## Analysis Outputs

@packages/analysis/notebooks/ecc_v1.ipynb
From each evidence × model (aggregated across rubric-samples):

| Output                | What it tells us                                       |
| --------------------- | ------------------------------------------------------ |
| `Bel({i})` per stage  | Lower bound: minimum probability the true stage is `i` |
| `Pl({i})` per stage   | Upper bound: maximum probability the true stage is `i` |
| `Pl({i}) - Bel({i})`  | Epistemic uncertainty gap for stage `i`                |
| `BetP({i})` per stage | Best-bet point estimate for stage `i`                  |
| `m({})` (diagnostic)  | Per-sample contradiction (not a headline metric)       |

## Visualizations

1. **Bel/Pl interval plot**: vertical bars showing `[Bel({i}), Pl({i})]` for each stage,
   with BetP as point markers — shows both the best guess and the uncertainty envelope

2. **Pignistic heatmap**: evidence × stage matrix of `BetP` values, one panel per model —
   the DST-principled analog of the frequency-based verdict distribution heatmaps

3. **Rubric-verbosity regression**: linear regression testing whether models prefer
   longer rubric stage descriptions. For each score, regress stage selection (or
   BetP-weighted selection) on stage text length; longer stages should have positive
   coefficients if verbosity bias is present.

## Dependencies

- `py-dempster-shafer >= 0.7` (`pyds.MassFunction`) — already installed
