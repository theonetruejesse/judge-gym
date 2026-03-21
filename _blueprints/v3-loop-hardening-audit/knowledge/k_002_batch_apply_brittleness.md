# Batch Apply Brittleness

**Confidence:** 0.81

**Sources:**
- `apps/engine-temporal/src/run/service.ts`
- `apps/engine-temporal/src/llm/openai.ts`
- live operator observation: completed OpenAI batches with lagging persisted `scores`

**Summary:**
The score-stage batch path was brittle after provider completion. Stage activities had no retry budget, and the OpenAI batch/file polling flow had no explicit transport retries. That meant completed provider work could still strand before Convex artifact application finished, especially when output-file fetches or post-batch reconciliation failed transiently.
