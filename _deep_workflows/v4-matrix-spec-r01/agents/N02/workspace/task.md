# Node Task: N02

- Role: target-and-provider-policy-synthesizer
- Kind: analyze
- Objective: Lock the candidate launch bundle, comparator default, and provider panel policy from prior V4 research plus current runtime support.

## Dependencies

- None

## Contract

- Inputs: ["_blueprints/v4-target-resource-viability/blueprint.md", "_blueprints/v4-refactor-and-study-plan/blueprint.md", "_deep_workflows/v4-refactor-and-study-planning/agents/N05/study_design_plan.md", "packages/engine-settings/src/provider.ts", "README.md"]
- Effects: ["read_code", "read_state", "write_private_artifacts"]
- Allowed tools: ["shell", "rg", "sed"]
- Allowed scripts: []
- Required outputs: ["launch_bundle_policy.md", "decisions.json"]
- Completion criteria: ["Choose the default comparator lane.", "State the provider panel and current supported model roster policy.", "Identify any remaining matrix-blocking design decisions."]

## Execution Roots

- Write scope: agents/N02/
- Workspace root: workspace/
- Delegate root: delegates/
- Can spawn subagents: False
- Max subagents: 0

## Notes

- Keep all transient work inside the workspace or delegate roots.
- Do not write shared state directly unless the node effects explicitly allow shared writes.
- Completion is inferred from the presence of required outputs.

