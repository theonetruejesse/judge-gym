# Current Engine and Ops Constraints Summary

**Confidence:** 0.88

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/AGENTS.md
- /Users/jesselee/dev/research/jg/judge-gym/README.md
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts

**Summary:**
The current engine is runnable with native Convex scheduler orchestration, bounded batch sizing, retry caps, and live-debug tooling. A safe execution pattern is already defined: dry-run-first recovery, bounded diagnostics, and staged canary rollout. Current run policy defaults (`max_batch_size=100`, `min_batch_size=25`, `max_request_attempts=2`, `max_batch_retries=2`) constrain throughput and failure behavior and should be treated as the operational baseline for v3 planning.
