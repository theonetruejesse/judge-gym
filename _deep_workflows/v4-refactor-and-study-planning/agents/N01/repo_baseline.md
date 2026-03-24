# Repo Baseline: V4 Planning

## Objective

Capture the current repo state that matters for planning V4 as a self-contained study with broader provider support and broader evidence import surfaces.

## Current-State Findings

1. The runtime and settings layer are structurally OpenAI-centric today.
   - `packages/engine-settings/src/provider.ts` defines only `openai` in `PROVIDERS`.
   - `MODELS` only includes OpenAI model IDs.
   - `ProviderExecutionSettingsSchema` only has an `openai` block.

2. The execution layer assumes OpenAI transport semantics, including file upload and batch jobs.
   - `apps/engine-temporal/src/llm/openai.ts` wraps `/v1/chat/completions`, `/v1/files`, and `/v1/batches`.
   - Batch lifecycle behavior is encoded in a provider-specific client rather than a general capability layer.

3. Current orchestration logic already treats batchability as an engine concern, but not yet as a provider capability matrix.
   - `apps/engine-temporal/src/runtime.ts` and related run/window services depend on batch execution records and batch quota dimensions.
   - This is a useful seam, but the abstraction boundary is still too close to OpenAI.

4. The evidence/window model is article-window-centric.
   - `apps/engine-convex/convex/models/window.ts` defines windows by query, country, date range, and a `source_provider` enum.
   - Evidence records are derived from article content with `l0/l1/l2/l3` views.
   - This fits the pilot news workflow but not imported benchmark examples, survey items, paper-specific labeled corpora, or model outputs.

5. The current window source surface is narrow.
   - `source_provider` in the window model is currently constrained to `"firecrawl"`.
   - That is incompatible with V4's need to import existing paper datasets and benchmark materials without pretending they are search-derived news windows.

6. Bundle plans are already a strong reusable primitive.
   - `apps/engine-convex/convex/models/bundles.ts` already models `bundle_plans` and `bundle_plan_items`.
   - Bundle construction should be preserved and generalized rather than replaced.

7. The experiment config surface is tuned to the current contested-concept pipeline.
   - `packages/engine-prompts/src/run/config.ts` centers a rubric model, a scoring model, `concept`, `scale_size`, `method`, `abstain_enabled`, `evidence_view`, `bundle_strategy`, and related current-study fields.
   - This is not yet broad enough for paper audits, benchmark judgments, survey-style prompts, or task families with different evidence semantics.

8. The current docs already point toward a broader V4 direction.
   - `docs/pilots/paper.md` frames the important object as the adjudicative regime rather than the model alone.
   - The pilot writeup already points toward concept-family work, broader provider comparison, and more aggressive standardization of evidence and bundle processes.

9. Prior V4 planning artifacts already narrowed likely paper targets.
   - `_deep_workflows/v4-paper-target-viability/synthesis/final_report.md` and `_deep_workflows/v4-resource-certainty/synthesis/final_report.md` converge on `Gilardi`, scoped `Ziems`, and `Zheng` or `Thakur`, with `Santurkar` as an expansion lane.
   - This means V4 planning should assume both a contested-concept lane and a published-paper audit lane.

10. The study framing needs to change alongside the engine.
    - The user direction for this pass is explicit: V4 should stand on its own as a paper and not read like "pilot V4."
    - The engine refactor should therefore target reusable study primitives, not just next-pilot convenience.

## Planning Lanes

1. `A_evidence_schema`
   - Generalize from article windows to `EvidenceUniverse` plus import/source metadata, derived evidence items, and bundleable views.

2. `A_provider_runtime`
   - Introduce provider capabilities, transport adapters, and execution policies so Anthropic and OpenRouter can coexist without pretending they share OpenAI batch semantics.

3. `A_experiment_prompt_surface`
   - Split task-family configuration, evidence semantics, adjudication tasks, and provider execution settings into a broader V4 experiment surface.

4. `A_self_contained_study_design`
   - Reframe V4 as a standalone study with a clear claim set, launch bundle, sequencing plan, and paper-quality deliverables.

## Initial Constraints

- This workflow is research only; no schema or code changes are part of the current run.
- The first implementation priority should still be the evidence/data model, because provider and prompt generalization will otherwise anchor to the wrong object model.
- Anthropic and OpenRouter should be treated as different capability surfaces, not just extra model IDs.
