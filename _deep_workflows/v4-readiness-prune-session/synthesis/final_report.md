# Final Report: V4 Readiness Prune Session

## Objective

Define the implementation agenda for the current judge-gym work session before V4 matrix specification: simplify and generalize the evidence pipeline around ingest->views->analysis, identify legacy schema/runtime surfaces to prune, add provider-tier policy support including Anthropic tier handling, define the remaining experiment/config work required for literature-compatibility and regime checks, and produce a validated deep-workflow artifact plus synthesis deliverables that can drive the next coding phase with commit discipline in a dirty worktree.

## Workflow Summary

- Objective class: optimization
- Operating mode: live_ops_with_patch
- Execution mode: compile_only

## Findings

- The V4 evidence substrate and multi-provider runtime are no longer the blocker. Media Cloud discovery, hydration, storage-backed evidence assets, Anthropic direct, OpenRouter direct, and Anthropic native batch are already live-tested.
- The remaining blocker is experiment expression. The repo still cannot represent V4 studies cleanly because the experiment and run path remain tied to `pool_id`, window-era evidence assumptions, and current pilot-shaped prompt/parser contracts.
- The evidence system still carries too many transitional concepts. V4 should converge toward `ingest -> evidence_set -> evidence_view -> analysis/export`, with old windows/pools treated as transitional compatibility surfaces rather than the long-term core.
- Provider policy is uneven across providers. OpenAI has an explicit tier model, while Anthropic and OpenRouter still rely mostly on raw per-model overrides. That is not good enough for reproducible V4 provider matrices, especially because the intended Anthropic tier is tier 1.
- Export, analysis, and lab/operator surfaces are not yet V4-ready. They still do not treat evidence-set identity, rubric/task/output contracts, or provider-tier/runtime identity as first-class experiment metadata.
- Git discipline is now part of the technical plan. The worktree already contains unrelated `_campaigns/v3_finish_pass/*` deletions, so future V4 commits need explicit pathspec boundaries.

## Decisions

- Define and ship the pre-matrix readiness tracks before locking the V4 experimental matrix.
- Make evidence sets and rendered views the primary evidence contract for V4.
- Generalize provider settings into a provider-tier policy model across providers before matrix design.
- Rewrite the experiment contract before matrix work so literature-compatibility and regime-check experiments are first-class instead of awkward adaptations.
- Treat UI polish and broad legacy cleanup as post-matrix work unless they directly block execution.

## Validation

- Workflow artifact compiled successfully.
- Validation should confirm the workflow directory, node contracts, and synthesis deliverables are structurally valid.
