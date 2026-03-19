# Certainty Report

## Evidence Scores
- `k_001`: 0.88 — Strong. Existing reset / launch / status / heal primitives are clearly present; the gap is at campaign orchestration.
- `k_002`: 0.91 — Very strong. Documentation-role confusion and duplication are directly visible in repo docs.
- `k_003`: 0.86 — Strong. Engine state vs campaign-state separation is well supported by persisted states plus codex stuck/health signals.
- `k_004`: 0.84 — Strong. Current observability is sufficient for a pre-wipe forensic bundle, but lacks first-class artifact composition.
- `k_005`: 0.87 — Strong. Fresh-agent bootstrap is workable today; the missing piece is durable campaign memory and machine-readable launch intent.

## Hypothesis Scores
- `h_A_01_001`: 0.84 — Likely correct, but slightly too strong if interpreted as “no helper/API work will be needed.”
- `h_A_02_001`: 0.89 — Very likely correct. The dominant migration risk is source-of-truth confusion, and the cleanest fix is slim docs + manifest + V3-specific skill.
- `h_A_04_001`: 0.85 — Strong. The iteration snapshot artifact is one of the highest-value missing pieces, though not the only adjacent improvement.

## Step Scores
- Doc split (`AGENTS.md` repo-only, docs thinned): 0.90
- Dedicated campaign directory (`_campaigns/v3_finish_pass/`): 0.88
- `manifest.json` as launch/reset source of truth: 0.87
- V3-specific skill owning the loop: 0.86
- Optional cohort helper / API cleanup: 0.67

## Overall Read
The migration direction is well supported. The highest-confidence needs are:
1. split documentation roles cleanly,
2. add durable campaign memory,
3. add a machine-readable manifest,
4. move the V3 loop into a dedicated skill.

The lowest-confidence area is whether a new backend cohort helper is needed immediately, or whether the first version can rely on existing codex/lab primitives plus the new campaign state layer.
