# Final Report: R01 Package Runtime and Target Canaries

## Objective

Implement the missing V4 paper-audit execution path: package registry, package-aware runtime, local source acquisition, target import builders, and package-aware canary harnesses for Gilardi and Zheng, leaving only live Convex import and experiment/job creation calls.

## Workflow Summary

- Objective class: implementation
- Operating mode: write_with_local_validation
- Execution mode: executed

## Findings

- Added a first-class `paper_audit_packages` registry and integrated package-aware defaults into experiments and runs.
- Extended parsing to support faithful Gilardi freeform label outputs and Zheng MT-Bench bracket outputs.
- Added local source fetchers, local bundle builders, and dry-run canaries for Gilardi and Zheng.
- Swapped the OpenRouter control lane to the Qwen policy alias and covered it in smoke/canary code paths.
- Reached terminal readiness: only live Convex bundle application and optional canary run launch remain.

## Decisions

- Use local `_local/` bundles as the pre-import handoff artifact instead of mutating Convex during readiness work.
- Keep the stage graph intact and pre-seed direct-label rubric artifacts for paper-faithful packages.
- Treat `--live` canary execution as the first real control-plane action after this workflow.

## Validation

- `bun run validate:convex`
- `cd apps/engine-convex && bun run test -- experiments_contract v4_run_substrate run_parsers`
- `cd apps/engine-temporal && bun run test -- src/mocha/provider-routing.test.ts`
- `bun run v4:fetch:gilardi`
- `bun run v4:fetch:zheng`
- `bun run v4:build:gilardi`
- `bun run v4:build:zheng`
- `bun run v4:canary:gilardi`
- `bun run v4:canary:zheng`
- `bun run v4:canary:zheng --multi-turn`
