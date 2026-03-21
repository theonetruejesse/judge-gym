# judge-gym

Open-source LLM-as-Judge design-space engine. Turborepo monorepo with Bun (`apps/engine-convex`, `apps/engine-temporal`, `packages/engine-settings`) and uv (`apps/analysis`).

## Structure

- `apps/engine-convex/convex/` — Convex backend
- `apps/engine-temporal/` — Temporal worker runtime
- `packages/engine-settings/` — shared runtime-agnostic config/constants
- `packages/engine-prompts/` — shared prompt builders and experiment-config helpers
- `apps/analysis/` — Python analysis
- `_campaigns/` — campaign state and machine-readable launch/reset manifests
- `skills/` — repo-versioned Codex skills

## Convex Code Style

- Use zod helpers from `apps/engine-convex/convex/utils.ts` (`zMutation`, `zQuery`, `zInternalAction`, etc.).
- Define `args` with zod + `zid(...)` and explicit `returns` validators.
- Prefer `internal.*` references for cross-function calls.
- 2-space indent, semicolons, trailing commas.
- Use underscores (`_`) in Convex filenames.
- Schema first: check `convex/schema.ts` before changing functions.
- Reuse existing schemas and types instead of redefining them.

## Guardrails

- Do not run `bun dev`, `npx convex dev`, or `uv run jupyter` unless explicitly instructed.
- Do not run `npx convex codegen` unless explicitly instructed.
- Do not modify environment variables without explicit user approval.
- After any Convex code or schema change, run the full validation routine:
  1. `bun run validate:convex`, or
  2. `cd apps/engine-convex && npx convex codegen`, then `bun run typecheck` from repo root.
- Treat codegen + root typecheck as one routine.
- After behavior changes, update `README.md`.

## Commit Practice

- Commit only after validation passes or after recording an explicit blocker.
- Keep commits scoped to one coherent change set.
- Check `git status --short` before committing and exclude generated noise such as `*.tsbuildinfo`.
- Final summaries must state:
  - what changed,
  - what was validated,
  - any remaining limitation.

## Generic Debug Surfaces

Use codex/lab APIs plus Bun wrappers for generic run/window triage:

- `packages/codex:getProcessHealth`
- `packages/codex:getStuckWork`
- `packages/codex:autoHealProcess`
- `packages/lab:getRunSummary`
- `packages/lab:getRunDiagnostics`
- `packages/lab:listRunScoreTargets`
- `bun run debug:watch`
- `bun run debug:stuck`
- `bun run debug:heal`
- `bun run debug:tail`
- `bun run debug:analyze`

These are generic engine/debug tools. Do not put campaign-specific procedures here.

## V3 Finish Pass

- Use the `v3-finish-pass` skill for the autonomous V3 campaign loop.
- Treat `_campaigns/v3_finish_pass/manifest.json` as the machine-readable contract for that mission.
- Treat the `experiments` table as the live experiment-config source of truth.

## Fresh-Context Bootstrap

For a new agent with no prior context:

1. Identify the deployment with `mcp__convex__status` using `apps/engine-convex`.
2. Enumerate experiments with `packages/lab:listExperiments`.
3. If the task is the V3 campaign, switch to the `v3-finish-pass` skill and use the campaign manifest/state files.
