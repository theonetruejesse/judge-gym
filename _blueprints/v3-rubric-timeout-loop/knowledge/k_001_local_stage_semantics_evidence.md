# Local Stage Semantics And Failure Policy

**Confidence:** 0.9

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_progress.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_request_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts

**Summary:**
Run stage counts are derived from artifact rows and `process_request_targets`, not directly from batch completion. `maybeAdvanceRunStage` patches the current stage count from `getRunStageProgress`, returns `deferred_pending` while any target is unresolved, and only marks a run terminally errored when `completed === 0 && failed > 0`. That means a nonterminal stage with `29 completed / 1 failed / 0 pending` remains `running` instead of transitioning to a terminal invalid state.

The request-target state classifier marks a target as `exhausted` once the latest error request reaches `max_request_attempts`. Because the retry cap is currently three attempts, a final rubric-critic target can become exhausted after repeated timeout-heavy failures and leave the run scientifically invalid but still marked `running`.

There is also an observability gap in error labeling. `classifyRequestError` recognizes the substring `timeout` but not the common string `timed out`, which means many current failures are misclassified as `unknown`.
