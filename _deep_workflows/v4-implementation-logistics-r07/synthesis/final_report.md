# Final Report: R07 V4 Implementation Logistics

## Objective

Translate the locked V4 matrix into an implementation logistics package: specify how paper targets should be ingested and packaged, identify which parts of the current engine already support faithful audits, isolate the remaining missing code before target-specific smoke and canary runs, and define where bundle checks belong across literature-audit versus native evidence studies.

## Workflow Summary

- Objective class: research
- Operating mode: read_only_with_local_analysis
- Execution mode: compile_and_execute

## Findings

- The current engine already supports the core V4 substrate: evidence universes and sets, source records versus semantic views, transform runs, evidence-set-backed experiments, and generic V4 smoke execution.
- V4 should not port target papers by naively swapping evidence and rubric strings directly into a run. The missing abstraction is a paper-audit packaging layer that freezes prompt, codebook or rubric, label space, output contract, and provenance together.
- `bun run v4:smoke` proves substrate health, but it is not yet a paper-faithful canary and does not cover the OpenRouter/Qwen lane.
- Bundle-sensitive work should stay out of headline `Gilardi` and `Zheng` lanes. It belongs in `Ziems` appendix work or native evidence-set regime studies.

## Decisions

- Treat `Gilardi` and `Zheng` as package-driven imports, not ad hoc experiment configs.
- Build a paper-audit registry before target-specific canaries.
- Add target-specific import and canary scripts for `Gilardi` and `Zheng`.
- Extend the smoke harness to include the OpenRouter/Qwen control lane.
- Defer evidence-set semantic clustering until bundle-sensitive appendix or native regime work.

## Validation

- Execution-surface audit written
- Packaging contract written
- Canary-readiness checklist written
- Bundle policy and missing-code checklist written
