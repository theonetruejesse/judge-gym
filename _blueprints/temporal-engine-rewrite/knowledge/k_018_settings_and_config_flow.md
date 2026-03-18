# Settings and Config Flow Should Be Split Into Defaults, Operator Policy, and Runtime Secrets

**Confidence:** 0.73

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/rate_limiter/index.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/utils/env_preflight.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/providers/openai_batch.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/telemetry/events.ts

**Summary:**
Today `ENGINE_SETTINGS` is a hard-coded in-code object that mixes execution policy and operational limits (batch sizes, poll intervals, retry/backoff, concurrency, token caps) with provider tier selection (`rate_limits.providers.openai`). It is imported across the existing Convex scheduler and LLM-call services and is also coupled into the Convex-native rate limiter initialization.

In a Temporal rewrite, the owner of execution policy becomes the Temporal worker side, but the product still needs stable, reproducible policy inputs for a given run/window, plus operator-editable controls like `pause_after`. The right config model is a 3-way split:

1. Defaults and schemas (shared, runtime-agnostic): the shape of policy, acceptable ranges, and safe defaults.
2. Operator policy (Convex, versioned): editable policy versions that runs/windows snapshot for reproducibility (e.g. `policy_id`), plus an “active policy” pointer for new starts.
3. Runtime secrets and deployment wiring (runtime-local): `process.env` secrets for providers, telemetry tokens, and per-deployment connection strings for Temporal; never import these from a shared package.

The key is to avoid a “shared settings module” that reads env and is imported by both Convex and workers. Shared packages should contain pure types/schemas and pure merge functions only. Each runtime should have its own env parsing and “effective policy” resolver that merges: defaults + policy snapshot + per-process override + emergency ops override (optional).
