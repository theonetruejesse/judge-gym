# Media Cloud Source Evidence

**Confidence:** 0.84

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N09/mediacloud_source_plan.md
- /Users/jesselee/dev/research/jg/judge-gym/apps/engine-convex/convex/domain/window/evidence_search.ts
- /Users/jesselee/dev/research/jg/judge-gym/apps/engine-temporal/src/window/service.ts

**Summary:**
The current Firecrawl integration collapses discovery and content acquisition into one provider call that returns title, URL, and raw markdown content. The Media Cloud research pass concludes that this is the wrong abstraction for V4. Media Cloud is a strong discovery and source-selection layer, but the engine should treat raw-content acquisition as a separate fetch capability. The correct V4 move is therefore to split discovery from hydration and to model Media Cloud as a source/query provider rather than a drop-in scraped-content provider.
