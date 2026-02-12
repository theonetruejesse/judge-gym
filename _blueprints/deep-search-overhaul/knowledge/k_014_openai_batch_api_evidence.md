# OpenAI Batch API (Async File-Based Batches)

**Confidence:** 0.76

**Sources:**
- https://platform.openai.com/docs/guides/batch
- https://platform.openai.com/docs/api-reference/batch/object

**Summary:**
OpenAI batches are asynchronous and file-based. A Batch object includes `completion_window` (e.g., `24h`) and a `status` that progresses through `validating`, `in_progress`, `finalizing`, `completed`, `failed`, `expired`, `cancelling`, and `cancelled`. Results are delivered as output/error files (`output_file_id`, `error_file_id`) and must be mapped using per-request `custom_id` values because output ordering is not guaranteed. Cancellation enters a `cancelling` state before `cancelled`, and partial results may be available when cancelled.
