# Validation Report

- `python3 _deep_workflows/v4-launch-r04/runtime/analyze_headline_matrix.py`
- `./scripts/run_convex.sh packages/analysis:getAnalysisManifest '{"experiment_tag":"gilardi_relevance_v1_baseline_gpt41"}'`
- `./scripts/run_convex.sh packages/analysis:listAnalysisResponses '{"run_id":"kx76dvnb56czb099ay5jc0s9s583qncx","pagination":{"limit":5}}'`
- `./scripts/run_convex.sh packages/analysis:listAnalysisRubrics '{"run_id":"kx76dvnb56czb099ay5jc0s9s583qncx","pagination":{"limit":5}}'`
- `./scripts/run_convex.sh packages/analysis:listAnalysisRubrics '{"run_id":"kx77tkb9vy5ek2bpvdynapth5n83q0k9","pagination":{"limit":5}}'`
- Verified workflow artifact outputs:
  - `_deep_workflows/v4-launch-r04/runtime/headline_analysis.json`
  - `_deep_workflows/v4-launch-r04/synthesis/analysis_findings.md`
