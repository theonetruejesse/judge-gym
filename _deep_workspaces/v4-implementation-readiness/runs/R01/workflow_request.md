# Workflow Request: R01

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/v4-implementation-readiness
- Terminal objective: Implement everything needed to execute the locked V4 study end to end, leaving only the final live API calls to create experiments, import data into Convex, and launch scrape or run jobs.

## Bounded Objective

- Implement the missing V4 paper-audit execution path: add a paper-audit package registry, make the run pipeline package-aware for Gilardi and Zheng, add local source acquisition and import builders for both targets, align OpenRouter with the Qwen policy, and add smoke/canary harnesses so only live Convex import and experiment/job creation calls remain.

## Inputs

- `docs/pilots/v4_specs.md`
- `_deep_workflows/v4-implementation-logistics-r07/synthesis/final_report.md`
- `_deep_workspaces/v4-implementation-readiness/workspace.json`
- `_deep_workspaces/v4-implementation-readiness/worldview.json`
- `apps/engine-convex/convex/models/experiments.ts`
- `apps/engine-convex/convex/domain/runs/experiments_repo.ts`
- `apps/engine-convex/convex/domain/runs/run_repo.ts`
- `apps/engine-convex/convex/packages/worker.ts`
- `apps/engine-convex/convex/packages/lab.ts`
- `packages/engine-prompts/src/run/config.ts`
- `packages/engine-settings/src/provider.ts`
- `apps/engine-temporal/src/run/service.ts`
- `apps/engine-convex/scripts/v4_smoke.ts`

## Validation

- Convex validation passes after schema or function changes.
- Targeted engine-convex and engine-temporal tests cover package-aware runtime behavior.
- Local source fetchers materialize real Gilardi and Zheng artifacts under an ignored local workspace.
- Smoke/canary scripts prepare package-aware experiments locally without requiring live Convex imports yet.

## Promotion Rule

- Promote the run only if the codebase can package Gilardi and Zheng locally, express package-aware experiments in code, cover the Qwen OpenRouter lane in smoke/canary scripts, and the only remaining work is live import/experiment/job API calls.
