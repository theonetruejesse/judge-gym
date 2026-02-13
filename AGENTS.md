# judge-gym

An open-source LLM-as-Judge design space engine. Turborepo monorepo with bun (engine) and uv (analysis).

## Structure

- `packages/engine/convex/` — Convex backend (schema, workflows, agents, strategies)
- `packages/analysis/` — Python analysis (uv + Jupyter). DST, JSD, OLS.

## Convex Code Style

- Use zod-based helpers from `packages/engine/convex/utils.ts` (`zMutation`, `zQuery`, `zInternalAction`, etc.).
- Define `args` with zod + `zid(...)` and explicit `returns` validators.
- Prefer `internal.*` function references for cross-function calls.
- 2-space indent, semicolons, trailing commas.
- Use underscores (`_`) not hyphens (`-`) in all Convex filenames. Convex file-based routing does not support hyphens. Example: `rate_limiter.ts`, `workflow_manager.ts`, `verdict_parser.ts`.
- Schema first — check `convex/schema.ts` before writing any function.
- Reuse existing schemas and types wherever possible instead of redefining them.

## Guardrails

- Do not run `bun dev`, `npx convex dev`, or `uv run jupyter` unless explicitly instructed; assume they are already running.
- Do not call write operations (`main:*` mutations) unless explicitly instructed.
- Do not modify environment variables without explicit user approval.
- After any Convex code or schema changes, run `bun run typecheck` (root) to validate TypeScript types.
- When a large or mixed change set is ready for review, use the `coderabbit-pr` skill.

## Analysis Development (Python / Jupyter)

### Script-first workflow

**Do not edit `.ipynb` files directly** for non-trivial changes. Notebook JSON is fragile
(cell indices shift, outputs bloat string matching, edits hit output blobs).

Instead, use the **script → run → read log → iterate** loop:

1. **Write** a standalone `.py` script (or edit an existing one like `notebooks/pilot_v2.py`).
   - Import shared code from `judge_gym.*` (same as notebooks do).
   - Save figures to `packages/analysis/scripts/output/*.png` via `savefig()`.
   - All print output (tables, metrics, diagnostics) goes to stdout **and**
     is tee'd into `scripts/output/run.log` (fresh every run).
2. **Run** via `cd packages/analysis && uv run python <script>.py`.
3. **Review ALL outputs** — after every run, you **must**:
   - Read `scripts/output/run.log` (printed tables, metrics, warnings, timing).
   - Read every `.png` image that was created or changed in `scripts/output/`.
   - Check that figures are actually readable (no overlapping text, no squished
     cells, correct aspect ratios, legible labels). If they aren't, fix and re-run.
     This is non-negotiable. Never skip this step. It closes the feedback loop.
4. **Iterate** — fix errors or visual issues, re-run, re-review until correct.
5. **Deliver** the working code. The user pastes it into the notebook, or the agent
   writes a single new notebook cell referencing the script output.

### Rules

- Use `uv` as the package manager. When adding new dependencies, run
  `cd packages/analysis && uv add <package>` (this updates `pyproject.toml` + `uv.lock`).
- `scripts/output/` is gitignored scratch space for figures and logs.
- Notebooks in `notebooks/` are the user's final artifacts — only make targeted,
  small edits (single-cell appends) when explicitly asked.
- Always read the notebook before editing to understand available variables and cell order.
