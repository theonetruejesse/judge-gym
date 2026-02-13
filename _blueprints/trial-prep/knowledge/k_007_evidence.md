# OpenAI batch adapter requires OPENAI_API_KEY

**Confidence:** 0.74

**Sources:**
- packages/engine/convex/platform/providers/openai_batch.ts
- packages/engine/convex/env.ts

**Summary:**
OpenAI batch calls require OPENAI_API_KEY; the adapter throws if the key is missing, so gpt-4.1 runs need the key set in the Convex environment.
