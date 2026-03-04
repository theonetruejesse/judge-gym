# Live Debug And Telemetry Coverage

**Confidence:** 0.88

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/codex.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/codex.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/tests/codex_debug.test.ts
- /Users/jesselee/dev/research/jg/judge-gym/docs/live_debug_loop.md

**Summary:**
The codex surface already supports process-health snapshots, stuck-work diagnostics, bounded trace analysis, and safe auto-heal actions. Health is snapshot-first with bounded fallback scans, reducing heavy query risk for large fanout. Telemetry analyzer includes critical invariants (sequence integrity, duplicate apply success, events-after-terminal), but approximation state in fallback rollups is not surfaced to API callers.
