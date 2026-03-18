# Execution Policy, Rate Limiting, and Operational Tooling Should Follow the Worker Runtime

**Confidence:** 0.71

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/rate_limiter/index.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/package.json
- /Users/jesselee/dev/research/jg/judge-gym/turbo.json
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_018_settings_and_config_flow.md

**Summary:**
Today execution policy is embedded inside Convex-facing code: `ENGINE_SETTINGS` mixes retry, concurrency, token, and provider-tier concerns, and the active rate limiter is a Convex-native component initialized from those settings. That ownership is coherent only because the current execution engine lives inside Convex. In a Temporal rewrite, provider-facing throttling, backpressure, retries, and adapter selection should move with the execution owner: the Node worker side.

That does not mean Convex loses policy relevance. Convex should still store versioned operator policy, snapshot policy identifiers onto runs and windows, and retain data-facing artifacts such as prompt templates and LLM attempt rows. But the worker side should own:

1. provider adapters,
2. provider-facing rate-limiter enforcement,
3. runtime env and secret parsing,
4. task-queue and worker concurrency policy,
5. operational CLIs that directly control Temporal.

The remaining open point is global enforcement across multiple workers. A worker-local limiter is not automatically enough if you need global provider fairness, so the rewrite still needs an explicit decision about whether Temporal queue/concurrency controls are sufficient or whether a shared external limiter store is required. That is an execution concern, not a Convex domain concern.
