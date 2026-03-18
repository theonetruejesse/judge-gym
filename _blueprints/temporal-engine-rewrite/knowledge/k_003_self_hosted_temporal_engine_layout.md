# Self-Hosted Temporal Can Live Beside Convex in packages/engine

**Confidence:** 0.84

**Sources:**
- https://docs.temporal.io/workers
- https://docs.temporal.io/develop/typescript/core-application
- https://github.com/temporalio/samples-server/tree/main/compose
- https://github.com/temporalio/sdk-typescript
- https://hub.docker.com/r/temporalio/server?utm_source=openai

**Summary:**
Temporal workers are external processes and should be treated as a separate runtime boundary even if the code lives in the same monorepo package. The clean repo organization is to colocate Temporal code under `packages/engine/temporal/` or `packages/engine/src/temporal/`, but run workers with Node rather than Bun. Temporal’s TypeScript SDK explicitly depends on Node worker features and strongly discourages non-Node runtimes for workers today.

For local development, the simplest path is `temporal server start-dev`, which gives a local service and UI. For self-hosted environments, use Temporal’s maintained server/deployment examples rather than the deprecated auto-setup image. This supports a practical topology ladder: local dev server for iteration, then Compose or multi-role service deployment for staging/production.

