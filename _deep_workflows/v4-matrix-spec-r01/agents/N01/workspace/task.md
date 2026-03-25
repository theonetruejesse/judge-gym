# Node Task: N01

- Role: pilot-and-thesis-synthesizer
- Kind: analyze
- Objective: Extract the V2/V3 carry-forward claims, guardrails, and non-goals that the final V4 matrix must preserve.

## Dependencies

- None

## Contract

- Inputs: ["docs/pilots/paper.md", "docs/pilots/v3_gpt_ablations.md", "_deep_workspaces/v4-experiment-matrix-spec/workspace.json"]
- Effects: ["read_code", "read_state", "write_private_artifacts"]
- Allowed tools: ["shell", "rg", "sed"]
- Allowed scripts: []
- Required outputs: ["pilot_guardrails.md", "findings.json"]
- Completion criteria: ["State the primary V4 carry-forward levers from the pilots.", "State which tempting expansions should be excluded from the final matrix."]

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

