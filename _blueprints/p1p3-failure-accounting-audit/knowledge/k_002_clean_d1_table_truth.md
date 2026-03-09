# Clean D1 Run Table Truth

**Confidence:** 0.93

**Sources:**
- Convex MCP one-off query over `samples`, `sample_evidence_scores`, `scores`, `score_critics`, and `process_request_targets` for run `kh77e0h2fp5pmr9geaf5q9myh982gecn`
- `packages/lab:getExperimentSummary` for experiment `j97ep0yj8sme9pg5mryq9kw2v982g2xj`

**Summary:**
The clean `D1` run shows the modern subset semantics clearly. It has `30` samples, `300` `sample_evidence_scores` rows, `300` `scores`, and `300` `score_critics`, while `samples.score_id` and `samples.score_critic_id` remain `null` for all `30` sample rows. The run summary and experiment summary both classify it as cleanly complete. This is direct evidence that sample-level score nulls are expected on healthy current runs and that table truth for scoring lives in unit rows and score tables.
