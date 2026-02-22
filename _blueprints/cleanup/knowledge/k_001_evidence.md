# BaseOrchestrator responsibilities and routing

**Confidence:** 0.74

**Sources:**
- packages/engine/convex/domain/orchestrator/base.ts

**Summary:**
BaseOrchestrator is the generic orchestration layer: it collects pending targets, builds prompts, creates llm_requests, and routes to batch vs job based on run policy and batchability. It encodes/decodes request and process custom keys, creates batches/jobs with custom_key, and assigns request ids accordingly.
