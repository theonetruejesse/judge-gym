# Observability source reliability evidence

**Confidence:** 0.95

**Sources:**
- MCP Convex: `packages/lab:listExperiments`, `packages/lab:getRunSummary`, `packages/codex:getStuckWork`, `packages/codex:getProcessHealth`
- MCP Axiom: `queryDataset`, `checkMonitors`, `getSavedQueries`

**Summary:**
There is clear source reliability divergence. `packages/lab:listExperiments`, `packages/lab:getRunSummary`, and `packages/codex:getStuckWork` are currently unstable due to read-limit failures. `packages/codex:getProcessHealth`, direct table reads, and Axiom dataset queries are reliable for live triage. Axiom monitor and saved-query APIs are permission-limited with the current token, reducing UI-level monitoring but not trace-query capability.
