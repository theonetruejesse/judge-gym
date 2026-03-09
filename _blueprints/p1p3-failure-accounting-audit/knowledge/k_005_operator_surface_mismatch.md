# Summary surfaces and diagnostic surfaces measure different failure units

**Confidence:** 0.83

**Sources:**
- Convex MCP `packages/lab:getRunDiagnostics` for runs `kh7avay0pw0jdc15svq9jpz5p182gwjw` and `kh765a6z2njwef2cp5y4cavxbd82k2z3`
- Convex MCP `packages/lab:getRunSummary` for the same runs
- Convex MCP `insights` for the dev deployment

**Summary:**
Operator-facing Convex surfaces are directionally aligned, but they do not count the same thing. `getRunSummary` reports terminal failed targets: for the partial D1 run it reports `3` failed rubric targets and `30` failed score targets; for the partial P1 run it reports `300` failed `score_gen` and `300` failed `score_critic` targets. `getRunDiagnostics` instead surfaces failed request attempts and artifact counts. For the partial P1 run it reports `artifact_counts.rubric_critics=30` yet also `stage_rollup.rubric_critic.error=2`, because failed rubric-critic attempts later succeeded. The same diagnostics payload shows `stage_rollup.score_gen.error=700` for a run with `300` failed score targets, meaning diagnostics cannot be read as a failed-target counter. Convex insights also show heavy OCC churn on `process_observability` (`domain/runs/run_service.js:applyRequestResult` and `handleRequestError`) and historical read-limit errors on earlier reporting/debug functions, which can add noise to operator triage without changing the target-level artifact truth.
