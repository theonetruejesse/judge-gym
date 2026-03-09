# Parse Failure Corpus

**Confidence:** 0.94

**Sources:**
- `packages/engine/convex/domain/runs/run_service.ts`
- `packages/engine/convex/domain/runs/run_parsers.ts`
- `packages/engine/convex/domain/runs/run_strategies.ts`
- Convex MCP live query on dev deployment, 2026-03-09 (`llm_requests` by run for `kh765a6z2njwef2cp5y4cavxbd82k2z3`, `kh76x7q23chmpqkszfhfvz9vmh82jstk`, `kh768tzjmtsbab4zhj2d9jkdts82kvd8`, `kh7acwxwftd8w3k8gcgjymq57182k5hf`)
- Axiom MCP queries on `judge-gym`, 2026-03-09 (`request_parse_error` grouped by process_type and stage)

**Summary:**
`gpt-5.2-chat` is the dominant parse-failure hotspot in the current dataset, and the failures are overwhelmingly concentrated in `score_gen`. Two catastrophic runs produced `651` and `477` repeated `Missing reasoning before VERDICT line` failures respectively, plus smaller tails such as `Unrecognized verdict label: None`, empty `VERDICT:` lines, and occasional malformed `QUALITY` outputs. By contrast, representative `gpt-4.1` failures were primarily `rubric_gen` structural errors (wrong criteria counts / malformed rubric lines), while representative `gpt-4.1-mini` failures were `score_gen` no-fit / empty-verdict failures rather than the same `gpt-5.2-chat` pattern.

The current subset-scoring contract requires a comma-separated `VERDICT:` line with rubric-stage IDs and does not tolerate explicit “none” / empty-verdict outputs in the no-abstain path. That makes no-fit outputs parse-fatal rather than representable. The audit therefore supports three distinct parse bugs: raw-output loss on parse failure, subset score-gen contract ambiguity for no-fit cases, and model-specific instability on that contract for `gpt-5.2-chat`.
