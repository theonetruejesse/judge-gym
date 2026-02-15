# Convex backend (judge-gym engine)

This directory contains Convex functions and schema definitions for the judge-gym engine.

## Key conventions

- Filenames use underscores. No hyphens in Convex function filenames.
- Tables are snake_case. All data exports are snake_case for pandas compatibility.
- LLM calls are represented by `llm_requests` and `llm_messages`.
- Provider batching is handled via `llm_batches` and `llm_batch_items`.
- Domain files use a `<domain>_*.ts` prefix (e.g., `llm_calls_batch_poll.ts`).

## Primary modules

- `schema.ts` — all table definitions
- `lab.ts` — public API façade for the UI/CLI
- `domain/*` — domain logic, entrypoints, repos, and workflows
- `domain/llm_calls/llm_calls_requests.ts` — request ledger
- `domain/llm_calls/llm_calls_messages.ts` — normalized message ledger
- `domain/llm_calls/llm_calls_batches.ts` — batch registry and item tracking
- `domain/experiments/stages/*` — stage-local parsers, prompts, and workflows

## Running

Use the repo root `.env.local` for Convex environment variables.
