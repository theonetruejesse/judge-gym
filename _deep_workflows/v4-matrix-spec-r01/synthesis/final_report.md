# Final Report: R01 V4 Matrix Spec Compilation

## Objective

Compile and execute the bounded R01 workflow for the final V4 matrix specification package.

## Workflow Summary

- Objective class: research
- Operating mode: read_only_with_local_analysis
- Execution mode: compile_and_execute

## Findings

- R01 successfully compiled a candidate V4 matrix shape from the pilots, prior V4 planning artifacts, and the current runtime state.
- The candidate paper shape is a shared protocol skeleton across targets, with conditional target-specific extensions rather than a rigid full-grid perturbation plan.
- The preserved pilot backbone is geometry-first: abstention, concept framing, grouping, and model placement remain the real levers; `l3` remains non-headline.
- The candidate provider panel is OpenAI primary plus Anthropic and OpenRouter controls.

## Decisions

- Default launch direction:
  - `Gilardi` primary
  - `Zheng` default comparator
  - `Ziems` remains a scoped secondary candidate rather than a fully locked headline lane
- Headline evidence policy:
  - paper audits use `paper_original` or `source_text` as the baseline view
  - `l2_neutralized` is the default semantic alternate
  - `l3_abstracted` is not a headline matrix lever
- OpenAI mainline models stay primary; Anthropic and OpenRouter are wave-1 controls.

## Validation

- Workflow compiled and validated with `validate_workflow.py`.
- Runtime bootstrapped with `bootstrap_execution.py`.
- All four nodes reached `completed` state under the execute-workflow control plane.
- R01 should not close the campaign; it narrowed the problem enough to justify one decision-pruning follow-up run.
