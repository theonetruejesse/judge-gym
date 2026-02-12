# Current Convex Schema (CamelCase + Thread-Centric)

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/schema.ts

**Summary:**
The current schema uses camelCase fields and relies on thread-centric LLM bookkeeping. `scores` include `threadId`, `scorerReasoning`, and optional `probeThreadId`, while `usages` ties token counts to `threadId`. Evidence records track multiple content variants (raw, cleaned, neutralized, abstracted), and the experiment/score tables embed config fields in camelCase. This shape conflicts with the desired snake_case, message-led, request-led ledger approach.
