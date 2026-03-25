# Workflow Request: R02

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/v4-experiment-matrix-spec
- Terminal objective: Specify a self-contained V4 paper program and final experiment matrix for judge-gym, grounded in pilots, literature-audit targets, and multi-provider runtime constraints.

## Bounded Objective

- Resolve the remaining matrix-blocking decisions from R01: decide the exact role of Ziems, decide the wave-1 OpenRouter breadth policy, and lock the target-specific conditional extension table.

## Inputs

- `_deep_workflows/v4-matrix-spec-r01/agents/N03/matrix_candidate.md`
- `_deep_workflows/v4-matrix-spec-r01/agents/N03/matrix_sheet.json`
- `_deep_workflows/v4-matrix-spec-r01/agents/N04/summary.json`
- `packages/engine-settings/src/provider.ts`

## Validation

- Emit a locked policy artifact that:
- prunes or locks every remaining R01 blocker,
- leaves no unresolved matrix-design decisions,
- and narrows the next run to packaging only.

## Promotion Rule

- Promote the R02 output only if it yields a fully locked matrix policy that is smaller or equal in scope to the R01 candidate and more executable in practice.
