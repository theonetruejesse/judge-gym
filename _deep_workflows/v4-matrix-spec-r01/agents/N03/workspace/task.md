# Node Task: N03

- Role: matrix-compiler
- Kind: synthesize
- Objective: Compile the candidate final V4 matrix, including targets, providers, evidence-view policy, perturbation families, endpoints, and sanity checks.

## Dependencies

- N01: completed
- N02: completed

## Contract

- Inputs: ["agents/N01/pilot_guardrails.md", "agents/N01/findings.json", "agents/N02/launch_bundle_policy.md", "agents/N02/decisions.json", "_deep_workspaces/v4-experiment-matrix-spec/workspace.json"]
- Effects: ["read_state", "write_private_artifacts"]
- Allowed tools: ["shell", "rg", "sed"]
- Allowed scripts: []
- Required outputs: ["matrix_candidate.md", "matrix_sheet.json"]
- Completion criteria: ["Emit one candidate final matrix that is bounded and paper-ready.", "Include explicit raw-versus-semantic evidence usage rules and primary endpoints."]

## Execution Roots

- Write scope: agents/N03/
- Workspace root: workspace/
- Delegate root: delegates/
- Can spawn subagents: False
- Max subagents: 0

## Notes

- Keep all transient work inside the workspace or delegate roots.
- Do not write shared state directly unless the node effects explicitly allow shared writes.
- Completion is inferred from the presence of required outputs.

