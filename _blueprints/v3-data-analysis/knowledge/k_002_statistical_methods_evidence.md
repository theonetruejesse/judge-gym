# Statistical Methods For V3 Matched-Family Inference

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/paper.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v2_engine_prototype_testing.md
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/overview/tables/experiment_metrics.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/overview/tables/family_metrics.csv
- https://www.cns.nyu.edu/~eero/math-tools17/Handouts/Efron-bootstrap-ch1%2B2.pdf
- https://www.jstatsoft.org/article/view/v067i01
- https://lme4.github.io/lme4/articles/lmer.pdf
- https://www.researchgate.net/publication/221995234_Controlling_The_False_Discovery_Rate_-_A_Practical_And_Powerful_Approach_To_Multiple_Testing
- https://ai.updf.com/paper-detail/a-simple-sequentially-rejective-multiple-test-procedure-holm-b0ebbcf713b3ddf3f94325bc58dc39ff76fdc412
- https://pubmed.ncbi.nlm.nih.gov/20569253/
- https://studylib.net/doc/7963408/permutation-methods--a-basis-for-exact-inference
- https://arxiv.org/abs/1406.5823

**Summary:**
The V3 pilot matrix is best analyzed as a matched repeated-measures design: within each family (e.g., `a1` abstain toggle, `a4` rubric/scoring swap), conditions are evaluated on the same fixed set of samples, and each sample aggregates multiple evidence-level responses. This structure makes paired / within-unit estimators (paired bootstrap, permutation sign-flip randomization tests, and mixed-effects models with sample/evidence random effects) substantially more informative and robust than unpaired comparisons of per-experiment averages.

Evidence-backed claims (methods + fit to judge-gym V3):

1. **Treat family comparisons as paired over the 30 matched samples, not independent experiments.**
   - In judge-gym’s pilot design, experiments differ by configuration while holding the evidence pool and sample generation fixed; this supports paired inference by `sample_ordinal` and reduces variance relative to unpaired designs. (/docs/pilots/paper.md; /packages/analysis/_outputs/v3/overview/tables/experiment_metrics.csv)

2. **Use paired bootstrap CIs on matched deltas as the default uncertainty quantification primitive for pilot effects.**
   - For each family contrast, compute per-sample (or per-evidence) deltas, then bootstrap by resampling matched units (samples) with replacement to obtain uncertainty bands for effects. Bootstrap confidence intervals are a standard nonparametric tool for uncertainty under weak distributional assumptions. (Efron & Tibshirani bootstrap chapters; Davison/Hinkley is also appropriate background though not required here.)

3. **Use randomization/permutation tests aligned to the matched structure as a nonparametric “sanity check” for key effects.**
   - For paired designs, the permutation set corresponds to sign-flips (or label swaps) on per-unit differences, giving exact/finite-sample-valid inference under exchangeability. This is appropriate for small `n=30` matched samples when distributional assumptions are dubious. (Ernst 2004 permutation overview; paired-permutation sign flip discussions)

4. **Use mixed-effects models to estimate family effects while partial-pooling across evidence and controlling for nuisance sources of variation.**
   - A practical model is: outcome ~ intervention + (1|sample_ordinal) + (1|evidence_bundle) (+ optional (1|rubric_id)), fit per-family and per-model (or with interaction terms). Mixed-effects models are designed for repeated-measures data with both fixed and random effects and can reduce noise by borrowing strength across groups. (Bates et al. 2015 lme4; lme4 mixed model article)

5. **Variance decomposition (ICC / variance partition coefficients) is the right tool to quantify where variability lives (sample vs evidence vs configuration).**
   - ICC-style repeatability and variance partitioning from mixed models helps answer: “Are differences mainly driven by samples, evidence, or model/config?” This directly supports prioritizing what to scale next (more samples vs more evidence vs more configs). (Nakagawa & Schielzeth repeatability guide)

6. **Multiple comparisons: use FDR control within report families/metric panels, not global Bonferroni.**
   - The report will include many endpoints (abstain rate, singleton rate, mean subset size, entropy/compression, TBM/closed-world conflict, etc.) across multiple families. For exploratory pilots, controlling the false discovery rate (BH/BY) is typically more power-preserving than familywise error control while still bounding expected false discoveries. For “must-not-false-positive” headline claims, use Holm-style FWER control as a stricter alternative. (Benjamini–Hochberg 1995; Holm 1979)

7. **Effect sizes should be the primary reporting unit; p-values are secondary, especially for exploratory pilots.**
   - For each family contrast, report the paired mean/median delta and an interpretable standardized effect (e.g., paired standardized mean difference `d_z` for approximately continuous endpoints, or dominance/statistical superiority measures like Cliff’s delta / Vargha–Delaney A for ordinal-like endpoints). This aligns with the prior pilot emphasis on descriptive geometry differences and avoids overclaiming in small-n settings. (/docs/pilots/v2_engine_prototype_testing.md; Cliff 1993 dominance statistics is a canonical reference for ordinal ES)

8. **Robustness checks are required because some belief/conflict metrics can saturate.**
   - In the pilot paper, TBM/DST conflict is central; in V3, conflict can be near-1 for conjunctive fusion across many evidence-level judgments. This makes it critical to include secondary diagnostics (e.g., per-evidence distributions, entropy/compression indices, pairwise divergence) and to report sensitivity (e.g., excluding abstentions, using alternative fusion/aggregation) rather than treat “mean conflict” as a sole endpoint. (/docs/pilots/paper.md; V3 family metrics show wide spread in mean conflict.)

Uncertainty / counterevidence / caveats:

- **Exchangeability assumptions for permutation tests** are plausible for matched sample ordinals but can be violated if sample ordering encodes difficulty or if evidence sampling is not uniform; mitigations include stratified permutation/bootstraps and explicit random effects. (Permutation test sources)
- **Mixed model fit risk** with small `n=30` per condition: random-slope models may be unstable; prefer random intercepts and pre-specify a small set of fixed effects. (lme4 notes + general LMM practice)
- **Multiplicity correction is a policy decision**: BH controls expected FDR under independence/PRDS; dependence can require BY-style correction or resampling-based adjustments, but those may be overly conservative at pilot scale. (BH/BY literature)

