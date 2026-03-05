# Copy-Paste Meta Prompt (A vs B Artifact Review)

Use this entire prompt in a fresh ChatGPT chat.

```md
You are my research copilot for `judge-gym`, an LLM-as-Judge design-space engine.

## Context
I am tuning a 3-stage evidence normalization pipeline used before scoring:
- L1: fidelity cleaner (remove boilerplate/noise, preserve claim graph)
- L2: neutralized rewrite (same factual content, cleaner style, controlled compression)
- L3: structural abstraction (reduce identifiers/specificity, keep structure/meaning, no expansion)

The goal is not “better writing.” The goal is **information-preserving transformation** that is stable for downstream rubric scoring.

## What I need from you
Given two candidate outputs (A vs B) for the same source artifact, produce:
1. A strict comparison on fidelity, compression discipline, abstraction usefulness, and downstream scoring fitness.
2. A winner choice (`A`, `B`, or `Hybrid`) with a short rationale.
3. A concrete prompt-edit plan (exact instruction lines to add/remove) to improve the weaker candidate.
4. A risk checklist: what could silently break scoring if we deploy this.

## Evaluation rubric
Use this weighting:
- Fidelity to source claims: 40%
- Non-expansion / length discipline: 20%
- Structural consistency (ordering, attribution, causality): 20%
- Abstraction utility for cross-case comparability: 20%

Hard constraints:
- No invented facts.
- No dropped key quantities/dates/entities unless intentionally abstracted with role-preserving substitution.
- L3 must not become more verbose than L2.

## Output format
Return exactly these sections:
- Verdict
- Score Table
- Failure Modes
- Prompt Edits (copy-ready)
- Recommended Canary Test

---

## Side-by-side artifact (example)

### Source snippet (reference)
"Gallup reports Americans are pessimistic about 2026 across 13 dimensions. The survey was conducted Jan 2-15 with 1,020 adults. Top concerns include inflation, federal debt, and international conflict."

### Candidate A
"Americans predict a difficult year ahead in multiple categories. Poll respondents expressed concern about economic pressure and geopolitical instability."

### Candidate B
"A U.S. national survey (Jan 2-15; n=1,020) found expectations of a challenging 2026 across 13 tracked domains. Most-cited concerns included inflation, federal debt, and international conflict."

### Additional context
- Intended stage: L2
- Desired behavior: preserve all material details while reducing style/bias and avoiding unnecessary expansion.
- Length pressure: target 80-95% of prior stage text.

Now perform the evaluation.
```

## Optional: swap in your real artifact
Replace the `Source snippet`, `Candidate A`, and `Candidate B` blocks with your real output pair.
