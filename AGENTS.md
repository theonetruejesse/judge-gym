# judge-gym

An open-source LLM-as-Judge design space engine. Turborepo monorepo with bun (engine) and uv (analysis).

Read `blueprint.md` for the full architecture and research protocol.

## Structure

- `packages/engine/convex/` — Convex backend (schema, workflows, agents, strategies)
- `packages/analysis/` — Python analysis (uv + Jupyter). DST, JSD, OLS.
- `blueprint.md` — Architecture reference and research protocol

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

## MCP Operations

### Setup Checklist

Before running any experiment:

1. `convex-status` → get the dev deployment selector
2. `convex-envList` → verify API keys are set (validated at runtime by `convex/env.ts`):
   - `OPENAI_API_KEY` (required)
   - `ANTHROPIC_API_KEY` (required)
   - `FIRECRAWL_API_KEY` (required)
   - `XAI_API_KEY` (optional)
   - `GOOGLE_API_KEY` (optional)
   - `OPENROUTER_API_KEY` (optional)
3. `convex-tables` → verify schema is deployed

### Public Mutations (Write Operations — only when explicitly instructed)

| Function                     | Args                                                                           | Purpose                                        |
| :--------------------------- | :----------------------------------------------------------------------------- | :--------------------------------------------- |
| `main:createWindow`          | `{ startDate, endDate, country }`                                              | Create a time window for evidence collection   |
| `main:createExperiment`      | `{ experimentId, windowId, modelId, taskType, concept, groundTruth?, config }` | Create an experiment (point in design space)   |
| `main:startEvidencePipeline` | `{ windowId, experimentId, limit? }`                                           | W1: Collect + neutralize evidence for a window |
| `main:startRubricGeneration` | `{ experimentId }`                                                             | W2: Generate rubric from experiment config     |
| `main:startScoringTrial`     | `{ experimentId, samples? }`                                                   | W3: Run scoring workflow                       |
| `main:startSwapTrial`        | `{ experimentId, swapRubricFrom }`                                             | W4: Rubric swap trial                          |
| `main:startProbingTrial`     | `{ experimentId }`                                                             | W5: Epistemic probes                           |

### Public Queries (Read Operations)

| Function                         | Args               | Returns                          |
| :------------------------------- | :----------------- | :------------------------------- |
| `data:getExperimentSummary`      | `{ experimentId }` | Counts, models, status, taskType |
| `data:listExperimentRubrics`     | `{ experimentId }` | Rubrics with qualityStats        |
| `data:listExperimentSamples`     | `{ experimentId }` | Samples with decodedScores       |
| `data:listExperimentProbes`      | `{ experimentId }` | Probes with expertAgreementProb  |
| `data:listExperimentsByTaskType` | `{ taskType }`     | All experiments of a given type  |
| `data:exportExperimentCSV`       | `{ experimentId }` | Flat denormalized rows           |

### Recipes

#### Run a full ECC experiment

1. `convex-run main:createWindow { ... }` → returns windowId
2. `convex-run main:createExperiment { ... }` with full config
3. `convex-run main:startEvidencePipeline { "windowId": "<id>", "experimentId": "...", "limit": 15 }`
4. Monitor: `convex-logs` → watch for evidence pipeline complete
5. `convex-run main:startRubricGeneration { "experimentId": "..." }`
6. Verify: `convex-run data:listExperimentRubrics { "experimentId": "..." }`
7. `convex-run main:startScoringTrial { "experimentId": "...", "samples": 5 }`
8. Monitor: `convex-run data:getExperimentSummary { "experimentId": "..." }`
9. `convex-run main:startProbingTrial { "experimentId": "..." }`

#### Quick data check

```
convex-data experiments desc limit=10
convex-runOneoffQuery → ad-hoc JS query for custom aggregations
```

#### Debug a failed workflow

1. `convex-logs` → find error entries
2. `convex-data experiments asc` → check experiment status
3. `convex-runOneoffQuery` → inspect specific records
4. Fix code, redeploy, re-trigger the failed step

### Rules

- NEVER call `internal.*` functions via MCP — only `main:*` and `data:*`.
- ALWAYS call `convex-status` first to get the deployment selector.
- When creating multiple experiments for a sweep, batch them sequentially.
- When monitoring workflows, poll `convex-logs` or `data:getExperimentSummary`.
- For data analysis, prefer `data:exportExperimentCSV` over raw table reads.
