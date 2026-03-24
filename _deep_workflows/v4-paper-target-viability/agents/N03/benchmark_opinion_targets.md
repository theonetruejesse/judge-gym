# N03 Benchmark And Opinion Targets

## Santurkar et al.

This is the strongest non-benchmark opinion target because it shifts the audit surface from content coding to survey-style opinion reflection. That matters for V4: it shows that `judge-gym` can audit configured evaluators on inputs that are not just articles or posts. The task is less directly tied to the "LLM replaces a human coder" narrative, but it is strong on reconstructability and still exposes regime choices around scale, abstention, framing, and aggregation.

Classification: `useful companion target`.

## Zheng et al. / MT-Bench

This is the cleanest comparator if V4 wants one mainstream LLM-as-a-judge case outside political or computational social science. The materials and evaluation surface are legible, the benchmark is recognizable, and the payoff is methodological: V4 can show that evaluator-regime sensitivity matters even in a clean benchmark setting. The main limitation is thematic fit. It is less central to the contested-construct thesis than `Gilardi`, `Ziems`, or `Törnberg`.

Classification: `clean comparator target`.

## Thakur et al.

This is another strong comparator, and stronger than a generic judge-bias framing paper. Its appeal is that it operates in a relatively sterile setting with strong public materials, which makes it useful for showing that evaluator-regime concerns do not require a maximally contested concept to appear. If V4 wants a comparator anchored in alignment-to-human scoring rather than benchmark preference battles, `Thakur` is a serious option.

Classification: `clean comparator target`.

## Implication For V4

If V4 includes one non-social-science comparator, it should likely be `Zheng / MT-Bench` or `Thakur`, not because either is the highest-payoff standalone case, but because they let the paper say:

- the fascism track is not a one-off;
- the social-science audits are not special pleading;
- even mainstream LLM-as-a-judge pipelines have an evaluator-regime surface.

## Engine Generalization Needed

This class of targets requires features that go beyond the current article-centric setup:

- pairwise or comparative judging modes;
- support for benchmark items and model outputs as first-class `EvidenceUniverse` members;
- rubric templates that can express preference or ranking decisions, not only stage-based concept scores;
- optional baseline-faithfulness modes to mirror the original paper's setup before applying perturbations.
