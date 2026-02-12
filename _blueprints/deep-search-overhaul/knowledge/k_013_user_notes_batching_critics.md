# User Notes: Per-Evidence Critics, Staged Batching, Message Normalization

**Confidence:** 0.7

**Sources:**
- User directives (2026-02-12)

**Summary:**
Additional constraints: critic passes must run per evidence item; rubric and score flows should be staged batching (rubric_gen batch first, then rubric_critic batch on accepted rubrics; score_gen batch then score_critic batch). Provider batch APIs should be used, with a preference for webhook callbacks into Convex if supported; otherwise polling or a separate durable service may be needed. `llm_messages` should store normalized fields only (prompt, outputs, reasoning if available, usage, temperature and core params), not full raw provider payloads.
