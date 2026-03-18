# Temporal Remains the Strongest Default, but Runtime and Versioning Constraints Are Real

**Confidence:** 0.72

**Sources:**
- https://github.com/temporalio/sdk-typescript
- https://github.com/temporalio/sdk-typescript/releases/tag/v1.15.0
- https://github.com/temporalio/sdk-typescript/pull/1906
- https://docs.temporal.io/develop/typescript/versioning
- https://docs.temporal.io/develop/typescript/continue-as-new
- https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning
- https://docs.restate.dev/services/versioning
- https://www.inngest.com/docs/learn/how-functions-are-executed

**Summary:**
Temporal TypeScript Workers are still fundamentally a Node-first runtime. Version `1.15.0` adds experimental Bun support, but the release notes call out meaningful limitations and no guarantee that workflows remain valid across Node and Bun. That makes Bun a possible spike path, not a production rewrite baseline. Worker Versioning, patching, and `continue-as-new` are not optional details either: if judge-gym workflows live long enough or fan out hard enough, the rewrite will need an explicit deployment/versioning strategy rather than casual code churn.

Restate and Inngest remain worth understanding, but neither currently displaces Temporal on the specific problems judge-gym is trying to solve. Restate shifts versioning complexity toward immutable deployments and delayed-call chunking for long-lived handlers. Inngest markets durable execution and simpler workflow versioning, but the evidence gathered here is still less precise and less grounded than the Temporal material. The right default remains Temporal, with Node workers in production and Bun treated as an experimental compatibility track to validate separately.
