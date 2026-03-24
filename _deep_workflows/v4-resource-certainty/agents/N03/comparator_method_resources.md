# Comparator And Methods Resource Viability

## Zheng et al. / MT-Bench

- The paper explicitly says the benchmark questions, expert votes, and human-preference conversations are public.
- The official `llm_judge` pipeline provides a runnable judging surface with answer generation, GPT-4 judgment, scoring, and agreement analysis.
- The human-judgment dataset is separately exposed, which materially strengthens comparator fairness.
- The main risk is temporal drift in the original GPT-4 judging endpoint, not hidden assets.

Recommendation class: `clean comparator`

Certainty: `0.93`

## Thakur et al.

- The ACL paper and official repo expose a config-driven evaluator framework with benchmark runs, evaluator classes, and task settings.
- This is a strong comparator because it operates in a relatively controlled setting with clearer public protocol than many social-science studies.
- The remaining uncertainty is artifact discoverability: exact human-comparison slices may require some repo digging rather than a single packaged release.

Recommendation class: `clean comparator`

Certainty: `0.84`

## Wei et al.

- The repo is substantive and exposes templates, datasets, evaluation scripts, and run structure.
- The main issue is not total opacity but too many open degrees of freedom: template choice, raw-data pulls, extraction logic, and API judge behavior all matter.
- That makes it useful support literature and possibly a later companion case, but not the cleanest current comparator.

Recommendation class: `support only`

Certainty: `0.74`

## Shi et al.

- The benchmark substrate is public through MT-Bench and related artifacts.
- The paper makes the position-bias task legible, but an exact paper-specific replication package was not located.
- Version drift between submission/publication surfaces creates additional faithfulness risk.

Recommendation class: `support only`

Certainty: `0.76`

## Stureborg et al.

- The underlying datasets are public and reasonably well documented.
- The weak point is paper-specific evaluator reconstruction rather than base-data access.
- This is useful as framing and perhaps a narrow companion, but not a top-tier target for a fair first-wave audit.

Recommendation class: `support only`

Certainty: `0.79`

## Area Conclusion

`Zheng` is the cleanest mainstream comparator. `Thakur` is also strong and may be attractive if V4 wants a more controlled judge-alignment case. `Wei`, `Shi`, and `Stureborg` remain better as support or narrow companion literature.
