# Temporal Visibility Should Become the Primary Execution Control Surface

**Confidence:** 0.86

**Sources:**
- https://docs.temporal.io/sending-messages
- https://docs.temporal.io/handling-messages
- https://github.com/temporalio/documentation/blob/main/docs/production-deployment/self-hosted-guide/visibility.mdx
- https://modelcontextprotocol.info/specification/2024-11-05/server/resources/?utm_source=openai
- https://modelcontextprotocol.info/specification/2024-11-05/server/tools?utm_source=openai
- https://axoim.co/docs/monitor-data/match-monitors?utm_source=openai
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/scripts/live_debug.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/codex.ts

**Summary:**
Temporal Visibility and Search Attributes should be the primary liveness index after the rewrite. They are designed to list and filter workflow executions cheaply and to support operator inspection and batch actions. Queries are good for inspection, Signals are good for asynchronous nudges, and Updates are the right primitive when the operator needs an acknowledged, tracked control action with a result.

This suggests a clean monitoring split: Temporal for execution truth, Convex for product-facing status projection and scientific summaries, and Axiom for deep telemetry and alert-triggering. MCP then becomes the agent-facing integration layer: resources for status snapshots and tools for controlled actions such as pause, resume, or bounded repair updates.

