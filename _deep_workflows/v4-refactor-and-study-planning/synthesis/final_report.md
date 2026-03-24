# Final Report: V4 Refactor And Study Planning

## Objective

Run a custom deep-search-style planning workflow for judge-gym V4 that produces a concrete refactor plan for evidence/window schemas, provider/runtime abstraction for Anthropic and OpenRouter, experiment and prompt-surface generalization, and a self-contained V4 paper/study specification with phased execution deliverables.

## Workflow Summary

- Objective class: `research_planning_and_architecture_triage`
- Operating mode: operationally read-only; `live_ops` metadata is used only because the validator expects that mode for web-backed workflows.
- Execution mode: `compile_and_execute`

## Main Findings

- The repo is still structurally optimized for an OpenAI-backed, article-window, rubric-first research engine.
- The long-run V4 direction is correct in spirit: generalized evidence imports, provider capabilities, and a broader experiment surface.
- The first-wave paper should be narrower than that long-run architecture.
- The cleanest wave-1 shape is one flagship paper-audit spine, a minimal import-ready evidence substrate, a prompt/config bridge on top of the fixed runner, and at most one direct-only non-OpenAI robustness slice.
- Firecrawl should not be replaced by Media Cloud as a literal one-for-one `search -> raw content` swap; the correct V4 acquisition model is Media Cloud for discovery and source selection, plus a separate hydration/fetch step for durable article text.
- The largest overreach risks are:
  - trying to land the full generalized evidence schema in one pass,
  - trying to make Anthropic batching part of wave 1,
  - trying to ship a generic StagePlan runner before the first audit exists,
  - trying to make comparator and multi-provider claims co-equal with the flagship paper-audit claim.

## Deliverables Produced

- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan/blueprint.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan/deliverables/01_evidence_window_schema_plan.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan/deliverables/02_provider_runtime_support_plan.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan/deliverables/03_experiment_prompt_surface_plan.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan/deliverables/04_v4_self_contained_study_plan.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan/deliverables/05_phased_roadmap.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan/deliverables/06_v4_paper_outline.md`
- `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan/deliverables/07_mediacloud_source_replacement_plan.md`

## Recommended Next Decision

Before any implementation work starts, lock the wave-1 study spine:

1. confirm whether `Gilardi` is the flagship target;
2. decide whether comparator work is deferred;
3. decide whether a non-OpenAI slice is required in wave 1 or only desired.
4. decide whether Media Cloud is mandatory in wave 1 or lands as the first acquisition-layer refactor immediately after scope lock.

Those four choices determine whether V4 is a tractable first paper or another broad platform project.
