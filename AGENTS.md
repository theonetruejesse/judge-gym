# judge-gym

An open-source LLM-as-Judge design space engine. Turborepo monorepo with bun (engine) and uv (analysis).

## Structure

- `packages/engine/convex/` — Convex backend (schema, jobs, agents, strategies)
- `packages/analysis/` — Python analysis (uv + Jupyter). DST, JSD, OLS.

## Convex Code Style

- Use zod-based helpers from `packages/engine/convex/utils.ts` (`zMutation`, `zQuery`, `zInternalAction`, etc.).
- Define `args` with zod + `zid(...)` and explicit `returns` validators.
- Prefer `internal.*` function references for cross-function calls.
- 2-space indent, semicolons, trailing commas.
- Use underscores (`_`) not hyphens (`-`) in all Convex filenames. Convex file-based routing does not support hyphens. Example: `rate_limiter.ts`, `job_scheduler.ts`, `verdict_parser.ts`.
- Schema first — check `convex/schema.ts` before writing any function.
- Reuse existing schemas and types wherever possible instead of redefining them.

## Guardrails

- Do not run `bun dev`, `npx convex dev`, or `uv run jupyter` unless explicitly instructed; assume they are already running.
- Do not run `npx convex codegen` unless explicitly instructed.
- Do not modify environment variables without explicit user approval.
- After any Convex code or schema changes, run `bun run typecheck` (root) to validate TypeScript types.
- After changes, update `README.md` to reflect the current project state.
