# engine-settings

Pure shared configuration package for the engine rewrite.

This package is intentionally runtime-agnostic:

- no `process.env` reads
- no Convex client wiring
- no Temporal client or worker wiring

It is the place for shared config schemas, defaults, queue names, provider-tier
metadata, batch policy, retry budgets, Firecrawl collection policy, and env-key
constants that both `engine-convex` and `engine-temporal` can consume without
leaking runtime-specific code across the boundary.

That includes Temporal execution policy such as the per-activity
`startToCloseTimeout` budget. Long-running batch-backed stage activities should
be tuned here, not with hardcoded literals in workflow code.

The developer-facing settings object lives in `src/index.ts` as
`ENGINE_SETTINGS_CONFIG`. The intended workflow is:

- change the config object there
- let the package schemas validate it
- keep runtime code reading from the resolved `DEFAULT_ENGINE_SETTINGS`

Important timeout split:

- `llm.direct.requestTimeoutMs` is the per-request timeout for normal chat calls
- `llm.batching.requestTimeoutMs` is the transport timeout for each Batch API
  request
- `llm.batching.maxWaitMs` is the total allowed batch poll/wait budget
- `temporal.activityStartToCloseMs` should stay above the batch wait budget so a
  long batch does not cause the entire stage activity to time out prematurely
