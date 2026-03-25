# Workflow Request: R07

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/v4-experiment-matrix-spec
- Terminal objective: Specify a self-contained V4 paper program and final experiment matrix for judge-gym, grounded in pilots, literature-audit targets, and multi-provider runtime constraints.

## Bounded Objective

- Translate the locked V4 matrix into an implementation logistics package.
- Specify how paper targets should be ingested and packaged.
- Identify which parts of the current engine already support faithful audits.
- Isolate the remaining missing code before target-specific smoke and canary runs.
- Define where bundle checks belong across literature-audit versus native evidence studies.

## Inputs

- `docs/pilots/v4_specs.md`
- `docs/pilots/v3_gpt_ablations.md`
- `_deep_workspaces/v4-experiment-matrix-spec/worldview.json`
- `_deep_workflows/v4-provider-surface-r05/agents/N01/implementation_spec.md`
- `_deep_workflows/v4-v3-transfer-r06/agents/N02/revised_v4_spec.md`
- `packages/engine-prompts/src/run/config.ts`
- `apps/engine-convex/convex/models/experiments.ts`
- `apps/engine-convex/convex/packages/evidence.ts`
- `apps/engine-convex/convex/domain/runs/experiments_repo.ts`
- `apps/engine-convex/convex/domain/runs/run_repo.ts`
- `apps/engine-convex/scripts/v4_smoke.ts`

## Validation

- Answer four concrete questions with repo-grounded evidence:
- what gets swapped directly from target papers versus wrapped in a package layer
- what infrastructure already exists for paper-faithful execution
- what code is still missing before `Gilardi` and `Zheng` canaries
- which bundle-sensitive lanes belong in headline, appendix, or native-only studies

## Promotion Rule

- Promote the result if it closes the logistics ambiguity without reopening the matrix.
- `docs/pilots/v4_specs.md` should gain an implementation-logistics section.
- The workspace should end with a concrete build checklist for target-specific canaries.
