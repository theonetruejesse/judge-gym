# Pilot v3 Blueprint (Notepad)

## Context (from paper.md)
- Pilot v2 found alignment-induced adjudicative compression (GPT-5.2-chat collapsed geometry).
- Open questions: premise-gating vs entrenchment, US-specific vs general, domain-specific vs general, expert calibration.
- Key limitations: small evidence set (n=9), January 2026 specificity, no expert panel, premise ambiguity.

## What we still need to do before pilot v3
### Design decisions
- Decide exact v3 hypotheses to test (minimum set) and map each to a concrete experiment.
- Choose target domains for neutral-domain control (e.g., code review, medical triage, policy analysis) and commit to one.
- Decide country/fictionalization strategy (US vs fictional vs multi-country).
- Decide rubric policy (model-generated vs seeded templates) and number of rubrics per evidence.
- Decide subset-verdict prompting strategy to reduce abstention dominance.

### Data + evidence
- Expand evidence set size and diversity (target >= 100 items unless scope is intentionally minimal).
- Collect multi-country or fictionalized variants for the same evidence to isolate US-specific effects.
- Ensure evidence sources are stable and auditable (store raw + neutralized summaries).

### Prompting + instrumentation
- Implement explicit hypothetical framing prompt variant.
- Implement fictional country variant prompt (entity anonymization).
- Implement neutral-domain control pipeline (evidence sourcing + rubric templates).
- Ensure fresh-window probe is still isolated from scoring context.
- Add explicit subset-verdict affordances to elicit DST-compatible outputs.

### Calibration + validation
- Define expert rater protocol (Paxton-trained or equivalent) and collect a small calibration panel.
- Pre-register scoring guidelines for expert agreement probe.
- Define discriminant benchmarks to verify the judge-gym pipeline is not degraded.

### Analysis plan readiness
- Confirm metrics pipeline (JSD, DST conflict, compression index, abstention rate, uncertainty gap).
- Decide stopping criteria / success thresholds for each hypothesis.
- Finalize analysis scripts and visualization templates.

### Operational
- Lock model list (versions + providers) and sampling budget per model.
- Ensure cost estimates and run schedule are feasible.
- Freeze schema for experiment configs to avoid mid-run drift.

## Proposed scope for pilot v3
### Goal
Isolate the compression mechanism and determine whether it is (a) premise-gated, (b) US-specific, and/or (c) domain-specific.

### Minimal viable scope (if time/cost constrained)
- Models: GPT-4.1, GPT-5.2-chat, Gemini-3.0-flash, Qwen-235b (same as v2 for continuity).
- Evidence: 30-40 items total, split across:
  - 15-20 ECC political items (US).
  - 10-15 fictional-country variants of those items.
  - 5-10 neutral-domain controls (one domain only).
- Prompts: baseline v2 prompt + hypothetical framing variant + fictionalized variant.
- Rubrics: 10-15 per evidence item (stochastic sampling).
- Scoring: 3 samples per (model, evidence, rubric) triple.
- Outputs: point verdict + subset verdict (explicitly elicited).

### Full scope (if bandwidth permits)
- Models: add 1-2 additional alignment regimes (Claude, Grok) for generalization.
- Evidence: 100-120 items total, stratified across:
  - ECC (US + non-US + fictionalized) ~70.
  - Medium contestation (backsliding) ~30.
  - Low contestation controls ~20.
- Rubrics: 20-30 per evidence item.
- Expert panel: 5-10 raters on a 20-item calibration subset.

## Success criteria / exit conditions
- Compression persists under hypothetical framing => evidence for hard entrenchment.
- Compression disappears under fictionalization => US-specific premise-gating.
- Compression appears in neutral domain => general adjudicative collapse.
- Subset verdicts materially reduce DST conflict => forced-choice inflation confirmed.

## Risks to watch
- Abstention dominance remains; subset-verdict prompts fail.
- Evidence sourcing bias (political salience spikes) confounds results.
- Model version drift during data collection.

## Next actions (choose and assign)
- Finalize v3 hypothesis set and scope tier (minimal vs full).
- Draft prompt variants and rubric policy.
- Define evidence collection protocol and sampling plan.
- Schedule expert calibration (if included).
