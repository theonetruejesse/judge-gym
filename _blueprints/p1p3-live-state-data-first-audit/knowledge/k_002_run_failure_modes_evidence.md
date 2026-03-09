# Run failure mode evidence

**Confidence:** 0.89

**Sources:**
- MCP Convex: `runs` and `llm_batches` table reads
- MCP Convex: `insights`
- MCP Axiom: `queryDataset` trace aggregation for `run:kh7fmzghvbyxrcdy1ws8t1hn8982kpdn`

**Summary:**
The active run cohort is large and mostly stuck in early/mid stages. Recent batch failures cluster into three classes: read-limit/orchestrator errors, OCC contention, and provider timeout/unknown retries. Convex Insights repeatedly flags `domain/runs/run_service.js:reconcileRunStage` read-limit failures and OCC conflicts on `llm_requests`. Axiom trace distributions show repeated `request_error` and `batch_apply_error` events in stalled runs, with duplicate-apply signals indicating retry churn.
