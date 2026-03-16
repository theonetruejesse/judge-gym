# Convex Limits, Retry Semantics, And Scheduling Implications

**Confidence:** 0.79

**Sources:**
- https://docs.convex.dev/production/state/limits
- https://docs.convex.dev/functions/actions
- https://docs.convex.dev/functions/error-handling/
- https://docs.convex.dev/api/interfaces/server.Scheduler
- https://docs.convex.dev/scheduling/scheduled-functions

**Summary:**
Official Convex documentation states that query and mutation execution time for user code is limited to one second, while actions can run for up to ten minutes. The limits page also documents per-function IO limits and warns when functions approach them. This supports the hypothesis that timeout-heavy `applyRequestResult` and `reconcileRunStage` mutations are vulnerable if they do too much per invocation.

Convex error-handling guidance distinguishes internal Convex errors, which are automatically retried, from application, developer, and read/write limit errors, which must be handled by the application. That matters here because once a request target reaches the app-level retry ceiling, the run will not self-heal just by waiting.

Scheduled mutations are guaranteed to execute exactly once and are retried on transient errors, while scheduled actions run at most once. The docs therefore support decomposing heavy mutation work into smaller scheduled mutation slices, but do not imply automatic recovery from exhausted application-level request states.
