# Anthropic Message Batches (Async + Polling)

**Confidence:** 0.76

**Sources:**
- https://docs.anthropic.com/en/docs/build-with-claude/message-batches
- https://docs.anthropic.com/en/api/retrieving-message-batches
- https://docs.anthropic.com/en/api/creating-message-batches

**Summary:**
Anthropic message batches are asynchronous and polled via a retrieve endpoint that exposes `processing_status`, `request_counts`, and `results_url`. Batches expire 24 hours after creation, and results are available for a limited window after completion. Results are returned as a JSONL file and are not guaranteed to be in request order, so `custom_id` must be used to map results. Processing ends when all requests have succeeded, errored, canceled, or expired.
