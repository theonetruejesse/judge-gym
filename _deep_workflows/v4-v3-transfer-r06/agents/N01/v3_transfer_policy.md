# V3 To V4 Transfer Policy

## Decision Rule

V4 should carry forward only the V3 interventions that satisfy all three conditions:

1. they were among the strongest or cleanest V3 findings
2. they remain meaningful under paper-audit / literature-compatibility tasks
3. they can be expressed cleanly across the new provider-family panel

This means V4 is **not** a replay of the full V3 design space.

## Headline-Portable V3 Families

### 1. `d1` control -> V4 faithful baseline

Carry forward as:

- `baseline_faithful`

Why:

- every paper-audit condition needs a clearly faithful baseline
- the baseline family panel is the core cross-provider comparison surface

### 2. `a1` abstention toggle -> V4 cross-family abstention panel

Carry forward as:

- `abstention_on`

Why:

- V3 found abstention to be the strongest and cleanest replicated intervention
- it is portable across paper-audit targets and provider families
- it is central to the evaluator-regime thesis, not a niche mechanism check

Strong-conviction decision:

- unlike the earlier V4 sketch, abstention should be run across the **full headline provider panel**, not just the primary OpenAI line

### 3. Raw versus semantic reframing -> V4 `l2_neutralized` comparison

Carry forward as:

- raw/source baseline versus `l2_neutralized`

Why:

- V4 needs at least one evidence-surface perturbation to preserve continuity with the judge-gym measurement framework
- `l2_neutralized` is much more defensible than `l3_abstracted` for literature audits

Strong-conviction decision:

- run this as a headline family for `Gilardi`
- keep it appendix-only or conditional for `Zheng`, because comparator prompt fidelity is more fragile there

## Appendix-Portable V3 Families

### 4. `a3`, `c6`, `c7` scale probes

Carry forward only as appendix:

- scale expansion where the imported task contract tolerates it

Why:

- V3 showed scale mainly changes expression, not certainty
- useful, but not one of the most important wave-1 paper claims
- easiest to justify on `Zheng`, not necessarily on `Gilardi`

### 5. `b1`, `c4`, `c5` small/chat follow-ups

Carry forward only as appendix:

- `gpt-4.1-mini`
- `gpt-5.2-chat`

Why:

- V3 showed these are distinct regimes, not just weaker copies
- useful for internal OpenAI robustness, but not necessary in every headline cell

## Excluded From The Headline Literature-Audit Matrix

### 6. `a4` rubric/scoring role swap

Do not carry into headline V4.

Why:

- it depends on a decomposed rubric/scoring pipeline
- the wave-1 literature-audit targets are judged mainly through faithful single-stage or fixed-protocol evaluations
- it is more natural for later native `judge-gym` regime studies than for the headline paper audit

### 7. `a5` concept framing

Do not carry into headline V4.

Why:

- it was one of the strongest V3 results, but it is specific to contested-concept semantic relabeling
- it would violate the literature-fidelity framing of `Gilardi` and `Zheng`

### 8. `c1`, `c2` bundle strategy

Do not carry into headline V4 literature audits.

Why:

- V3 showed grouping is part of the instrument
- but the headline V4 targets are mostly single-item judgment tasks, not multi-evidence bundle studies
- this becomes a follow-on lane for native judge-gym evidence-set work or appendix cases where grouped imports make sense

### 9. `a2`, `c3`, and the `l3` emphasis

Do not carry into headline V4.

Why:

- V3 found `l3` weaker than abstention, concept framing, or placement
- `l3` is too far from paper-faithful evidence for wave-1 literature auditing

## Resulting V4 Transfer Ladder

### Headline

- faithful baseline / control
- abstention toggle across all headline providers
- raw versus `l2_neutralized` for `Gilardi`

### Appendix

- scale expansion
- OpenAI small/chat follow-ups
- conditional `Zheng` `l2_neutralized`

### Deferred

- placement
- concept framing
- bundle strategy
- `l3`
