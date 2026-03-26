# Workflow Request: R01

## Parent Workspace

- Workspace: /Users/jesselee/dev/research/jg/judge-gym/_deep_workspaces/infra-readiness-hardening
- Terminal objective: Harden judge-gym infra for V4 launch by moving Media Cloud acquisition to the Temporal execution plane, validating full smoke/screen coverage, clearing irrelevant Convex and Railway state, and simplifying Railway bootstrap/linking so contributors can provision the stack from scratch.

## Bounded Objective

- Compile and execute the first infra-hardening loop: move Media Cloud acquisition from Convex-owned node actions into the Temporal worker, preserve Convex as the control-plane and persistence surface, define and run the smallest trustworthy smoke ladder for local plus live validation, and identify any remaining cleanup/bootstrap work that must happen before V4 launch operations.

## Inputs

- Current acquisition ownership:
  - `apps/engine-convex/convex/domain/evidence/mediacloud.ts`
  - `apps/engine-convex/convex/domain/evidence/evidence_service.ts`
  - `apps/engine-convex/convex/packages/evidence.ts`
- Current Temporal runtime:
  - `apps/engine-temporal/src/`
  - `apps/engine-temporal/src/evidence_transform/`
  - `apps/engine-temporal/src/convex/client.ts`
- Current Railway bootstrap and docs:
  - `scripts/deploy_railway_worker.sh`
  - `docs/railway.md`
  - `docs/setup.md`
  - `README.md`
- Existing V4 local import and canary tooling:
  - `scripts/v4/*`
  - root `package.json`
- Live deployment context:
  - Convex own-dev `combative-pika-662`
  - Railway project `sincere-freedom`
  - linked worker service `engine-temporal-worker`

## Validation

- `bun run validate:convex`
- Targeted Bun test suites for acquisition/runtime changes
- Fresh Railway worker deployment plus live log confirmation that the worker reaches steady `RUNNING`
- At least one narrow smoke proving the new acquisition path works through the intended execution plane
- Workspace validation after the run closes

## Promotion Rule

- Promote the run only if Media Cloud acquisition ownership is moved or decisively reduced on the Convex side, the worker deployment contract is updated and verified live, smoke coverage is concrete enough to trust the infra, and the next cleanup/bootstrap steps are explicit and bounded.
