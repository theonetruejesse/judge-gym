# Blueprint: Pilot v3 Experimental Spec

This blueprint converts v1/v2 findings + paper hypotheses into a run-ready v3 protocol that is executable on the current Convex-native orchestration stack.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/pilot-v3-experimental-spec`
- **Research Question:** Synthesize pilot v1/v2 findings and paper.md into a run-ready v3 experimental specification mapped to current engine settings, ablations, canary gates, telemetry coverage, and decision criteria.
- **Scope:** v3 plan definition only (no code changes), mapped to current engine constraints and observability loop.
- **Non-goals:** causal claims finalization; new model families outside GPT pilot scope.
- **Constraints:** must align with `ENGINE_SETTINGS` defaults and AGENTS runbook constraints.

## 1. Evidence Ledger

- `k_001` v1 findings: broad divergence + confound inventory; low causal confidence.
- `k_002` v2 findings: geometry divergence and compression-like pattern; key ablations still pending.
- `k_003` paper method: strong hypothesis framework, explicitly preliminary.
- `k_004` operational constraints: high-confidence execution constraints and debug/recovery workflow.

## 2. Areas of Analysis

| Area ID | Scope | Evidence |
| :-- | :-- | :-- |
| A1 | v1 confounds and controls | `k_001`, `k_004` |
| A2 | v2 geometry and ablation gaps | `k_002` |
| A3 | paper metrics and hypothesis logic | `k_003` |
| A4 | run-ready operational feasibility | `k_004` |

## 3. Micro-Hypotheses

- `h_A2_001` Compression-like geometry is reproducible under current stack (`0.72`).
- `h_A3_002` Forced-choice and framework-sensitivity must be first-class ablations before scale-up (`0.58`).
- `h_A4_003` Staged canary + strict guardrails can execute v3 safely now (`0.81`).

## 4. Null Challenge Summary

All three hypotheses survived meaningful challenge only as conditional claims; none are validated as causal facts yet.

- Hypothetical framing effect: unresolved effect size.
- Rubric swap mechanism: still unproven.
- Forced-choice inflation magnitude: still unproven in-engine.

## 5. Prebuilt Implementation Plan

### S1. Lock v3 objective and success metrics

- **Objective:** Focus on reproducibility + mechanism isolation, not maximal volume.
- **Evidence:** `k_001`, `k_002`, `k_003`.
- **Actions:**
  1. Treat primary output as adjudicative geometry diagnostics.
  2. Pre-register key metrics: mid-range occupancy, abstention rate, entropy, JSD, certainty distribution.
- **Verification:** Metrics are explicitly listed in v3 doc and tied to each ablation.
- **Confidence:** `0.84`.

### S2. Define run-ready matrix mapped to current engine settings

- **Objective:** Convert conceptual matrix to a manageable staged rollout.
- **Evidence:** `k_002`, `k_004`.
- **Actions:**
  1. Keep GPT-only scope.
  2. Set canary stage counts first, then scale.
  3. Respect defaults (`max_batch_size=100`, `min_batch_size=25`, retry caps).
- **Verification:** v3 doc includes explicit staged matrix and execution order.
- **Confidence:** `0.82`.

### S3. Add canary gates and hard stop conditions

- **Objective:** Prevent runaway loops and unreadable telemetry.
- **Evidence:** `k_004`.
- **Actions:**
  1. Define pass/fail gates per stage.
  2. Define hard-stop triggers for stuck targets, retry explosions, and scheduler churn.
- **Verification:** v3 doc contains stop conditions and recovery protocol.
- **Confidence:** `0.88`.

### S4. Prioritize ablations by decision value

- **Objective:** Resolve largest interpretability uncertainty first.
- **Evidence:** `k_001`, `k_002`, `k_003`.
- **Actions:**
  1. Run hypothetical framing + abstain/forced-choice first.
  2. Run rubric swap second.
  3. Defer lower-value variations until canary stability is confirmed.
- **Verification:** v3 doc has explicit ablation order and expand/stop thresholds.
- **Confidence:** `0.76`.

### S5. Define launch-day observability and recovery loop

- **Objective:** Ensure fresh-context operability and fast intervention.
- **Evidence:** `k_004`.
- **Actions:**
  1. Attach required debug commands (`debug:watch`, `debug:analyze`, `debug:stuck`, `debug:heal`).
  2. Enforce dry-run-first heal and bounded diagnostics.
- **Verification:** v3 doc includes exact operational runbook.
- **Confidence:** `0.87`.

## 6. Validation Gates

1. **Design gate:** Every ablation mapped to a measurable metric delta.
2. **Operational gate:** Canary passes without runaway retry loops or persistent stalls.
3. **Interpretation gate:** Claims remain descriptive unless ablation evidence passes thresholds.
4. **Scale gate:** Full run starts only after all canary gates pass.

## 7. Open Questions

- What minimum effect size defines “material” compression change under hypothetical framing?
- What threshold justifies promoting rubric swap from exploratory to required?
- Should subset verdict mode be enforced in scoring or as a dedicated sidecar probe?

## Appendix: Source Paths

- `/Users/jesselee/dev/research/jg/judge-gym/pilots/v1_distribution_exploration.md`
- `/Users/jesselee/dev/research/jg/judge-gym/pilots/v2_engine_prototype_testing.md`
- `/Users/jesselee/dev/research/jg/judge-gym/pilots/v3_openai_comprehensive.md`
- `/Users/jesselee/dev/research/jg/judge-gym/paper.md`
- `/Users/jesselee/dev/research/jg/judge-gym/AGENTS.md`
- `/Users/jesselee/dev/research/jg/judge-gym/README.md`
- `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts`
