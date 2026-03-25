# Workflow Request: R06

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/v4-experiment-matrix-spec
- Terminal objective: Specify a self-contained V4 paper program and final experiment matrix for judge-gym, grounded in pilots, literature-audit targets, and multi-provider runtime constraints.

## Bounded Objective

- Determine which V3 experiment families should carry forward into V4.
- Lock a portability policy that distinguishes headline, appendix, and excluded V3 levers.
- Repackage the V4 spec around those decisions and update the living `docs/pilots/v4_specs.md` contract.

## Inputs

- `docs/pilots/v3_gpt_ablations.md`
- `docs/pilots/paper.md`
- `docs/pilots/v4_specs.md`
- `_deep_workflows/v4-provider-surface-r05/agents/N01/final_matrix_memo.md`
- `_deep_workflows/v4-provider-surface-r05/agents/N01/implementation_spec.md`
- `_deep_workspaces/v4-experiment-matrix-spec/worldview.json`

## Validation

- Emit a V3-to-V4 transfer policy with concrete carry-forward decisions.
- Emit a revised V4 spec with a more complete matrix and appendix policy.
- Keep the study bounded; no reopening of target bundle or provider-family identity.

## Promotion Rule

- Promote only if the revised spec yields stronger conviction on which V3 levers matter for V4 and the campaign can remain closed after the update.
