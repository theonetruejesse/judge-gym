# Node Task: N04

- Role: campaign-closure-judge
- Kind: synthesize
- Objective: Judge whether the candidate matrix is sufficient to close the workspace or whether a follow-up run is still required.

## Dependencies

- N03: completed

## Contract

- Inputs: ["agents/N03/matrix_candidate.md", "agents/N03/matrix_sheet.json", "_deep_workspaces/v4-experiment-matrix-spec/worldview.json"]
- Effects: ["read_state", "write_private_artifacts"]
- Allowed tools: ["shell", "rg", "sed"]
- Allowed scripts: []
- Required outputs: ["closure_recommendation.md", "summary.json"]
- Completion criteria: ["Say clearly whether the campaign can stop or must open a follow-up run.", "If a follow-up run is needed, narrow it to concrete remaining decisions."]

## Execution Roots

- Write scope: agents/N04/
- Workspace root: workspace/
- Delegate root: delegates/
- Can spawn subagents: False
- Max subagents: 0

## Notes

- Keep all transient work inside the workspace or delegate roots.
- Do not write shared state directly unless the node effects explicitly allow shared writes.
- Completion is inferred from the presence of required outputs.

