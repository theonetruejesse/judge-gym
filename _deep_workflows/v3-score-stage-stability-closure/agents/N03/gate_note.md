Accepted patch shape:

- page-bounded `recordLlmAttemptStart` staging in `score_gen`
- keep preamble timeouts inside `processRunStageBatchChunk` failure handling
- emit explicit preamble failure heartbeat payloads for observability

Rejected patch shape:

- increasing `llm.preflightTimeoutMs` as the primary fix

Why:

- the current bug is a monolithic preflight segment plus an uncaught timeout boundary
- the goal is to remove the blocker while keeping the preflight guard meaningful
