# Blueprint: Window Prompt OPRO QA

Three OPRO-style rounds were run in-context on W1 QA outputs for L1/L2/L3. The process converged on a D-style hybrid prompt pack with conditional long-survey compression in L2 and strict non-expansion in L3.

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/window-prompt-opro-qa`
- **Research Question:** Run a 3-round in-context OPRO critic loop for window prompts L1/L2/L3 using W1 outputs, fidelity-first, before code edits.
- **Scope:** Prompt QA and recommendation only; no code patch in this run.
- **Constraints:** Fidelity-first objective; anti-expansion required; use live W1 stage outputs as grounding.

## 1. Evidence Ledger

- `k_001_baseline_prompts.md`: current L1/L2/L3 prompt behavior and constraints.
- `k_002_w1_eval_dataset.md`: live W1 outputs and measured length drift issues.
- `rounds/round1_candidates.md`, `rounds/round2_candidates.md`: candidate prompt packs.
- `rounds/round1_judging.md`, `rounds/round2_judging.md`: judge decisions.
- `rounds/round3_final.md`: final synthesis + rollout guidance.

## 2. Candidate Evolution

1. **Round 1**
- A: fidelity-heavy, weak anti-expansion.
- B: strong anti-expansion, higher omission risk.
- C: strong L3 structural constraints.
- Result: mixed winners (A for L1, contested L2, C for L3).

2. **Round 2**
- D vs E hybrids.
- Judges selected D overall (better fidelity/practical fit), with one requested modification.

3. **Round 3**
- Final D-derived pack adds **conditional long-survey compression mode** in L2.
- Independent certainty/falsifier checks: **canary-go, broad-no-go**.

## 3. Final Prompt Recommendation

Adopt the **Round-3 final pack** (D-derived) for pilot canary only:

- L1: strict fidelity cleaner, minimal edits only.
- L2: default fidelity normalization (80-95%, <=100%) + conditional long-survey mode (60-80%, <=85%) when table/survey-heavy and long.
- L3: strict structural mapper with hard non-expansion (`<=100%` of L2).

## 4. Validation Gates Before Broad Rollout

1. Entity/date/number retention >= 0.95 on long-survey canary set.
2. L3 output length <= L2 for every canary item.
3. No stage completion regressions in telemetry (`window` trace progression remains healthy).
4. Manual spot-check that modality/attribution markers are preserved.

## 5. Decision

- **Broad rollout:** No-go yet.
- **Gated canary patch:** Go.

## 6. Implementation Plan (next action when approved)

1. Patch `packages/engine/convex/domain/window/evidence_prompts.ts` with round-3 final text.
2. Run one canary window on W1 query with `evidence_limit=2` then `evidence_limit=10`.
3. Collect retention/length metrics and compare against baseline snapshot.
4. If gates pass, promote to wider window flow usage.

## Appendix: Key Files

- `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/evidence_prompts.ts`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/window-prompt-opro-qa/knowledge/k_001_baseline_prompts.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/window-prompt-opro-qa/knowledge/k_002_w1_eval_dataset.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/window-prompt-opro-qa/rounds/round1_judging.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/window-prompt-opro-qa/rounds/round2_judging.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/window-prompt-opro-qa/certainty/certainty_report.md`
