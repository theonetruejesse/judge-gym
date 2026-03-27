# Workflow Request: R01

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/v4-data-organization
- Terminal objective: Organize the current V4 data and result surfaces across paper-audit and native conceptual-study lanes, identify which conceptual setups are runnable now versus blocked on missing bundle/spec work, and leave the repo ready for a controlled next launch phase before broader provider expansion.

## Bounded Objective

- Inventory the current live and local V4 artifacts, separate paper-audit assets from native conceptual-study surfaces, identify which conceptual setups can run now versus which are blocked on missing bundle/spec work, and produce implementation-facing manifests/docs for the next launch phase.

## Inputs

- `docs/pilots/v4_specs.md`
- `_deep_workflows/v4-launch-r04/synthesis/final_report.md`
- `_deep_workflows/v4-launch-r05/synthesis/final_report.md`
- `_local/v4_sources/`
- `_local/v4_builds/`
- live Convex package surfaces for experiments, evidence universes/sets, and paper-audit packages

## Validation

- `bun run v4:inventory`
- `bun run typecheck`
- inventory files created under `_local/v4_inventory/`

## Promotion Rule

- Promote back into the workspace only if the repo ends with a repeatable inventory command, a human-readable data split, and a clear GPT-4.1-only conceptual next queue.
