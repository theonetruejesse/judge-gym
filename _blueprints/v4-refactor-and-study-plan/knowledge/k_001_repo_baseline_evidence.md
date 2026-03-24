# Repo Baseline Evidence

**Confidence:** 0.93

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N01/repo_baseline.md
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-settings/src/provider.ts
- /Users/jesselee/dev/research/jg/judge-gym/apps/engine-convex/convex/models/window.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-prompts/src/run/config.ts

**Summary:**
The current engine is still structurally optimized for an OpenAI-backed, article-window-centric, rubric-first research program. Provider support is encoded as OpenAI-only in settings and runtime, evidence is shaped around news windows and Firecrawl-derived article rows, and the experiment surface assumes the current V3 regime geometry pipeline rather than a more general paper-audit program.
