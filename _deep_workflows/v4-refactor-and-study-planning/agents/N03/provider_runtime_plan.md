# V4 Provider/Runtime Plan (Anthropic + OpenRouter)

Scope: provider/runtime abstraction only (Temporal worker + engine-settings). Anthropic and OpenRouter are treated as distinct capability surfaces (not “extra model IDs”).

## Current Assumptions

### Settings Layer (OpenAI-Centric)

- Single provider registry: `PROVIDERS` contains only `openai` with env var `OPENAI_API_KEY`. (`packages/engine-settings/src/provider.ts`)
- Models are “OpenAI model IDs”:
  - `MODELS[].provider` is always `"openai"`.
  - `MODELS[].provider_model` is an OpenAI model string.
  - `MODELS[].batchable` is a provider-specific flag but stored on the model definition.
- Provider execution settings and rate limits are OpenAI-tier specific:
  - `ProviderExecutionSettingsSchema` only has an `openai` block.
  - `resolveProviderRateLimit()` returns `null` for any provider other than `"openai"`.
  - Rate limit dimensions include `batchEnqueuedInputTokensPerMinute`, implicitly reflecting OpenAI batch quota semantics.

### Runtime Layer (Temporal) Assumptions

- Transport is hard-coded to OpenAI:
  - Base URL is `https://api.openai.com`.
  - Direct calls are `POST /v1/chat/completions`.
  - Batch path is OpenAI-specific: `POST /v1/files` (JSONL file upload) then `POST /v1/batches` (with `endpoint: "/v1/chat/completions"`), then poll `GET /v1/batches/{id}`, then fetch `GET /v1/files/{file_id}/content`. (`apps/engine-temporal/src/llm/openai.ts`)
- Request/response shape is OpenAI Chat Completions:
  - Prompt shape assumes a `"system"` role message exists.
  - Output extraction assumes `choices[0].message.content` and token usage in `usage.prompt_tokens` / `usage.completion_tokens` / `usage.total_tokens`.
- Batching contracts assume OpenAI artifacts:
  - The batch executor callback `onBatchCreated` exposes `inputFileId` (OpenAI Files artifact).
  - `BatchExecution` persistence hooks in the run/window services bind `input_file_id`, `output_file_id`, `error_file_id` (OpenAI file IDs). (`apps/engine-temporal/src/run/service.ts`, `apps/engine-temporal/src/window/service.ts`)
- Provider is currently “metadata only”:
  - `getModelConfig()` resolves `{ provider, providerModel }`, and the provider is recorded into quota + attempt records, but the actual transport called is still OpenAI-only. (`apps/engine-temporal/src/window/model_registry.ts`, `apps/engine-temporal/src/run/service.ts`, `apps/engine-temporal/src/window/service.ts`)
- Retry/backoff is transport-local and OpenAI-shaped:
  - Direct requests do not have a generic retry policy in the transport client.
  - Batch polling / file fetch uses a local `runWithRetry()` with fixed attempt/backoff settings (from engine settings). (`apps/engine-temporal/src/llm/openai.ts`)

## Capability Matrix

Legend:
- “Direct” means synchronous request/response for a single prompt.
- “Batch” means provider-native async batch API (not engine-side chunking).

| Capability | OpenAI (current baseline) | Anthropic (Claude API) | OpenRouter (router surface) |
|---|---|---|---|
| Direct calls | Chat Completions (`/v1/chat/completions`) | Messages API (`POST /v1/messages`), no `"system"` role; use top-level `system` | OpenAI-compatible Chat Completions (`POST /api/v1/chat/completions`) |
| Batch availability | Yes: OpenAI Batches (`/v1/batches`) | Yes: Message Batches (`POST /v1/messages/batches`, poll `GET /v1/messages/batches/{id}`, fetch results via `results_url`) | Treat as direct-only unless official docs add a native batch API (none found in OpenRouter docs). |
| Batch mechanics | Requires staging input as JSONL file via Files API; batch returns `output_file_id` / `error_file_id` | Batch request contains `requests[]` inline, with `custom_id` + `params` (a normal Messages payload). Batch object exposes `results_url` to a `.jsonl` stream. | No batch artifact surface documented; model/provider routing is the feature surface. |
| “File staging” assumptions | Yes: explicit file upload and file IDs are required | No pre-upload for message batches; results are streamed as `.jsonl` lines | No file staging surface for inference; request/response only |
| Routing / provider selection | None (direct provider) | None (direct provider) | First-class: `provider` preferences (ex: `sort`, `order`, `ignore`, `allow_fallbacks`, `require_parameters`, `data_collection`, pricing/latency constraints) influence routing/fallback behavior |
| Structured output assumptions | Current engine uses freeform text extraction; no function/tool calls in transport | Messages output is content blocks; structured output typically requires tools or prompt discipline; system prompt is not a message role | Supports OpenAI-style `response_format` field; but parameter support varies by upstream provider, so `require_parameters` is relevant to avoid silent downgrades |
| Usage / tokens | `usage.prompt_tokens` / `completion_tokens` / `total_tokens` in direct and per-line in batch output JSONL | `usage.input_tokens` / `output_tokens` (+ cache-related fields); rate limits explicitly track RPM/ITPM/OTPM and return `retry-after` on 429 | `usage` present; OpenRouter also offers `/api/v1/generation?id=...` to retrieve cost + native token counts after the request |
| Cost accounting | Not currently represented in runtime contract | Not currently represented in runtime contract | Supported: response `usage.cost` may be present, and `/api/v1/generation` returns `total_cost` and detailed per-request metadata |
| Retry behavior surface | Currently ad hoc: no common provider retry policy beyond batch polling/file read retries | 429 includes `retry-after`; also distinct error types in batch result stream (errored/canceled/expired) | Failures may come from router vs upstream provider; routing can retry across providers when fallbacks are enabled |

