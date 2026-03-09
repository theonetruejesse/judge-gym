# Certainty Report

## Evidence Scores
- **Parse corpus findings:** **0.94**
  - Strong support from live Convex request rows, run-level diagnostics, and Axiom stage/event counts.
  - The model/stage concentration is clear: `gpt-5.2-chat` and `score_gen` dominate.
  - Slight uncertainty remains on whether prompt changes alone will fix the `None` / empty-`VERDICT` subgroup.

- **Observability-loss findings:** **0.96**
  - Strong support from direct inspection of `llm_requests`, `process_observability`, `packages/lab:getRunDiagnostics`, and `packages/codex:getProcessHealth`.
  - The gap is concrete: failed requests lack durable raw output, local mirror drops payloads, and historical failures pollute operator surfaces.

- **Telemetry/OCC findings:** **0.92**
  - Strong support from Convex Insights plus code paths in `emitTraceEvent`, `recordProcessObservability`, and scheduler start logic.
  - Root cause for `process_observability` contention is highly likely.
  - Slight uncertainty remains on the exact production impact split between unavoidable contention and excessive mirroring frequency.

- **Persisted-counter-integrity finding:** **0.97**
  - Very strong support from exact recomputation using the same run-completion semantics as runtime code.
  - Zero drift found across `samples`, `runs`, and `experiments` in the live dataset.
  - This is the most stable conclusion in the audit.

## Fix Theme Scores
- **Persist raw output on parse failure before retry/error handling:** **0.98**
  - Highest-confidence fix. It directly closes the main forensic gap with minimal ambiguity.

- **Separate terminal-failure reporting from historical failed-attempt reporting:** **0.95**
  - Strongly justified by the clean-run diagnostics contradiction.
  - Exact API shape can vary, but the need is clear.

- **Preserve informative local telemetry payloads / persist `external_trace_ref`:** **0.91**
  - Strongly justified for operator effectiveness.
  - Exact retention budget still needs design tradeoff work.

- **Reduce `process_observability` hot-row write pressure:** **0.90**
  - Clearly needed.
  - Confidence is slightly lower on the precise fix mechanism: fewer mirrored events vs. different storage shape vs. both.

- **Make scheduler kickoff idempotent under contention:** **0.84**
  - Worth fixing, but lower urgency.
  - Current evidence suggests duplicate-start contention, not lost-work behavior.

- **Tighten subset score-gen prompt/parser contract for no-fit cases:** **0.89**
  - Strongly indicated by repeated `None` / empty-`VERDICT` failures.
  - Exact contract change still needs product choice: explicit no-match token, abstain-like path, or parser tolerance.
