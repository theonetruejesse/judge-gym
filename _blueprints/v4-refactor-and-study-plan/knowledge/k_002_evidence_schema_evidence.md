# Evidence Schema Evidence

**Confidence:** 0.8

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N02/evidence_schema_plan.md
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N06/null_challenges.md

**Summary:**
V4 needs a canonical evidence substrate that is not identical to today's `windows -> window_runs -> evidences` path. The strongest direction is to separate imported evidence identity, provenance, and rendered views from the news-window collection path. However, the falsification pass shows that the full long-run schema should be narrowed for wave 1: stable external IDs, immutable raw payloads, explicit rendered views, and a compatibility-preserving bridge are higher priority than landing every future-oriented entity at once.
