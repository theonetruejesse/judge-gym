# Final Report: V4 Data Organization R01

## Objective

Inventory the current live and local V4 artifacts, separate paper-audit assets from native conceptual-study surfaces, identify which conceptual setups can run now versus which are blocked on missing bundle/spec work, and produce implementation-facing manifests/docs for the next launch phase.

## Workflow Summary

- Objective class: `inventory_and_readiness_audit`
- Operating mode: `patch_and_local_analysis`
- Execution mode: `compile_and_execute`

## Findings

- Added a repeatable inventory command at `bun run v4:inventory`.
- Exported the live catalog and local artifact summary to `_local/v4_inventory/live_inventory.json` and `_local/v4_inventory/live_inventory.md`.
- Added the human-readable split document at `docs/pilots/v4_data_inventory.md`.
- The current live V4 surface contains 22 completed experiments when canaries and reruns are included.
- The native conceptual-study lane is runnable on the current substrate for GPT-4.1-only baseline, abstention, raw/source-text versus semantic-view comparisons, and fixed/random bundled runs.
- The main blocked conceptual surface is clustering: `semantic_cluster` and `semantic_cluster_projected` are still unsupported for V4 evidence-set-backed runs.
- The inventory surfaced real own-dev catalog anomalies:
  - duplicate `gilardi_relevance_v1` universe tags
  - duplicate `gilardi_relevance_v1_canary_set` evidence-set tags
  - 4 experiment rows with multiple completed runs

## Decisions

- Keep paper-audit live state, local paper-audit bundles, and native conceptual queue as separate inventories.
- Do not spend more provider budget before freezing a GPT-4.1-only native conceptual manifest.
- Treat the duplicate Gilardi catalog rows as the next cleanup target before broader launch expansion.

## Validation

- `bun run v4:inventory`
- `bun run typecheck`
- `python3 /Users/jesselee/.codex/skills/deep-workflow/scripts/validate_workflow.py _deep_workflows/v4-data-organization-r01`
