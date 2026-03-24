# N02 Social Science Targets

## Gilardi et al.

This is the cleanest direct `judge-gym` target in the shortlist. The paper is about using ChatGPT as a replacement for human coders in standard content-analysis style tasks, which is exactly the sort of evaluator pipeline V4 wants to audit. It is highly compatible with the V4 thesis because agreement-style results can look stable while the evaluator regime underneath is not. The main reason it scores so well is reconstructability: the publication and replication surface appear strong enough that a faithful baseline is plausible, and the task form maps well onto `judge-gym` with only moderate generalization.

Viability:

- data/materials: strong;
- prompt/protocol reconstruction: good;
- engine fit: excellent for single-item coder-replacement audits;
- engine lift needed: modest support for paper-faithful coding baselines plus perturbation sweeps over abstention, scale policy, and model placement.

Classification: `best immediate target`.

## Törnberg

This is one of the highest-payoff political cases because it sits closest to the project's contested-concept DNA: political annotation, social posts, and zero-shot judging. If reconstructed cleanly, it would be rhetorically powerful because it ties the evaluator-regime thesis directly to political content analysis. The problem is materials risk. The task is attractive, but the current source surface is less obviously complete than the strongest targets.

Viability:

- data/materials: uncertain;
- prompt/protocol reconstruction: probably partial, needs manual confirmation;
- engine fit: excellent if the inputs can be recovered;
- engine lift needed: robust support for social-post evidence universes, label-coded rubrics, and baseline-faithfulness modes.

Classification: `high-payoff but risky target`.

## Ziems et al.

This is likely the best "broad but still real" target family. It offers a bridge from the fascism work to published computational social science pipelines, but should be approached as a scoped subset rather than a whole-program replication. The right V4 move is to choose one or two tasks that are conceptually contestable or likely to exhibit regime sensitivity, rather than inherit the full benchmark surface.

Viability:

- data/materials: strong enough for a scoped audit;
- prompt/protocol reconstruction: good at subset level;
- engine fit: strong once V4 formalizes `EvidenceUniverse` beyond article bundles;
- engine lift needed: multi-dataset evidence support, more explicit label space handling, and cleaner baseline/perturbation separation.

Classification: `good but scoped target`, close to primary.

## Santurkar et al.

This is less central to the coder-replacement story, but it is unusually useful as a regime-audit case because it turns evaluator behavior onto survey-style opinion items. That helps V4 show that the configured regime thesis is not limited to article coding or fascism-style concept judgment. It is also one of the cleaner reconstruction surfaces in the shortlist, but the engine lift is materially higher than for `Gilardi` or a scoped `Ziems` subset.

Viability:

- data/materials: strong;
- prompt/protocol reconstruction: strong;
- engine fit: good in principle, but it broadens the project beyond content-analysis examples;
- engine lift needed: support for survey-item evidence universes, persona-conditioned or demographic-conditioned evaluation, repeated sampling, refusal-aware handling, and distributional similarity metrics rather than only label agreement.

Classification: `high-payoff engine-expansion target`.

## Recommendation

Among the social-science-facing papers, the strongest immediate set is:

1. `Gilardi` as the primary coder-replacement target.
2. `Ziems` as a scoped computational-social-science target family.
3. `Santurkar` only if V4 intentionally wants a broader engine-expansion case.
4. `Törnberg` only after a dedicated materials check confirms the baseline can be reconstructed fairly.
