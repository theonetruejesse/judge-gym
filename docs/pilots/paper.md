# Measuring Adjudicative Geometry in LLM-as-Judge Evaluation of Contested Political Concepts

_Working paper draft. This is still based on pilot evidence and remains provisional, but it should be read as a self-contained research document rather than a loose project note._

## Abstract

Large language models are increasingly used as automated evaluators in benchmark pipelines, preference modeling, and applied social analysis. Most LLM-as-Judge work focuses on prompt bias, position bias, verbosity bias, or human-alignment benchmarking. We study a different question: how the full judge configuration reshapes evaluation behavior on **contested political concepts** where disagreement is expected and ground truth is weak or absent. We introduce **judge-gym**, a design-space engine that treats rubric model, scoring model, concept framing, abstention policy, scale size, evidence representation, and evidence grouping as configurable experimental axes. Across two pilots, we find that judge behavior is best described in terms of **adjudicative geometry**: stable patterns of abstention, scale occupancy, subset breadth, and stage concentration. The V2 pilot established qualitatively distinct geometries across frontier models. The V3 matched ablation pilot showed that abstention policy, concept framing, and rubric/scoring model placement are strong behavioral levers, while `l3` abstraction was weaker than expected in the frozen matrix. V3 also revealed that "unusual geometry" is not unitary: some configurations exhibit genuine **adjudicative compression** (high abstention, near-zero mid-scale use), while others produce **interior concentration** (low abstention, high mid-scale mass, broader subsets). We argue that contested-concept LLM judging should be treated as a configurable measurement regime rather than a neutral drop-in evaluator.

## 1. Introduction

LLM-as-Judge systems are attractive because they are cheap, fast, and scalable. But the usual framing assumes that evaluator differences can be treated as noise, prompt sensitivity, or alignment error around a fundamentally shared task. That assumption is much weaker for **contested concepts** such as fascism, democratic backsliding, or illiberal democracy. In these settings, the problem is not only whether a judge is consistent, but what kind of evaluative geometry it inhabits.

The central claim of this paper is narrow:

> LLM-as-Judge behavior on contested political concepts is strongly **configuration-sensitive**, and different judge configurations can induce distinct adjudicative geometries.

By adjudicative geometry, we mean the stable shape of a judge's outputs over a rubric scale:

- how often it abstains,
- how much of the scale it actually uses,
- whether it prefers singleton versus subset verdicts,
- how much mass it places in mid-scale states,
- and how concentrated or diffuse its stage usage becomes.

This framing departs from an earlier version of the project that centered **epistemic entrenchment**. The pilots to date support a stronger empirical claim about geometry than a strong theoretical claim about entrenched epistemics or hallucinated consensus. The evidence is currently best read as a measurement and design-space story, not a grand normative theory.

## 2. Related Methodological Context

### 2.1. LLM-as-Judge Evaluation

The modern LLM-as-Judge literature established that frontier models can perform reasonably well as evaluators, but it also revealed systematic biases. MT-Bench and related work showed promising agreement with human preferences, while later work identified position bias, verbosity bias, evaluator self-favoring, and prompt-template sensitivity as persistent issues (Zheng et al., 2023; Dubois et al., 2024; Shi et al., 2025; Wu & Aji, 2023; Stureborg et al., 2024; Panickssery et al., 2024).

Our work extends that line from **format bias** to **regime geometry**. We ask not only whether prompt structure changes the score, but whether the entire evaluation surface changes under configuration shifts.

### 2.2. Political and Ideological Sensitivity

Prior work showed that language models reflect different political priors and alignment effects (Santurkar et al., 2023; Feng et al., 2023; Hartmann et al., 2023). That makes contested-concept judgment a particularly useful stress test: unlike factual QA, disagreement is not necessarily error. The question becomes whether different models and pipeline regimes exhibit systematically different evaluative structures.

### 2.3. Calibration and Uncertainty

Probability-style probes tend to outperform verbal confidence for calibration tasks (Kadavath et al., 2022). In our setting, the relevant confidence target is not correctness but **expert agreement belief**, because contested political concepts do not have clean objective labels. Subset verdicts and belief-function style aggregation remain methodologically relevant because they can separate forced-choice inflation from structured ambiguity (Dempster, 1967; Shafer, 1976; Guerdan et al., 2025).

## 3. Conceptual Frame

### 3.1. Contested Concepts

Following Gallie (1956), contested concepts are appraisive, internally complex, revisable, and open to reasonable disagreement. Concepts like fascism or democratic erosion are not simply latent classes waiting to be decoded. They are structured evaluative constructs, which makes them particularly sensitive to the priors and behavioral regimes of automated judges.

### 3.2. Adjudicative Geometry

We use **adjudicative geometry** as a descriptive term for the shape of judge behavior under a given configuration. A judge can be:

- **smooth / graded**, with broad interior-scale usage,
- **thresholded**, with selective gating,
- **compressed**, with high abstention and collapsed mid-scale use,
- or **interior-concentrated**, with low abstention but narrow use of the scale interior.

