# Node Task: N01

- Role: final-packager
- Kind: synthesize
- Objective: Turn the locked R02 policy into the final V4 matrix memo and implementation-facing study spec.

## Dependencies

- None

## Contract

- Inputs: ["_deep_workflows/v4-matrix-spec-r02/agents/N02/locked_policy.md", "_deep_workflows/v4-matrix-spec-r02/agents/N02/locked_policy.json", "_deep_workspaces/v4-experiment-matrix-spec/workspace.json"]
- Effects: ["read_state", "write_private_artifacts"]
- Allowed tools: ["shell", "rg", "sed"]
- Allowed scripts: []
- Required outputs: ["final_matrix_memo.md", "implementation_spec.md"]
- Completion criteria: ["Emit a final matrix memo that can be read as the campaign result.", "Emit an implementation-facing study spec."]

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

