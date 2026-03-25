# Workflow Request: R05

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/v4-experiment-matrix-spec
- Terminal objective: Specify a self-contained V4 paper program and final experiment matrix for judge-gym, grounded in pilots, literature-audit targets, and multi-provider runtime constraints.

## Bounded Objective

- Repackage the final V4 matrix after the provider-lane reopen.
- Update the headline provider panel to replace the old OpenRouter placeholder with the Qwen-centered lane.
- Add an appendix/watchlist provider policy without reopening unrelated study-design questions.

## Inputs

- `_deep_workflows/v4-provider-surface-r04/agents/N02/revised_provider_policy.md`
- `_deep_workflows/v4-provider-surface-r04/agents/N02/revised_provider_policy.json`
- `_deep_workflows/v4-provider-surface-r04/agents/N03/reopen_decision.md`
- `_deep_workflows/v4-matrix-spec-r03/agents/N01/final_matrix_memo.md`
- `_deep_workflows/v4-matrix-spec-r03/agents/N01/implementation_spec.md`
- `_deep_workspaces/v4-experiment-matrix-spec/workspace.json`
- `_deep_workspaces/v4-experiment-matrix-spec/worldview.json`

## Validation

- Emit a revised final matrix memo.
- Emit a revised implementation-facing study spec.
- Emit a closeout artifact that marks the campaign closed again.

## Promotion Rule

- Promote only if the revised provider policy is fully integrated and the campaign can close without reopening more matrix questions.