This language is descriptive rather than causal. It is intended to summarize the behavioral structure of a configuration, not to explain why the behavior occurs.

### 3.3. Adjudicative Compression

One important geometry we retain from earlier drafts is **adjudicative compression**: reduced effective use of the rubric scale. Operationally, compressed regimes show:

- high abstain rate,
- near-zero mid-scale occupancy,
- low stage entropy,
- and near-total singleton behavior.

The V3 pilot supports compression as a real phenomenon for some configurations, but not as a universal model property.

## 4. Methodology

### 4.1. Design Space Engine

`judge-gym` treats judge evaluation as a configuration surface rather than a fixed benchmark pipeline. The main experiment axes are:

- rubric model,
- scoring model,
- concept,
- scoring method (`single` or `subset`),
- scale size,
- abstention policy,
- evidence view (`l0`, `l1`, `l2`, `l3`),
- evidence grouping / bundle size,
- and randomization settings.

The goal is to treat experiments as data, not code.

### 4.2. Pipeline

The current engine implements a five-part workflow:

1. **Evidence collection**
   - collect article evidence into reusable pools and windows
2. **Rubric generation**
   - generate a rubric per sample, then critique it for observability and discriminability
3. **Scoring**
   - score the evidence against the rubric using configurable scoring behavior
4. **Aggregation / analysis**
   - compute sample-level and experiment-level behavioral summaries, plus diagnostic uncertainty summaries
5. **Follow-up comparison**
   - compare interventions at matched sample grain rather than only pooled response grain

### 4.3. Controls

The current pilot line incorporates the following controls:

| Control | Purpose | Status |
| :------ | :------ | :----- |
| Tone neutralization | reduce style / rhetoric confounds | implemented |
| Scale design | reduce midpoint and compression ambiguity | active ablation axis |
| Label/order randomization | reduce anchor and position bias | active |
| Rubric validation | reduce rubric-quality confounding | active |
| Abstention gate | separate refusal from forced-choice inflation | active |
| Fresh-context probing | reduce confidence-context leakage | partially developed |
| Free-form suffix parsing | avoid structured-output degradation | active |

These design choices are directly motivated by the evaluator-bias literature (Wu & Aji, 2023; Dubois et al., 2024; Krumdick et al., 2025; Tam et al., 2024).

### 4.4. Measurement Stack

The current analysis uses several overlapping lenses:

- abstain rate,
- singleton rate,
- mean subset size,
- expected stage,
- mid-scale occupancy,
- stage entropy,
- expert-agreement confidence,
- DST / TBM style belief aggregation,
- local semantic rubric embeddings.

The current lesson from V3 is that **geometry-first metrics** are more interpretable than any single aggregation formalism on their own.

## 5. Pilot Evidence

### 5.1. V2 - Engine Prototype Testing

The V2 pilot established that distinct models can exhibit qualitatively distinct adjudicative geometries under a common engine setup.

The main findings were:

- models differed in mid-scale occupancy, abstention, and dynamic range,
- within-vendor version differences could exceed cross-vendor differences,
- `gpt-5.2-chat` exhibited a compressed regime relative to `gpt-4.1` and Qwen,
- and these differences were strong enough to justify an ablation-oriented follow-up rather than a simple model bakeoff.

The key V2 contribution was discovery: geometry itself appeared to be a meaningful object of analysis.

### 5.2. V3 - GPT Ablations

The V3 pilot moved from pooled comparison to a matched intervention matrix over 22 completed experiments, with 30 samples per experiment.

The strongest V3 findings were:

1. **Abstention is a real behavioral lever.**
   - especially strong for `gpt-5.2`
2. **Concept framing is one of the strongest movers.**
   - `fascism` versus `illiberal democracy` produced large matched shifts
3. **Rubric/scoring model placement matters.**
   - the role split is a real design axis
4. **Adjudicative compression is real, but not universal.**
   - the `d1` control produced a genuinely compressed regime
5. **`l3` was weaker than expected in the frozen matrix.**
6. **Scale size mostly changed expressivity, not certainty.**

### 5.3. Two Different Non-Smooth Regimes

V3 also showed that "weird geometry" is not one phenomenon.

At minimum, the current evidence supports two distinct non-smooth regimes:

1. **Compression**
   - high abstain,
   - near-zero mid-scale occupancy,
   - low entropy,
   - near-total singleton behavior
2. **Interior concentration**
   - low abstain,
   - high mid-scale occupancy,
   - broader subset use,
   - but still a relatively narrow internal operating band

This is important because it means future analysis should not treat every non-smooth output regime as the same pathology.

### 5.4. Rubric Layer Findings

The current rubric analysis now includes real local semantic embeddings, not just lexical overlap.

The strongest current rubric-layer conclusions are:

- full-rubric similarity is generally high across matched contrasts,
- the larger semantic shifts often appear at the **stage level**, especially upper stages,
- many behavioral differences are therefore likely happening in scoring behavior and evidence interaction, not solely through wholesale rubric rewrites.

