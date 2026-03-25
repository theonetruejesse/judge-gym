# Node Task: N01

- Role: scope-pruner
- Kind: analyze
- Objective: Use the R01 candidate matrix to decide which unresolved branches should be locked versus pruned from the headline paper.

## Dependencies

- None

## Contract

- Inputs: ["_deep_workflows/v4-matrix-spec-r01/agents/N03/matrix_candidate.md", "_deep_workflows/v4-matrix-spec-r01/agents/N03/matrix_sheet.json", "_deep_workflows/v4-matrix-spec-r01/agents/N04/summary.json", "_deep_workspaces/v4-experiment-matrix-spec/workspace.json"]
- Effects: ["read_state", "write_private_artifacts"]
- Allowed tools: ["shell", "rg", "sed"]
- Allowed scripts: []
- Required outputs: ["prune_options.md", "prune_recommendation.json"]
- Completion criteria: ["Make a clear recommendation on Ziems and OpenRouter breadth.", "Prefer a stronger narrower paper over unresolved breadth."]

## Execution Roots

- Write scope: agents/N01/
- Workspace root: workspace/
- Delegate root: delegates/
- Can spawn subagents: False
- Max subagents: 0

## Notes

- Keep all transient work inside the workspace or delegate roots.
- Do not write shared state directly unless the node effects explicitly allow shared writes.
- Completion is inferred from the presence of required outputs.

