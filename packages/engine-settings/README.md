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
