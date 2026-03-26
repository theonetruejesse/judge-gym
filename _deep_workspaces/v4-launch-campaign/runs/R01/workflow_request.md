# Workflow Request: R01

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/v4-launch-campaign
- Terminal objective: Execute the locked V4 wave-1 study end to end: import Gilardi and Zheng into Convex, register paper-audit packages, create the headline experiments, run canaries, monitor stability, and continue iterating until the V4 launch cohort is scientifically and operationally ready.

## Bounded Objective

- Compile and execute the first V4 launch loop: apply the live Gilardi and Zheng import bundles into Convex, register their paper-audit packages, create the baseline canary experiments under the locked V4 contract, define the monitoring/debug ladder for those canaries, and produce explicit promotion gates from target canaries to full headline matrix instantiation.

## Inputs

- Locked study contract:
  - `docs/pilots/v4_specs.md`
  - `_deep_workspaces/v4-experiment-matrix-spec/worldview.json`
- Terminal implementation readiness:
  - `_deep_workspaces/v4-implementation-readiness/worldview.json`
  - `_deep_workflows/v4-implementation-r01/synthesis/final_report.md`
- Terminal infra readiness:
  - `_deep_workspaces/infra-readiness-hardening/worldview.json`
  - `_deep_workflows/infra-hardening-r01/synthesis/final_report.md`
- Local target tooling:
  - `scripts/v4/build_gilardi_import.ts`
  - `scripts/v4/build_zheng_import.ts`
  - `scripts/v4/canary_gilardi.ts`
  - `scripts/v4/canary_zheng.ts`
- Live runtime surfaces:
  - Convex own-dev `combative-pika-662`
  - Railway project `sincere-freedom`
  - worker service `engine-temporal-worker`

## Validation

- `bun run validate:convex` after any code/schema changes
- target-specific live import/package creation succeeds for both Gilardi and Zheng
- baseline canaries launch and produce monitorable run state
- monitoring/debug ladder is concrete enough to diagnose a real failed canary without reopening platform design
- workspace and compiled workflow artifacts validate structurally

## Promotion Rule

- Promote the run only if the first live Gilardi and Zheng setup loop leaves the repo with real Convex-side evidence/package/experiment artifacts, at least one stable baseline canary path, and a clear launch decision boundary for when the 20-experiment headline matrix is safe to instantiate.
