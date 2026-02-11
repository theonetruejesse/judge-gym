# judge-gym batching + agent-kit refactor blueprint

## Goals

- Move from per-call parallelization to true batching at the provider layer.
- Remove dependency on Convex agent kit for core execution.
- Preserve durable workflow semantics: each request has explicit state + error attribution.
- Keep current “reasoning then final VERDICT” parsing contract.
- Avoid threading; each call is a single user→assistant pair.
- Make tracing easy: inputs, outputs, parsed reasoning/verdict, and downstream artifacts (rubrics/scores).

## Current architecture (summary)

- Convex stages:
  - `1_evidence` → evidence generation/cleanup.
  - `2_rubric` → rubric generation + critic.
  - `3_scoring` → scoring + probing + parsing.
- Agents via `@convex-dev/agent` (threads + streaming) through `AbstractJudgeAgent`.
- Rate limiting via `@convex-dev/rate-limiter` with usage table + post-hoc token counts.
- Workflows do coarse “batching” via Promise.all on small chunks.

## Problems we need to solve

- “Batching” is only parallelization; no provider-side batching or true job semantics.
- Durable workflow visibility is coarse: provider errors are not always tied to specific calls.
- Agent kit introduces threading/streaming overhead we don’t use.
- I/O, parsing, and derived artifacts are interleaved, which makes auditing harder.

## Design principles

- **I/O ledger first:** store every LLM request/response with full metadata.
- **Workflow-friendly:** requests move through explicit states; retries are scoped per request.
- **Provider-agnostic:** keep a thin adapter layer for OpenRouter or other providers.
- **No threads:** every request is standalone (user+assistant).

## Proposed schema (new tables)

### `llm_requests`

Tracks each individual model call.

- `purpose`: "evidence" | "rubric" | "critic" | "scoring" | "probe" | …
- `provider`: "openrouter" (initially)
- `model`: string (model id)
- `input`: { system?: string, user: string, variables?: Record<string,string> }
- `params`: { temperature, maxTokens, topP?, etc }
- `status`: "queued" | "submitted" | "completed" | "error" | "canceled"
- `batchId`: Id<"llm_batches"> | null
- `rawOutput`: string | null
- `reasoning`: string | null
- `verdictText`: string | null
- `parsedVerdict`: unknown | null
- `error`: { code?: string, message: string } | null
- `createdAt`, `updatedAt`
- `trace`: { experimentId?, rubricId?, scoreId?, evidenceId?, sampleId? }

### `llm_batches`

Tracks provider batch jobs.

- `provider`: "openrouter"
- `model`: string
- `status`: "queued" | "submitted" | "completed" | "error"
- `requestIds`: Id<"llm_requests">[]
- `providerBatchId`: string | null
- `submittedAt`, `completedAt`
- `error`: { code?: string, message: string } | null

### Optional: `llm_outputs`

Not required if we keep outputs in `llm_requests`, but useful for very large outputs.

## Mapping to existing tables

- `rubrics` store: `sourceRequestId` and continue to store `reasoning/output/threadId` if needed.
- `scores` store: `sourceRequestId` (scorer), `probeRequestId`, plus parsed verdicts.
- `usages` becomes linked to `llm_requests` instead of agent threads.

## Provider adapter layer

A small module that can:

- create a provider batch job from `llm_requests` grouped by (provider, model, params).
- poll job status and fetch outputs.
- map responses back to requestIds deterministically.

Notes on OpenRouter (assumption check):

- OpenRouter’s published OpenAPI spec does not expose batch endpoints; it only documents synchronous request endpoints.
- Therefore, with OpenRouter-only routing we should treat “batching” as an internal queue + submission scheduler (simulated batching).
- If we want true provider-side batch jobs, we likely need to call provider APIs directly (e.g., OpenAI Batch API, Anthropic Message Batches) and bypass OpenRouter for those runs.

## Provider batch limits (verify per account)

- OpenAI Batch: up to 50,000 requests per batch, input file up to 200 MB, 24h completion window; overall enqueued tokens limited by tier.
- Anthropic Message Batches: rate limits include max batch requests per batch (commonly 100,000) and max requests in processing queue; 24h completion window.
- Gemini Batch: 2 GB input file, 100 concurrent batch jobs, 20 GB storage, 24h target turnaround; inline requests only for smaller (<20 MB) batches.
- Azure OpenAI Batch: input file up to 200 MB, up to 100,000 requests per file, max 500 files per resource; batch quota by enqueued tokens.

## Workflow design

### 1) Enqueue

- Stage action creates `llm_requests` (status=queued) and returns requestId.

### 2) Batch submitter (workflow)

- Runs periodically or triggered when queue reaches size.
- Groups queued requests by provider+model+params.
- Creates `llm_batches`, updates requests to `submitted`.
- Calls provider batch submit; stores `providerBatchId`.

### 3) Batch poller (workflow)

- Polls provider batch jobs.
- On completion: fetch results file, map outputs to `llm_requests`.
- Updates each request: `completed` or `error`.
- Parsing errors are per-request, not whole-batch failures.

### 4) Downstream parsing

- Rubric/scoring/probe actions read `llm_requests` once status is complete.
- Parse `reasoning` and `verdictText` from `rawOutput` (existing parser logic).
- Store derived outputs in `rubrics` / `scores`.

## Rate limiting integration

- Apply preflight rate limit when enqueuing.
- On completion, write `usages` (by requestId instead of threadId).
- If token usage is unknown for batch, populate when provider response returns usage.

## Failure handling

- Provider batch submission failure: mark `llm_batches` error; reset requests to queued (or error with reason).
- Individual request error: mark `llm_requests` error; do not fail batch.
- Parsing failure: mark `llm_requests` completed but set parse fields to null; downstream sets score/rubric error flags.

## Execution order (refactor plan)

1. Add new schema + repo helpers for `llm_requests` and `llm_batches`.
2. Implement enqueue helpers and provider adapter skeleton.
3. Add batch submit/poll workflows.
4. Refactor `evidence`, `rubric`, `scoring`, `probe` to enqueue + await completion.
5. Remove `@convex-dev/agent` usage and thread fields.
6. Update usage tracking to reference requests.
7. Add tests for parsing + batch lifecycle.

## Questions / decisions

- Minimum batch size? max latency for scoring runs?
- Is OpenRouter the only provider? (initial assumption: yes)
- Keep `threadId` fields in `rubrics`/`scores` for backward compatibility, or remove?
- Should downstream actions block/wait for completion, or move to workflow steps only?

## Risk checklist

- Provider API mismatch or lack of batch support → keep “simulated batch” fallback.
- Workflow timeouts with large batches → add smaller chunking + pagination.
- Schema migration complexity → plan data backfill or leave old fields optional.

## Provider batch constraints (verified)

- OpenAI Batch API: asynchronous jobs, input via JSONL + Files API, 24h completion window, no streaming, per-model batch limits.
- Anthropic Message Batches: asynchronous, up to 24h completion window, large batch size limits.