## Proposed Runtime/Settings Abstractions

### 1) Provider Registry (engine-settings)

Goal: encode provider identity, auth, and capability surface; stop overloading “model ID list” as the provider abstraction.

Proposed additions (conceptual):

- `ProviderId = "openai" | "anthropic" | "openrouter"`
- `ProviderDefinition` should include:
  - `env_var` (API key)
  - `base_url` (or `defaultBaseUrl`)
  - `auth` scheme (header name/value format) because Anthropic uses `X-Api-Key` + required version header, while OpenRouter uses `Authorization: Bearer ...`.
  - `capabilities`:
    - `direct.chat`: supported + which request shape (`openai_chat_completions` vs `anthropic_messages`)
    - `batch.chat`: supported + which batch mechanism (`openai_files_jsonl` vs `anthropic_message_batches`)
    - `routing`: supported (OpenRouter)
    - `structured_output`: supported via `response_format` (OpenAI/OpenRouter) vs “tools/prompt-only” (Anthropic)
    - `cost_accounting`: supported in-band vs async (OpenRouter generation endpoint)

Rate limit config strategy (V4):

- Keep the engine-level quota/token-bucket system, but make provider rate limit resolution provider-aware:
  - For Anthropic, rate limits are described as RPM/ITPM/OTPM, with `retry-after` semantics on 429.
  - For OpenRouter, treat rate limit configuration as best-effort and primarily use observed throttling/backoff, since throughput depends on router/upstream/provider preferences.
- Move `batchEnqueuedInputTokensPerMinute` into a capability-gated dimension (only meaningful where “enqueued token” quotas exist).

### 2) Model Registry (engine-settings + Temporal)

Current `MODELS` conflates (a) model identity and (b) the provider’s execution surface. For V4, model definitions should include:

- `provider: ProviderId`
- `provider_model: string` (provider-specific model slug)
- `execution_surface`:
  - OpenAI: chat completions
  - Anthropic: messages
  - OpenRouter: chat completions (router), with optional router configuration presets
- `batchable` should become `batchability` = `never | provider_native | provider_native_if_supported`:
  - OpenRouter should default to `never` unless the docs later add a native batch API.

### 3) Transport Adapters (Temporal `apps/engine-temporal`)

Create a provider-agnostic interface, implemented by provider-specific adapters:

- `LlmTransportAdapter.chat(request) -> { assistant_output, usage, provider_request_id, raw }`
- `LlmTransportAdapter.batchChat(requests) -> { provider_batch_id, result_ref, per_item_results }` (capability-gated)

Key design point: the adapter must *own the provider wire shape*, while the runtime orchestrator owns engine invariants (attempt recording, quota reservation, chunking, retries, heartbeat).

Provider-specific adapter notes:

- Anthropic adapter:
  - Direct: translate `{ systemPrompt, userPrompt }` into `system` + a single `user` message (or multi-turn if needed later).
  - Batch: use Message Batches API:
    - `custom_id` max length is 64 and must be unique per batch request; do not assume Convex `attempt_id` fits. Use a deterministic short custom ID (for example, stable hash) and keep a mapping table in-memory for reconciliation.
    - Poll `GET /v1/messages/batches/{id}` until `processing_status: "ended"`, then stream/parse `.jsonl` from `results_url`.
- OpenRouter adapter:
  - Direct-only (initially): call `POST /api/v1/chat/completions`.
  - Treat `provider` routing preferences as part of the *execution policy* (not the model ID), so experiments can vary routing independently from model slug.
  - Cost: optionally record `generation_id` from the response `id` and fetch `/api/v1/generation?id=...` asynchronously if/when the engine wants cost auditing.

