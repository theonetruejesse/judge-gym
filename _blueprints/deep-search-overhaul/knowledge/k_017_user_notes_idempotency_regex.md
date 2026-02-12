# User Notes: Regex-Gated Acceptance + Convex-ID Idempotency

**Confidence:** 0.7

**Sources:**
- User directives (2026-02-12)

**Summary:**
Rubric and score acceptance criteria are regex parser success; failures must be durable with explicit error states and retries. Idempotency should leverage existing Convex IDs (experiment/rubric/sample/evidence IDs) and null-value checks rather than ad hoc hash keys; the system should treat existing request rows as the source of truth for reruns.
