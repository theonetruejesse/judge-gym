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

## Live Debug Loop

Use the codex debug surface (`packages/engine/convex/packages/codex.ts`) plus Bun scripts for run/window triage and safe recovery.

### Preflight
- Confirm you are in `packages/engine`.
- Prefer dry-run actions first.

### Monitor
- Run process: `bun run debug:watch --run <run_id>`
- Window process: `bun run debug:watch --window <window_id>`
- Trace tail: `bun run debug:tail --trace run:<run_id>`

### Diagnose
- List stuck work globally: `bun run debug:stuck --older-ms 120000`
- List stuck work for runs only: `bun run debug:stuck --older-ms 120000 --run <run_id>`

### Recover (safe automation)
- Dry-run auto-heal run: `bun run debug:heal --run <run_id>`
- Apply auto-heal run: `bun run debug:heal --run <run_id> --apply`
- Dry-run auto-heal window: `bun run debug:heal --window <window_id>`
- Apply auto-heal window: `bun run debug:heal --window <window_id> --apply`

### Recovery Guardrails
- Default to dry-run for first pass.
- Only use codex safe actions (`start_scheduler_if_idle`, request requeue, expired lease release, poll nudge).
- If a process remains stalled after safe actions, inspect `getProcessHealth` and trace events before any manual data mutation.

## Fresh-Context MCP Runbook

Use this when a new Codex instance has zero prior context.

### 1. Identify deployment and latest experiments
- `mcp__convex__status` with `projectDir=/Users/jesselee/dev/research/jg/judge-gym/packages/engine`
- `mcp__convex__run` -> `packages/lab:listExperiments` with `{}`

### 2. Clone a new experiment from an existing experiment
- Source config:
  - `mcp__convex__run` -> `packages/lab:getExperimentSummary` with `{ "experiment_id": "<source_experiment_id>" }`
- Source evidence set:
  - `mcp__convex__run` -> `packages/lab:listExperimentEvidence` with `{ "experiment_id": "<source_experiment_id>" }`
- Create new experiment:
  - `mcp__convex__run` -> `packages/lab:initExperiment` with:
    - `experiment_config` from source summary (`rubric_config`, `scoring_config`)
    - `evidence_ids` from source evidence list

### 3. Start run and monitor
- Start:
  - `mcp__convex__run` -> `packages/lab:startExperimentRun` with `{ "experiment_id": "<new_experiment_id>", "target_count": <n> }`
- Monitor:
  - `mcp__convex__run` -> `packages/lab:getRunSummary`
  - `mcp__convex__run` -> `packages/lab:getRunDiagnostics`
  - `mcp__convex__run` -> `packages/lab:getTraceEvents`
  - Optional CLI: `bun run debug:watch --run <run_id>`

### 4. Stall diagnosis and safe recovery
- Find stuck work:
  - `mcp__convex__run` -> `packages/codex:getStuckWork`
  - CLI: `bun run debug:stuck --older-ms 120000`
- Heal:
  - Dry-run: `mcp__convex__run` -> `packages/codex:autoHealProcess` with `dry_run: true`
  - Apply: same call with `dry_run: false`
  - CLI: `bun run debug:heal --run <run_id>` then `--apply`

### 5. Current known limitation
- `packages/codex:getProcessHealth` can exceed Convex read limits on large runs (for example `target_count=30` with large score-unit fanout).
- Workaround for now:
  - Use `packages/lab:getRunDiagnostics` + `packages/lab:getTraceEvents` + `packages/codex:getStuckWork`.
  - Do not rely on `getProcessHealth` as the single source of truth for high-cardinality runs until optimized.

## Agentic Recursion Contract

For every merged behavior change (orchestration, telemetry, retries, scheduling, diagnostics):

1. Documentation update check is mandatory
- Update `AGENTS.md` when operator flow, debugging flow, or agent workflow changes.
- Update `README.md` when architecture, tables, scripts, or user-facing behavior changes.
- Update `docs/live_debug_loop.md` when debug commands, MCP function usage, or recovery playbooks change.

2. Evidence + validation note is mandatory
- Record what was validated (typecheck/tests/live checks) in the PR or task summary.
- If a limitation remains, document:
  - exact symptom,
  - scope/impact,
  - current workaround,
  - planned fix direction.

3. Fresh-context operability is mandatory
- A new agent with no prior context must be able to:
  - identify deployment,
  - clone/start an experiment from existing configs,
  - monitor progress,
  - diagnose stalls,
  - apply safe recovery.
- If any of these steps changed, update the “Fresh-Context MCP Runbook” in the same change.

4. Release gate
- No change is considered complete until the docs above are updated or explicitly confirmed unchanged in the final task summary.