### 4) Execution Policies and Capability Checks

Introduce an “execution policy” object that is computed at runtime from:

- Experiment config (provider selection, routing rules)
- Engine settings (timeouts, retry settings, batch settings)
- Provider capabilities (direct/batch/routing/structured-output/cost)

Capability checks should happen before reserving quota and before scheduling a batch:

- If provider does not support provider-native batch:
  - `shouldUseBatching()` must return `false` even if the model is “batchable” in a generic sense.
  - Emit a structured runtime event so it is observable when the engine falls back to direct execution.

### 5) Batch Scheduler Strategy (Engine Concern, Provider-Aware)

Keep the existing engine-level chunking logic (min/max batch size, concurrency) but make the “batch executor” pluggable per provider.

Crucial change: decouple the persisted batch execution artifacts from OpenAI file IDs.

V4 should treat “batch output location” as an opaque `result_ref`:

- OpenAI: `{ kind: "openai_file_ids", output_file_id, error_file_id }`
- Anthropic: `{ kind: "anthropic_results_url", results_url }`
- OpenRouter: not applicable (direct-only)

This implies updates outside this planning scope (Convex schemas + UI) to store provider-specific batch artifacts without naming them `*_file_id` universally.

## Phased Rollout

Recommended order: Anthropic first, OpenRouter second.

Rationale:
- Anthropic is a true “different surface” (Messages API, no system role, native Message Batches with `results_url` streaming). Implementing it forces the correct abstraction boundary early.
- OpenRouter can be integrated as a routed direct-execution surface (OpenAI-compatible wire shape), but its main complexity is policy (routing preferences, parameter support variance) rather than transport mechanics.

### Phase 0: Abstraction Scaffold (no behavior change for OpenAI)

- Define provider capability types and a transport adapter interface.
- Wrap the existing OpenAI client behind the adapter (keep behavior identical).

### Phase 1: Anthropic Direct Execution

- Add `anthropic` provider definition (env var, base URL, required headers).
- Add a minimal Anthropic transport adapter implementing direct Messages calls.
- Disable batching for Anthropic initially (capability gating) until batch artifacts are generalized.

### Phase 2: Anthropic Provider-Native Batching

- Implement Message Batches adapter:
  - Create batch with `requests[]` and stable short `custom_id`.
  - Poll batch status until ended; stream/parse `.jsonl` results.
- Generalize batch artifact persistence: store provider-specific batch “result refs” instead of OpenAI file IDs.

### Phase 3: OpenRouter Direct Execution + Routing Policies

- Add `openrouter` provider definition (bearer auth, base URL).
- Implement OpenRouter chat-completions adapter.
- Add execution-policy support for `provider` routing preferences (sort/order/ignore/require_parameters/data_collection/max_price, etc.).
- Keep `batchable = false` for OpenRouter until/if OpenRouter documents a batch API.

## Risks and Unknowns

- Batch artifact persistence is currently OpenAI-shaped (`input_file_id` / `output_file_id` / `error_file_id`), so Anthropic batch support forces a schema + UI refactor to store opaque batch result references.
- Anthropic Message Batches require `custom_id` length ≤ 64; using Convex attempt IDs directly is likely unsafe. This must be designed up front to avoid silent correlation failures.
- Output normalization:
  - Anthropic returns content blocks; OpenRouter returns OpenAI-shaped chat completion `choices[].message.content`. The “assistant output string” extraction needs a provider-aware normalizer that does not lose structured content when V4 later adds tool calls/structured outputs.
- Structured output reliability:
  - OpenRouter can route to providers that do not support all request parameters; without `require_parameters`, experiments may observe “structured output works sometimes” variability that is routing-driven rather than model-driven.
- Cost accounting:
  - OpenRouter cost is available via generation metadata, but incorporating it implies background fetches and persistence changes.
  - Anthropic/OpenAI pricing is not currently integrated; cost accounting likely becomes a cross-cutting effort beyond provider transport.
- Retry semantics:
  - Anthropic documents `retry-after` on 429; current runtime retry logic is not provider-aware and may hammer providers if not updated.
  - OpenRouter adds an extra failure mode layer (router vs upstream). Retrying at the engine layer can interact with router-level fallbacks in non-obvious ways (double retries).

Rollout sequence (minimal operational steps):
1. Land provider adapter scaffolding with OpenAI behavior unchanged.
2. Enable Anthropic direct calls for a small, non-batched workflow slice.
3. Generalize batch execution artifact persistence, then enable Anthropic message batching.
4. Add OpenRouter direct execution with conservative routing defaults (`require_parameters: true`, explicit `data_collection` stance), and keep batching disabled.

