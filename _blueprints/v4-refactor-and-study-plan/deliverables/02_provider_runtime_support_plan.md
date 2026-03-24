# Provider Runtime Support Plan

## Recommendation

Refactor toward a provider-capability layer plus provider-owned transport adapters. For wave 1, keep the claim narrower than the architecture:

- preserve OpenAI behind the new adapter seam
- add **one** non-OpenAI provider through direct execution first
- defer provider-native batching and strong multi-provider headline claims

## Core Abstractions

1. `ProviderDefinition`
   - provider id
   - auth/env requirements
   - base URL
   - capability flags

2. `ProviderCapabilities`
   - direct execution support
   - provider-native batch support
   - routing support
   - structured output support
   - usage/cost reporting support

3. `TransportAdapter`
   - provider-owned request/response translation
   - normalized output and usage extraction
   - provider-aware retry semantics

4. `ExecutionPolicy`
   - model/provider selection
   - direct vs batch choice
   - routing constraints
   - concurrency and retry settings

## Provider-Specific Wave-1 Position

- `Anthropic`
  - valuable because it is a genuinely different API surface
  - wave 1 should treat it as **direct-only** unless throughput forces later investment

- `OpenRouter`
  - useful as a routed access layer, but it is not a clean “provider control” by default
  - if included in wave 1, freeze routing tightly and report it as a robustness slice, not a headline provider-family claim

## Rollout Order

1. Wrap existing OpenAI code in the adapter boundary with no behavior change.
2. Add one non-OpenAI direct adapter.
3. Only then decide whether batching or routed OpenRouter support is worth the extra persistence and reproducibility work.

## Explicit Deferrals

- provider-native batch persistence generalization
- batch result artifacts that are not OpenAI file IDs
- strong cost-accounting claims across providers
- OpenRouter as a fully general multi-provider control story
