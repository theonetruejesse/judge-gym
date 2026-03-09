# Scheduler liveness stall evidence

**Confidence:** 0.93

**Sources:**
- MCP Convex: `scheduler_locks` table read
- MCP Convex: `_scheduled_functions` table read and one-off query
- MCP Convex: `packages/codex:getProcessHealth` for active runs

**Summary:**
The scheduler heartbeat appears stalled. `scheduler_locks` shows an `idle` lock with heartbeat around `1773019925593`, while sampled active runs show `scheduler_scheduled=false`, empty transport queues, and high `no_progress_for_ms`. Recent `_scheduled_functions` records include successful `runScheduler` executions but no continuation after the same timestamp window, indicating chain stoppage rather than persistent hard-failure on every invocation.
