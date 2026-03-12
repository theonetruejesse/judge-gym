# Recovery Gap: Retryable Requests With No Transport

**Confidence:** 0.96

**Sources:**
- `packages/codex:getProcessHealth` for runs `kh760sqw651w3m0h93yp8vxd0h82r1y7`, `kh79ymw1gxjymhk2e182kb031d82sypf`, `kh7ant1a79k75t14bv7gce1vp582s5sy`
- `packages/codex:autoHealProcess` dry-run and apply

**Summary:**
Several runs were stalled in `rubric_critic` with `active_transport` all zero, `stage_progress` showing `29` pending `rubric_critic` targets, and `historical_error_summary` populated with `unknown` timeouts. `autoHealProcess` dry-run proposed `29` `requeue_retryable_request` actions for each such run, and applying the heal successfully requeued them. This establishes a concrete engine bug: retryable requests can be left stranded after batch failure without automatic recovery, and `getStuckWork` does not surface the "retryable + no transport" condition.
