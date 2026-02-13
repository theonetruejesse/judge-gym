# Lab supervisor submits/polls batches

**Confidence:** 0.75

**Sources:**
- packages/lab/src/supervisor.ts
- packages/engine/convex/lab.ts

**Summary:**
The Lab supervisor tick loop queries for due batches, submits new batches from queued LLM requests, and polls batches via Convex lab actions. Without this loop, queued requests remain unsubmitted.