This makes the rubric layer important, but not sufficient as a full explanation of V3 behavior.

## 6. What We Think Is Real

The strongest current claims are:

1. **Adjudicative geometry is configuration-sensitive.**
2. **Abstention is not cosmetic.**
3. **Concept framing matters materially.**
4. **Pipeline placement matters.**
5. **Compression is a real descriptive phenomenon for some configurations.**

These are all supported by current pilot evidence without requiring a stronger theoretical claim than the data can currently bear.

## 7. What We Do Not Yet Think Is Established

We do **not** currently think the following are established:

1. **Epistemic entrenchment** as the primary framing.
   - The evidence is stronger on geometry than on strong claims about entrenched epistemics.
2. **Clean causal interpretation of the bundle families.**
   - `a6/a7` remain interesting but methodologically messy in V3.
3. **`l3` as a major first-order lever.**
   - It remains worth testing, but the frozen V3 matrix does not support a strong claim.
4. **DST as the dominant interpretive lens.**
   - It remains useful, but geometry-first interpretation is currently more robust.

## 8. Current Research Direction

The project should currently be framed as:

> judge-gym is a design-space engine for measuring how LLM judge configurations reshape adjudicative geometry on contested concepts.

The near-term purpose of V3.1 is not to reopen the whole study, but to resolve the strongest remaining ambiguities:

1. fix the bundle/clustering comparison surface,
2. run symmetric smaller/chat model follow-ups,
3. probe higher-cardinality clustered scales,
4. improve verdict-geometry versus certainty analysis.

If these succeed, the project will have a much stronger basis for a more stable paper draft.

## 9. Limitations

- The current evidence is still pilot-scale.
- Some key families, especially the bundle families, remain partly descriptive rather than cleanly causal.
- The rubric-embedding layer is now real, but motif-level rubric analysis remains future work.
- The relationship between verdict geometry and expert-agreement certainty is not yet fully analyzed.
- The current aggregation stack is still partly diagnostic rather than final.

## 10. Selected References

Dempster, A. P. (1967). Upper and lower probabilities induced by a multivalued mapping. _The Annals of Mathematical Statistics_, 38(2), 325-339.

Dubois, Y., Li, X., Taori, R., Zhang, T., Gulrajani, I., Ba, J., Guestrin, C., Liang, P., & Hashimoto, T. (2024). Alpaca-Eval 2: Length-controlled evaluation of instruction-following models.

Feng, S., Park, C. Y., Liu, Y., & Tsvetkov, Y. (2023). From pretraining data to language models to downstream tasks: Tracking the trails of political biases leading to unfair NLP models.

Gallie, W. B. (1956). Essentially contested concepts. _Proceedings of the Aristotelian Society_, 56, 167-198.

Guerdan, L., et al. (2025). Rating indeterminacy: Examining when LLM evaluators disagree with humans.

Hartmann, J., Schwenzow, J., & Witte, M. (2023). The political ideology of conversational AI: Converging evidence on ChatGPT's pro-environmental, left-libertarian orientation.

Kadavath, S., Conerly, T., Askell, A., et al. (2022). Language models (mostly) know what they know.

Kim, S., Shin, J., Cho, Y., et al. (2024). Prometheus 2: An open source language model specialized in evaluating other language models.

Krumdick, M., Lovering, C., Singh, S., & Hoover, B. (2025). No free labels: Limitations of LLM-as-a-judge without human grounding.

Panickssery, A., Bowman, S. R., & Feng, S. (2024). LLM evaluators recognize and favor their own generations.

Santurkar, S., Durmus, E., Ladhak, F., Lee, C., Liang, P., & Hashimoto, T. (2023). Whose opinions do language models reflect?

Shafer, G. (1976). _A Mathematical Theory of Evidence_. Princeton University Press.

Shankar, S., Le, D., Basta, S., Lakhotia, K., Edunov, S., & Ghosh, S. (2024). Who validates the validators? Aligning LLM-assisted evaluation of LLM outputs with human preferences.

Shi, Z., Wang, J., Huang, Z., et al. (2025). Judging the judges: Evaluating alignment and vulnerabilities in LLMs-as-judges.

Stureborg, R., Alikaniotis, D., & Suhara, Y. (2024). Large language models are inconsistent and biased evaluators.

Tam, Z. R., Wu, C., Tsai, Y., et al. (2024). Let me speak freely? A study on the impact of format restrictions on performance of large language models.

Tan, J., Jiang, T., & Bansal, M. (2024). JudgeBench: A benchmark for evaluating LLM-based judges.

Wu, M., & Aji, A. F. (2023). Style over substance: Evaluation biases for large language models.

You, J., Ying, Z., & Leskovec, J. (2020). Design space for graph neural networks.

Zheng, L., Chiang, W., Sheng, Y., et al. (2023). Judging LLM-as-a-judge with MT-Bench and Chatbot Arena.
