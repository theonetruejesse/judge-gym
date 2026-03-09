# Partial P1 Score-Generation Failure Pattern

**Confidence:** 0.88

**Sources:**
- Convex MCP one-off queries over `sample_evidence_scores`, `llm_requests`, and `process_request_targets` for run `kh765a6z2njwef2cp5y4cavxbd82k2z3`
- Axiom MCP queries on dataset `judge-gym` for `process_id = kh765a6z2njwef2cp5y4cavxbd82k2z3`
- `packages/lab:getRunSummary` for run `kh765a6z2njwef2cp5y4cavxbd82k2z3`

**Summary:**
The bad `P1` run is not a rubric bottleneck. It has full rubric completion (`30/30`) but only `300/600` score-gen and `300/600` score-critic completions. Missing score units are spread across all `30` samples, indicating systemic score-stage failure rather than a small number of dead samples. Error history is dominated by score-gen parse failures, especially `Missing reasoning before VERDICT line`, with smaller tails from observability OCC/write conflicts and occasional verdict-label parse errors. The strongest current explanation is parser/output fragility in score generation, not scheduler failure.
