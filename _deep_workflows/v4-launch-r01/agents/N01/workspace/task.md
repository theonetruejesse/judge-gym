# Node Task: N01

- Role: live-setup-and-canaries
- Kind: validate
- Objective: Apply the live Gilardi and Zheng bundles into Convex, register paper-audit packages, create and launch the baseline canary experiments, inspect their run state, and write explicit promotion gates for the next launch step.

## Dependencies

- None

## Contract

- Inputs: ["docs/pilots/v4_specs.md", "_deep_workspaces/v4-launch-campaign/runs/R01/workflow_request.md", "_deep_workspaces/v4-implementation-readiness/worldview.json", "_deep_workspaces/infra-readiness-hardening/worldview.json", "scripts/v4/canary_gilardi.ts", "scripts/v4/canary_zheng.ts", "apps/engine-convex/scripts/live_debug.ts"]
- Effects: ["read_code", "read_state", "run_local_scripts", "run_mutating_scripts", "touch_live_ops", "write_private_artifacts", "write_shared_artifacts"]
- Allowed tools: ["functions.exec_command", "functions.apply_patch", "functions.mcp__convex__status", "functions.mcp__convex__run", "functions.mcp__railway__list_deployments", "functions.mcp__railway__get_logs"]
- Allowed scripts: []
- Required outputs: ["live_setup.md"]
- Completion criteria: ["Gilardi and Zheng live bundle application succeeds.", "Baseline canary experiment rows exist for both targets.", "At least one live canary run is launched and inspected through a concrete monitoring/debug surface.", "Promotion gates for moving from canaries to full matrix instantiation are written down."]

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

