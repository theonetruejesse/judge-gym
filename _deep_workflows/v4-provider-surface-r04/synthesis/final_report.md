# Final Report: R04 Provider Surface Reopen

## Objective

Investigate Chinese open-weight and regime-diverse OpenRouter families for the V4 provider panel, then decide whether to revise the locked matrix.

## Workflow Summary

- Objective class: research
- Operating mode: read_only_with_local_analysis
- Execution mode: compile_and_execute

## Findings

- The previous OpenRouter lane was the wrong family proxy for the V4 paper.
- The best replacement is a Qwen-centered Chinese open-weight lane, not Claude routed through OpenRouter.
- `DeepSeek V3.2` and `GLM 4.5` are the strongest appendix-grade follow-ons if the paper later widens the open-weight comparison.
- `Kimi K2` and `MiniMax M1` deserve watchlist status.
- `Mercury 2` is a legitimate diffusion-LLM outlier, but only as an exploratory sidecar.

## Decisions

- Replace `claude-sonnet-4-openrouter` with `qwen_current_text_flagship`.
- Keep the headline matrix bounded.
- Reopen the campaign for one packaging run to update the locked memo and implementation spec.

## Validation

- Workflow contract populated.
- Required node outputs written.
- Live OpenRouter surface captured in `contexts/live_openrouter_surface.md`.
