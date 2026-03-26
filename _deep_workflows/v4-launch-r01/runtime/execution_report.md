# Execution Report: V4 Launch R01

## Bootstrap

- Result: bootstrapped
- Execution substrate: rlm
- Node count: 1

## Node Workspaces

- N01: workspace `agents/N01/workspace`, delegates `agents/N01/delegates`

## Node Runtime Notes

- `N01` executed as a live setup and canary-launch node.
- The first two live failures were schema-safe launch-tool bugs in `scripts/v4/apply_bundle.ts`, not runtime or worker failures.
- After tightening the experiment-config allowlist, all three baseline canaries launched and completed successfully.
