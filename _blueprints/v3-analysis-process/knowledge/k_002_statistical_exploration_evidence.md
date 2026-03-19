# Statistical Exploration and Derived Tables

**Confidence:** 0.84

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/family_effects.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/matching_validation.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/sample_metrics.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/candidate_findings.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/sample_instability.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/bundle_verdict_profiles.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/bundle_belief_tbm.csv
- https://link.springer.com/article/10.1007/s10683-023-09799-6
- https://www.routledge.com/An-Introductionto-the-Bootstrap/Efron-Tibshirani/p/book/9780412042317
- https://www.researchgate.net/publication/221995234_Controlling_The_False_Discovery_Rate_-_A_Practical_And_Powerful_Approach_To_Multiple_Testing
- https://mgimond.github.io/tukeyedar/
- https://www.mdpi.com/1099-4300/27/6/654

**Summary:**
The current pipeline already has the right inferential unit: matched sample-level deltas. That should remain the basis for formal effects, with paired bootstrap intervals and sign-flip/randomization tests operating over sample deltas rather than pooled response rows.

What is still missing is a stronger table-first exploration layer. The analysis already produces candidate findings and instability tables, but it should also emit q-value-adjusted effect tables, per-sample effect contribution tables, verdict-geometry certainty tables, and bundle-policy delta tables so that new figures are rendered from ranked findings instead of discovered by manual browsing.

The most valuable exploration loop is not “look through many PNGs,” but “rank top-k samples/bundles/contrasts, then render only those.” This keeps the exploration reproducible and makes it easier for multiple agents to inspect the same evidence.
