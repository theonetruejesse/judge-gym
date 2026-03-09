# Certainty Report

## Evidence Scores
- `k_001`: 0.95 — Strong code-path support that modern subset scoring stores score completion on `sample_evidence_scores`, not `samples`.
- `k_002`: 0.93 — Clean D1 live data cleanly demonstrates the expected modern semantics.
- `k_003`: 0.91 — Partial D1 counts align across artifacts, targets, and Axiom terminal events.
- `k_004`: 0.88 — Partial P1 failure mode is strongly parse-dominated, with smaller OCC/conflict tails.
- `k_005`: 0.85 — Observability gaps are well supported, though some stage-event semantic drift is not fully mapped.

## Hypothesis Scores
- `h_A_01_001`: 0.96 — Sample-level score nulls are expected on modern subset runs.
- `h_A_02_001`: 0.88 — D1 partial-failure accounting was materially correct, with observability noise layered on top.
- `h_A_03_001`: 0.90 — The bad P1 run was dominated by score-gen parse failures with smaller OCC/conflict tails.

## Step Scores
- `S1`: 0.94 — Canonical artifact-accounting map should be locked before any further launch decisions.
- `S2`: 0.89 — A representative-run census should reliably distinguish true deficits from expected null semantics.
- `S3`: 0.84 — Telemetry-surface cleanup is justified, though exact mutation/event semantics still need precise implementation choices.
- `S4`: 0.82 — Parser/output hardening is strongly indicated, but the best mitigation path still needs design work.
- `S5`: 0.91 — A strict prelaunch gate based on artifact truth plus Axiom corroboration is well supported.

## Lowest-Confidence Concerns
- Stage-event payload semantics versus final artifact truth are not fully mapped for every historical run.
- Historical legacy or mixed-mode runs may still rely on sample-level score fields and weaken blanket assumptions.
- Scheduler/autonomy risk is secondary in the reviewed failures, but past manual healing means it is not zero.
- Axiom `request_error` payloads are too thin to fully explain non-parse error tails.
