# Partial D1 Failure Shape

**Confidence:** 0.91

**Sources:**
- Convex MCP one-off queries over `samples`, `sample_evidence_scores`, `llm_requests`, and `process_request_targets` for run `kh7avay0pw0jdc15svq9jpz5p182gwjw`
- Axiom MCP query on dataset `judge-gym` for `process_id = kh7avay0pw0jdc15svq9jpz5p182gwjw`
- `packages/lab:getRunSummary` for run `kh7avay0pw0jdc15svq9jpz5p182gwjw`

**Summary:**
The partial `D1` run has `30` samples but only `27` rubric and rubric-critic completions. It still has `300` score-unit rows, but only `270` score and score-critic completions. The `30` missing score-stage completions correspond exactly to `3` rubric-failed samples multiplied by the `10`-item pool. `process_request_targets` shows only `3` exhausted `rubric_gen` roots, which indicates the downstream score failures are blocked work rather than independent scheduler misses. Axiom and `getRunSummary` both preserve this partial-success shape at terminal state.
