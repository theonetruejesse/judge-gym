# Global Provider Rate Limiting Needs a Layered Design: Temporal for Dispatch, Redis for Shared Quotas

**Confidence:** 0.76

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/rate_limiter/provider_tiers.ts
- https://typescript.temporal.io/api/interfaces/worker.WorkerOptions
- https://github.com/temporalio/temporal/releases
- https://redis.io/tutorials/howtos/ratelimiting/
- https://redis.io/docs/latest/commands/incr/

**Summary:**
Judge-gym's current limiter is more granular than a simple "activities per second" cap. The current Convex implementation encodes provider quotas per model and scope, with separate request, input-token, output-token, and batch variants. That means the rewrite cannot rely on Temporal's native task-queue dispatch rate limit alone without losing an important part of the current business behavior.

Temporal gives three useful native controls, but they solve different problems:

1. `maxConcurrentActivityTaskExecutions` and worker tuners control host saturation.
2. `maxActivitiesPerSecond` limits how fast one worker process will execute Activities.
3. `maxTaskQueueActivitiesPerSecond` is a server-side dispatch cap for the whole Activity task queue, but the TypeScript API warns that if multiple workers set different values they will thrash with the last poller winning.

Temporal server releases after `1.29` improve the story by adding task-queue config APIs and fairness controls. The `UpdateTaskQueueConfig` endpoint can set a queue-wide maximum requests-per-second, and newer server releases expose fairness keys and weights in public preview. That makes Temporal good at coarse cross-worker dispatch shaping, but it still does not natively understand provider token budgets like "input tokens per minute" or "output tokens per minute" per model.

Because of that mismatch, the best default for judge-gym is layered:

1. Partition Activities into a small number of provider/mode task queues for coarse isolation.
2. Use Temporal queue-level controls for cross-worker dispatch and backlog shaping.
3. Use worker concurrency controls to protect host resources.
4. Add a distributed external limiter only for provider/model/scope quotas that Temporal cannot represent, using Redis token buckets or sliding-window counters implemented atomically with Lua.

For v0, fairness keys should not be a hard dependency because the feature is still preview-ish and judge-gym's immediate need is provider quota correctness, not multi-tenant backlog scheduling. The safer default is queue partitioning plus centralized queue config plus Redis-backed shared buckets for request/input/output budgets.

The consequence is useful: the remaining design question is no longer "Temporal or Redis?" It is "what exact quota dimensions justify the external bucket layer, and what can remain Temporal-native?" That is a much narrower and more implementable question.
