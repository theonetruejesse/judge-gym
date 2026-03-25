# Workflow Request: R03

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/v4-experiment-matrix-spec
- Terminal objective: Specify a self-contained V4 paper program and final experiment matrix for judge-gym, grounded in pilots, literature-audit targets, and multi-provider runtime constraints.

## Bounded Objective

- Package the locked V4 policy into the final matrix memo, implementation-facing study spec, and workspace closeout artifacts, then close the campaign.

## Inputs

- `_deep_workflows/v4-matrix-spec-r02/agents/N02/locked_policy.md`
- `_deep_workflows/v4-matrix-spec-r02/agents/N02/locked_policy.json`
- `_deep_workspaces/v4-experiment-matrix-spec/workspace.json`
- `_deep_workspaces/v4-experiment-matrix-spec/worldview.json`

## Validation

- Emit:
- a final matrix memo,
- an implementation-facing study spec,
- and an explicit closeout decision marking the campaign terminal.

## Promotion Rule

- Promote the R03 output only if it closes the current objective without reopening policy or matrix-design questions.
