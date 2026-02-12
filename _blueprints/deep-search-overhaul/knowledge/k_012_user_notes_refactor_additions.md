# User Notes: Mandatory Critics, Provider Batch APIs, Centralized Rate Limiter

**Confidence:** 0.7

**Sources:**
- User directives (2026-02-12)

**Summary:**
New constraints: probes are mandatory for all tasks, and naming should standardize on "critic" (e.g., `rubric_critic`, `score_critic`) rather than critic/probe split. Batching must be abstracted with provider batch APIs (OpenAI, Anthropic, Gemini) and should support partial failure resets. The rate limiter should be centralized in the batching service while still using the Convex rate-limiter component, with attention to idempotency and durable retries. Critic responses should remain stored in their associated domain tables (rubrics/scores), while a new messages table becomes the source of truth for prompt/output/usage data.
