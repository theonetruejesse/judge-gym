# Convex backend (judge-gym engine)

This directory contains Convex functions and schema definitions for the judge-gym engine.

## Key conventions

- Filenames use underscores. No hyphens in Convex function filenames.
- Tables are snake_case. All data exports are snake_case for pandas compatibility.
- LLM calls are represented by `llm_requests` and `llm_messages`.
- Provider batching is handled via `llm_batches` and `llm_batch_items`.

## Primary modules

- `schema.ts` — all table definitions
- `repo.ts` — internal CRUD helpers
- `llm_requests.ts` — request ledger
- `llm_messages.ts` — normalized message ledger
- `llm_batches.ts` — batch registry and item tracking
- `workflows/*` — batch submission, polling, parsing, and stage enqueues
- `parsers/*` — deterministic rubric/score parsers

## Running

Use the repo root `.env.local` for Convex environment variables.
