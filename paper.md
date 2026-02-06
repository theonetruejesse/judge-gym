# Sectarian Judges: Measuring Epistemic Entrenchment in LLM-as-Judge Evaluation of Contested Political Concepts

> **Working paper — pre-results.** This document presents the theoretical framework, experimental design, and analysis plan for an ongoing study. Results will be reported in a subsequent version.

---

## Abstract

Large language models are increasingly deployed as automated evaluators ("LLM-as-Judge") for tasks ranging from summarization quality to political content analysis. We investigate whether divergent safety training regimes produce _Sectarian Judges_ — models that yield conflicting evaluations of essentially contested political concepts while simultaneously hallucinating expert consensus. We introduce **judge-gym**, an open-source design space engine inspired by GraphGym (You et al., 2020) that treats each evaluation dimension — model family, rubric source, concept, evidence, scoring method — as an axis in a configurable ablation surface. Our experimental design tests four hypotheses: (1) epistemic entrenchment, where model families exhibit high inter-model variance on contested concepts; (2) consensus hallucination, where models predict high expert agreement probabilities despite active divergence from the ensemble; (3) framework sensitivity, where high-confidence judgments collapse under rubric swap; and (4) forced-choice inflation, where some measured polarization is an artifact of point-verdict elicitation resolvable through subset verdicts and Dempster-Shafer aggregation. We employ seven controls grounded in the evaluation literature — tone neutralization, forced-commitment scales, double randomization, rubric validation, abstain gates, fresh-window probing, and free-form suffix parsing — and validate the engine against discriminant controls, dose-response conditions, and external benchmarks. This paper presents the full theoretical motivation, methodology, and analysis plan; empirical results are forthcoming.

---

## 1. Introduction

The use of LLMs as automated judges has scaled rapidly. MT-Bench (Zheng et al., 2023), Alpaca-Eval (Dubois et al., 2024), and numerous downstream applications rely on models to evaluate model outputs — a practice sometimes called "LLM-as-Judge." The appeal is obvious: human annotation is expensive, slow, and itself subject to inter-rater disagreement. LLM judges offer scalability and consistency.

But consistency is not neutrality. Every frontier model arrives shaped by a training regime — RLHF reward models, constitutional AI principles, red-team filters — that encodes implicit evaluative commitments. For factual tasks (math, coding, factual QA), these commitments are largely irrelevant: the answer is right or wrong. For _essentially contested concepts_ (Gallie, 1956) — fascism, democratic backsliding, populism — the situation is different. There is no ground truth. The question is not whether the model gets the answer right, but whether models _trained under different normative regimes_ systematically disagree, and whether they are aware they disagree.

We call this the **Sectarian Judge** problem: a model that (a) produces evaluations that diverge from the model ensemble on contested concepts, and (b) assigns high probability to expert agreement with its own verdict — hallucinating consensus where none exists. If this pattern holds, it has immediate implications for any pipeline that uses LLM-as-Judge on politically or ethically contested content: the choice of model is not a neutral engineering decision but an implicit normative commitment.

### 1.1. Contributions

1. **A formal framework for measuring epistemic entrenchment** in LLM judges, combining Jensen-Shannon divergence (information-theoretic polarization), Dempster-Shafer conflict (evidence-theoretic polarization), and self-reported expert agreement probabilities (metacognitive calibration).

2. **judge-gym**, an open-source design space engine that treats LLM-as-Judge evaluation as a configurable experiment. Inspired by GraphGym (You et al., 2020), which systematically explored 315,000 GNN designs across 32 tasks, judge-gym allows researchers to define experiments as configuration records and sweep across model, rubric, concept, and method axes without code changes.

3. **A methodological contribution** distinguishing genuine polarization from forced-choice noise through the comparison of point verdicts (single-label) and subset verdicts (multi-label, DST-compatible) on the same evidence. This operationalizes a long-standing distinction in measurement theory (Dempster, 1967; Shafer, 1976) for the LLM evaluation setting.

4. **A dose-response experimental design** with discriminant controls, external benchmarks, and rubric swap trials that enables causal inference about the source of inter-model divergence.

---

## 2. Related Work

### 2.1. LLM-as-Judge Evaluation

The LLM-as-Judge paradigm was formalized by Zheng et al. (2023) with MT-Bench, which demonstrated that GPT-4 judgments aligned with human preferences at >80% agreement. Subsequent work revealed systematic biases: position bias (preferring the first option; Shi et al., 2025), verbosity bias (preferring longer, more polished responses; Wu & Aji, 2023; Stureborg et al., 2024), and self-enhancement bias (models preferring their own outputs; Panickssery et al., 2024).

Prometheus 2 (Kim et al., 2024) showed that anchored rubrics with explicit criteria reduce variance and improve judge-human alignment. Dubois et al. (2024) in Alpaca-Eval 2 introduced the practice of measuring confounds (e.g., length) and regressing them out to find the "true" quality signal. Wei et al. (2024) provided a systematic evaluation across prompt orderings, rubric placements, and rating scales, showing that seemingly minor formatting choices significantly affect alignment. Krumdick et al. (2025) warned against forcing models to provide evaluations on out-of-distribution inputs, advocating for explicit abstention.

Our work extends this literature from _format bias_ to _ideological bias_: we ask not whether the prompt structure changes the score, but whether the model's training regime does, specifically for concepts where no ground truth exists.

### 2.2. Bias and Ideology in Language Models

Santurkar et al. (2023) demonstrated that language models exhibit political opinions that are not uniformly distributed and vary by model family. Feng et al. (2023) showed that RLHF training shifts model opinions toward the preferences of annotator populations. Hartmann et al. (2023) found that ChatGPT exhibits a left-libertarian bias on standard political compass instruments.

These findings establish that models _have_ political orientations. Our question is different: we ask whether these orientations _manifest as systematic evaluation bias_ when models are used as judges on contested political content, and whether models _know_ they are biased (i.e., whether their metacognitive calibration reflects their divergence from the ensemble).

### 2.3. Calibration and Metacognition

Kadavath et al. (2022) showed that asking models "What is the probability your answer is correct?" yields better-calibrated confidence estimates than self-reported verbal confidence. We adapt this technique: instead of asking about correctness (which is undefined for contested concepts), we ask about _expert agreement_ — "What is the probability that independent experts would reach the same verdict?" This transforms a calibration probe into a measure of consensus hallucination.

Stureborg et al. (2024) showed that prior context anchors subsequent model outputs. We address this with a _fresh-window probing_ protocol: the expert agreement estimate is elicited in a clean context window with no chain-of-thought history from the scoring phase, separating the model's genuine epistemic state from context-dependent anchoring.

### 2.4. Dempster-Shafer Theory and Uncertainty

Dempster (1967) and Shafer (1976) developed the theory of belief functions as a generalization of Bayesian probability that permits belief to be assigned to _sets_ of hypotheses, not just singletons. This formalism is well-suited to our setting: when a model selects a subset of rubric stages (e.g., "this evidence supports stages B and C"), it is expressing a basic mass assignment on the power set of the frame of discernment.

Guerdan et al. (2025) recently showed in the context of LLM evaluation that judge performance changes depending on forced-choice versus response-set elicitation — the same phenomenon we formalize through the comparison of point and subset verdicts. Our contribution is to connect this empirical observation to the formal apparatus of DST, enabling principled combination of uncertain verdicts across samples and models.

### 2.5. Evaluation Validity

Shankar et al. (2024) asked "Who Validates the Validators?" and proposed three criteria: discriminant validity (judges agree on easy cases), construct validity (judges measure what they claim to measure), and consistency (test-retest reliability). Our experimental design addresses all three through: (a) control tasks with known ground truth (V-Dem scores) for discriminant validity, (b) external benchmarks (JudgeBench; Tan et al., 2024) for construct validity, and (c) repeated scoring with varying random seeds for test-retest reliability.

Tam et al. (2024) demonstrated that constraining model output to structured JSON during reasoning degrades performance by 5–10%, because the model allocates capacity to syntax compliance. We adopt their recommendation: free-form reasoning with a parsed suffix (`VERDICT: [LETTER]`), retaining structured output only as an ablation axis.

---

## 3. Problem Formulation

### 3.1. Essentially Contested Concepts

Gallie (1956) defined an _essentially contested concept_ as one where:

1. The concept is appraisive (carries evaluative weight).
2. The concept is internally complex.
3. Any description of the concept is liable to modification in light of changing circumstances.
4. Reasonable people can and do disagree about its application.

Paradigmatic examples include _democracy_, _justice_, _freedom_, and — critically for our study — _fascism_, _democratic backsliding_, and _populism_. These concepts resist operationalization into ground-truth labels precisely because their contested nature is a feature, not a bug: the disagreement is constitutive of the concept.

When an LLM judge evaluates evidence about "fascism in the United States," it must make evaluative commitments that would, in a human context, be recognized as contested. The question is whether different models make _different_ commitments, and whether they recognize the contestedness.

### 3.2. The Sectarian Judge

We define a **Sectarian Judge** as a model $M_i$ that exhibits:

1. **Divergence:** For a contested concept $c$, $M_i$'s score distribution $p_i$ diverges from the model ensemble distribution $\bar{p}$, measured by Jensen-Shannon divergence $\text{JSD}(p_i \| \bar{p}) > \tau$.

2. **Confidence:** $M_i$'s self-reported expert agreement probability $\mathbb{E}[\text{Prob}_{expert}] > 0.8$, indicating the model believes independent experts would concur with its verdict.

3. **Entrenchment:** Both conditions hold simultaneously. We define the **Entrenchment Index** as:

$$E_i = P_i \times \mathbb{E}[\text{Prob}_{expert,i}]$$

where $P_i$ is the polarization score (JSD) for model $i$. High $E_i$ is pathological: the model disagrees with its peers _and_ believes everyone agrees with it.

### 3.3. Forced-Choice Inflation

Standard evaluation forces models to select exactly one label from a scale. When the evidence is genuinely ambiguous — supporting multiple interpretations — the model must commit to one, potentially inflating apparent disagreement. Two models that both believe "this could be stage 2 or 3" but are forced to choose differently will appear to disagree when they fundamentally agree on the uncertainty.

We formalize this through the comparison of scoring methods:

- **Point verdict** (`freeform-suffix-single`): The model selects exactly one label. Analysis uses JSD over score distributions.
- **Subset verdict** (`freeform-suffix-subset`): The model selects one or more labels. Analysis uses Dempster-Shafer mass assignment and conflict coefficient $k$.

If $k_{\text{subset}} \ll P_{\text{single}}$ for the same (model, evidence) pairs, some measured polarization was forced-choice noise, not genuine disagreement. If $k_{\text{subset}} \approx P_{\text{single}}$, the disagreement is real.

---

## 4. Hypotheses

**H1 — Epistemic Entrenchment.** Model families will exhibit high inter-model variance (polarization $P > 0.15$) on Essentially Contested Concepts (e.g., fascism in the USA) when controlling for rubric, evidence, and scoring method. This variance will be significantly higher than on control concepts (e.g., democracy quality in Norway).

**H2 — Consensus Hallucination.** On ECC tasks, models with high polarization ($P > 0.15$) will simultaneously report high expert agreement probabilities ($\mathbb{E}[\text{Prob}_{expert}] > 0.8$), yielding high Entrenchment Index ($E > 0.12$). On control tasks, expert agreement probabilities should be high _and justified_ (low $P$, high agreement with V-Dem reference).

**H3 — Framework Sensitivity.** Expert agreement probabilities will drop significantly (>0.2 decrease) when a model is forced to use a rival model's rubric (rubric swap condition), indicating that confidence is derived from framework-evidence compatibility rather than evidence alone. This operationalizes motivated reasoning: confidence that is robust to framework change is evidence-based; confidence that collapses is framework-based.

**H4 — Forced-Choice Inflation.** DST conflict $k$ from subset verdicts will be significantly lower than JSD polarization $P$ from point verdicts for the same (model, evidence) pairs, indicating that some measured polarization is forced-choice noise rather than genuine disagreement. The gap $P_{\text{single}} - k_{\text{subset}}$ will be larger for moderate-contestation concepts (where genuine ambiguity is higher) than for high-contestation concepts (where models have strong directional commitments that persist under subset elicitation).

---

## 5. Methodology

### 5.1. Design Space Engine

Inspired by GraphGym (You et al., 2020), which explored 315,000 GNN designs by treating each architectural choice as a configurable axis, judge-gym treats LLM-as-Judge evaluation as a design space. Each dimension is independently configurable:

| Axis                | Values                                                                                         |
| :------------------ | :--------------------------------------------------------------------------------------------- |
| Model Family        | GPT-4.1, Claude Sonnet 4, Claude Sonnet 4.5, Grok 3, Gemini 2.5 Pro, Gemini 2.5 Flash, o4-mini |
| Concept             | "fascism," "democratic backsliding," "democracy quality," benchmark                            |
| Scoring Method      | `freeform-suffix-single`, `freeform-suffix-subset`, `structured-json`                          |
| Scale Size          | 3, 4 (default), 5                                                                              |
| Tone Neutralization | On / Off                                                                                       |
| Label Randomization | On / Off                                                                                       |
| Prompt Ordering     | Rubric-first / Evidence-first                                                                  |
| Abstain Gate        | On / Off                                                                                       |
| Fresh-Window Probe  | On / Off                                                                                       |

An **experiment** is a single point in this space. A **sweep** is a batch of experiments covering a slice. The engine handles evidence collection, rubric generation, scoring, probing, rate limiting, and data export — all durable, all auditable. To run a new ablation, the researcher creates experiment records with different parameters. No code changes are required.

### 5.2. Task Types and Dose-Response Design

Not all evaluation tasks are the same. The engine supports three task types that together form a dose-response design:

| Task Type     | Evidence Source     | Rubric Source     | Ground Truth               | Purpose               |
| :------------ | :------------------ | :---------------- | :------------------------- | :-------------------- |
| **ECC**       | News search         | Model-generated   | None                       | Primary experiment    |
| **Control**   | News search         | Model-generated   | Expert proxy (e.g., V-Dem) | Discriminant validity |
| **Benchmark** | Pre-curated dataset | Pre-loaded rubric | Known answer               | Engine calibration    |

Critically, for ECC and Control tasks, the model sees identical prompts. It does not know which condition it is in. The only difference is in the _analysis_: control tasks have reference answers that enable validity checks. This prevents demand effects.

The dose-response gradient:

| Concept                            | Task Type | Contestation | Expected Behavior                    |
| :--------------------------------- | :-------- | :----------- | :----------------------------------- |
| "fascism" (USA)                    | ECC       | High         | High polarization, high entrenchment |
| "democratic backsliding" (USA)     | ECC       | Medium       | Moderate polarization                |
| "democracy quality" (Norway)       | Control   | Low          | Low polarization, high consensus     |
| Curated benchmark set (JudgeBench) | Benchmark | None         | Accuracy against known ground truth  |

If the engine produces monotonically increasing polarization along this gradient and high accuracy on benchmarks, the measurement apparatus is working. If not, the results are suspect regardless of the ECC findings.

### 5.3. Pipeline

The experimental pipeline proceeds in five stages:

**Stage 1 — Evidence Collection.** For ECC and Control tasks: scrape news articles matching (concept, country, date window) via Firecrawl, then optionally neutralize tone via a fixed utility model (GPT-4.1 Mini). The neutralizer strips rhetorical devices, emotional language, and editorializing, producing 150-word clinical summaries. For Benchmark tasks: load pre-curated evidence. Evidence is shared across all experiments on the same window.

**Stage 2 — Rubric Generation.** For ECC and Control tasks: the experiment's model generates an $n$-stage evaluative rubric (default $n=4$, even-numbered to eliminate center bias). A critic agent (fixed utility model) scores the rubric for observability and discriminability. For Benchmark tasks: load pre-defined rubrics.

**Stage 3 — Scoring.** Each evidence item is scored multiple times (default 5) with varying random seeds. Strategy resolvers translate experiment configuration into concrete behavior: which content field (raw or neutralized), which prompt suffix (single or subset verdict), which output mode (free-form text or structured JSON), and which parser. Double randomization shuffles both label-to-stage mappings and display order to wash out position and anchor bias.

**Stage 4 — Rubric Swap.** For high-divergence model pairs identified in Stage 3: re-score evidence using a rival model's rubric. This tests whether confidence is evidence-based (survives swap) or framework-based (collapses under swap).

**Stage 5 — Epistemic Probe.** In a fresh context window (no prior reasoning history), ask the same model: "What is the probability that independent experts would reach the same verdict?" This adapts Kadavath et al.'s (2022) calibration technique to measure consensus hallucination.

### 5.4. Controls

| Control                     | Target Bias                      | Implementation                                                                   | Key Reference                            |
| :-------------------------- | :------------------------------- | :------------------------------------------------------------------------------- | :--------------------------------------- |
| Tone Neutralization         | Style/Beauty Bias                | Articles reduced to 150-word clinical summaries                                  | Wu & Aji (2023); Stureborg et al. (2024) |
| 4-Point Scale (no midpoint) | Scale Compression + Center Bias  | Forced 1–4 with no midpoint; forces directional commitment                       | Kim et al. (2024); Garland (1991)        |
| Double Randomization        | Position & Anchor Bias           | Labels and display order shuffled per sample via seeded Fisher-Yates             | Zheng et al. (2023); Shi et al. (2025)   |
| Rubric Validation           | Competence Confound              | Critic agent scores observability/discriminability; used as regression covariate | Dubois et al. (2024)                     |
| Abstain Gate                | Forced-Choice Noise              | Explicit step allowing models to decline before scoring                          | Krumdick et al. (2025)                   |
| Fresh-Window Probing        | Context Leakage                  | Expert agreement estimated in clean context, zero CoT history                    | Stureborg et al. (2024)                  |
| Free-Form Suffix Parsing    | Constrained Decoding Degradation | No JSON schema enforcement during reasoning; parse `VERDICT:` from suffix        | Tam et al. (2024)                        |

### 5.5. Scoring Elicitation

Two primary elicitation modes, with a third as ablation:

**Point Verdict** (`freeform-suffix-single`). The model reasons in free-form text and concludes with `VERDICT: [LETTER]` or `ABSTAIN`. This is the baseline condition. Analysis uses score distributions and JSD.

**Subset Verdict** (`freeform-suffix-subset`). The model reasons freely and concludes with `VERDICT: [LETTER(S)]` (comma-separated) or `ABSTAIN`. The model may select one or more stages when evidence supports multiple interpretations. This maps directly to Dempster-Shafer basic mass assignments. Analysis uses DST conflict $k$, belief/plausibility intervals, and uncertainty gap.

**Structured JSON** (`structured-json`, ablation only). The model produces structured output via `generateObject`. Included to test the Tam et al. (2024) degradation hypothesis.

---

## 6. Analysis Plan

### 6.1. Primary Metrics

| Metric                            | Definition                                                                      | Applies To         |
| :-------------------------------- | :------------------------------------------------------------------------------ | :----------------- |
| Polarization Score ($P$)          | Jensen-Shannon Divergence of score distributions between model families         | ECC, Control       |
| Entrenchment Index ($E$)          | $P \times \mathbb{E}[\text{Prob}_{expert}]$                                     | ECC                |
| Swap Sensitivity                  | $\Delta \text{Prob}_{expert}$ when using a rival model's rubric                 | ECC, Control       |
| Ground Truth Accuracy             | Agreement rate with known/expert reference values                               | Control, Benchmark |
| Abstention Rate                   | Fraction of samples where the model declines to score                           | All                |
| DST Conflict ($k$)                | Dempster conflict coefficient between model families' aggregated mass functions | ECC, Control       |
| Uncertainty Gap                   | $Pl(s_i) - Bel(s_i)$ averaged across stages                                     | All (subset only)  |
| Mean Subset Size                  | Average number of stages selected per verdict                                   | All (subset only)  |
| Internal Consistency ($\sigma^2$) | Score variance across re-runs on identical (model, evidence, rubric) triples    | All                |

### 6.2. Dempster-Shafer Aggregation

**Frame of discernment.** $\Theta = \{s_1, s_2, \ldots, s_n\}$ where $n$ is the scale size (default 4).

**Mass assignment.** Each scoring sample with decoded scores $\{i, j, \ldots\}$ becomes a basic mass assignment $m(A) = 1$ where $A = \{s_i, s_j, \ldots\} \subseteq \Theta$.

**Combination.** Given $n$ samples for the same (model, evidence, rubric) triple, combine sequentially using Dempster's rule:

$$m_{1,2}(A) = \frac{1}{1-k} \sum_{B \cap C = A} m_1(B) \cdot m_2(C)$$

where $k = \sum_{B \cap C = \emptyset} m_1(B) \cdot m_2(C)$ is the conflict coefficient.

**Derived measures per (model, evidence) pair:**

| Measure         | Definition                        | Interpretation                                          |
| :-------------- | :-------------------------------- | :------------------------------------------------------ |
| $Bel(s_i)$      | $\sum_{A \subseteq \{s_i\}} m(A)$ | Lower bound: evidence specifically supporting stage $i$ |
| $Pl(s_i)$       | $1 - Bel(\overline{\{s_i\}})$     | Upper bound: absence of evidence against stage $i$      |
| Uncertainty Gap | $Pl(s_i) - Bel(s_i)$              | Width of epistemic uncertainty interval                 |
| Conflict $k$    | From the combination rule         | Inter-sample disagreement within one model              |

**Cross-model conflict.** The aggregated mass functions of two model families are combined via Dempster's rule. The resulting $k$ is a formal measure of polarization grounded in evidence theory.

**Comparison with JSD.** When all verdicts are singletons (point verdicts), DST conflict degenerates to a JSD-like measure. When models express uncertainty via subsets, DST captures information that JSD collapses. The point-to-subset comparison directly tests H4 (Forced-Choice Inflation).

### 6.3. Regression Models

Following Dubois et al. (2024), we use OLS regression to isolate the effect of model family after controlling for confounds:

**Primary ECC regression:**

$$\text{Score} \sim \beta_0 + \beta_1(\text{Model}) + \beta_2(\text{RubricQuality}) + \beta_3(\text{Concept}) + \epsilon$$

A significant $\beta_1$ after controlling for rubric quality and concept indicates model-specific evaluation bias.

**Ablation regression (pooled across task types):**

$$\text{Score} \sim \beta_0 + \beta_1(\text{Model}) + \beta_2(\text{ScoringMethod}) + \beta_3(\text{ScaleSize}) + \beta_4(\text{Neutralization}) + \epsilon$$

**DST-specific regression (subset scoring only):**

$$\text{UncertaintyGap} \sim \beta_0 + \beta_1(\text{Model}) + \beta_2(\text{Concept}) + \beta_3(\text{RubricQuality}) + \epsilon$$

### 6.4. Validity Checks

Following Shankar et al. (2024):

1. **Discriminant Control.** "Democracy quality" in Norway should yield consensus: $P < 0.1$, $k < 0.1$, and scores aligned with V-Dem Liberal Democracy Index ($\approx 0.95$).

2. **Dose-Response Monotonicity.** $P_{\text{fascism}} > P_{\text{backsliding}} > P_{\text{control}}$. Same ordering for $k$.

3. **External Benchmark.** JudgeBench (Tan et al., 2024) agreement rates $>80\%$ as engine calibration. If the engine cannot match known answers on objective tasks, ECC results are not interpretable.

4. **Internal Consistency.** Test-retest reliability: $\sigma^2 < 0.5$ per (model, evidence) triple across repeated runs with different random seeds (Wei et al., 2024).

5. **DST Sanity.** For singleton-only scoring, DST conflict $k$ and JSD polarization $P$ should correlate strongly ($r > 0.8$).

---

## 7. Implementation

judge-gym is implemented as a Turborepo monorepo with two packages:

- **engine** (`packages/engine/`): A Convex backend implementing the five-stage pipeline. Durable workflows, rate-limited LLM calls, and full audit trails via agent threads. The engine uses an abstract agent base class, strategy resolvers (pure functions mapping experiment config to concrete agent behavior), and deterministic utility functions for verdict parsing, label randomization, and DST mass assignment.

- **analysis** (`packages/analysis/`): A Python package (uv + Jupyter) for statistical analysis. Pulls data from the engine via Convex HTTP API. Implements JSD, DST aggregation, entrenchment index, and OLS regression using pandas, numpy, and statsmodels.

The architecture follows a key principle: **experiments are data, not code.** Every ablation is expressed as a configuration record. The engine interprets configuration at runtime through strategy resolvers — pure functions that map config values to typed behavior objects. Adding a new ablation axis requires modifying three files (schema, strategy, resolver); no agent logic, workflow code, or prompt templates change.

All LLM interactions are stored as agent threads, providing a complete audit trail. Deterministic computation (verdict parsing, label shuffling, DST mass assignment) is strictly separated from LLM generation — models produce text, and pure functions extract structure from the output.

The engine is open-source and designed for reproducibility. Experiment records contain the full configuration needed to replicate any trial. The analysis package consumes denormalized CSV exports and produces publication-ready metrics.

---

## 8. Expected Contributions and Limitations

### Expected Contributions

This study contributes to three areas:

1. **AI Safety.** If the Sectarian Judge pattern holds, the choice of LLM evaluator for contested content is a normative choice, not an engineering convenience. This has implications for content moderation, automated fact-checking, and any pipeline where LLM judges evaluate politically or ethically contested material.

2. **Evaluation Methodology.** The design space approach enables systematic comparison of evaluation configurations that are typically tested in isolation. The DST-based formalization of forced-choice inflation provides a principled framework for distinguishing genuine disagreement from measurement artifact.

3. **Metacognitive Calibration.** The combination of fresh-window probing with rubric swap creates a diagnostic for _motivated reasoning_ in LLM judges: models whose confidence survives framework change are evidence-based; models whose confidence collapses are framework-based.

### Limitations

Several limitations should be noted in advance:

- **Concept selection.** We test a small number of political concepts. The degree of entrenchment may vary for other contested domains (ethical, aesthetic, legal).

- **Temporal window.** Evidence is drawn from a specific time period. Model behavior on the same concepts may shift with updated training data or changed safety filters.

- **Rubric quality as confounder.** Although we control for rubric quality via the critic agent and regression, model-generated rubrics may systematically differ in ways that the critic does not capture.

- **Expert agreement as proxy.** We use self-reported expert agreement probability as a metacognitive probe. The actual agreement of human experts on these tasks remains unmeasured in this study (planned for a follow-up).

- **Scale of sweep.** The full design space (7 models $\times$ 3 ECC concepts $\times$ controls $\times$ ablations) is large but not exhaustive. We prioritize the main hypotheses over complete coverage.

---

## References

Dubois, Y., Li, X., Taori, R., Zhang, T., Gulrajani, I., Ba, J., Guestrin, C., Liang, P., & Hashimoto, T. (2024). Alpaca-Eval 2: Length-controlled evaluation of instruction-following models. _arXiv:2404.04475_.

Dempster, A. P. (1967). Upper and lower probabilities induced by a multivalued mapping. _The Annals of Mathematical Statistics_, 38(2), 325–339.

Feng, S., Park, C. Y., Liu, Y., & Tsvetkov, Y. (2023). From pretraining data to language models to downstream tasks: Tracking the trails of political biases leading to unfair NLP models. _ACL 2023_.

Gallie, W. B. (1956). Essentially contested concepts. _Proceedings of the Aristotelian Society_, 56, 167–198.

Garland, R. (1991). The mid-point on a rating scale: Is it desirable? _Marketing Bulletin_, 2, 66–70.

Guerdan, L., et al. (2025). Rating indeterminacy: Examining when LLM evaluators disagree with humans. _CMU Technical Report_.

Hartmann, J., Schwenzow, J., & Witte, M. (2023). The political ideology of conversational AI: Converging evidence on ChatGPT's pro-environmental, left-libertarian orientation. _arXiv:2301.01768_.

Kadavath, S., Conerly, T., Askell, A., et al. (2022). Language models (mostly) know what they know. _arXiv:2207.05221_.

Kim, S., Shin, J., Cho, Y., et al. (2024). Prometheus 2: An open source language model specialized in evaluating other language models. _arXiv:2405.01535_.

Koo, R., Lee, M., Raheja, V., et al. (2023). Benchmarking cognitive biases in large language models as evaluators. _arXiv:2309.17012_.

Krumdick, M., Lovering, C., Singh, S., & Hoover, B. (2025). No free labels: Limitations of LLM-as-a-judge without human grounding. _arXiv_.

Panickssery, A., Bowman, S. R., & Feng, S. (2024). LLM evaluators recognize and favor their own generations. _arXiv:2404.13076_.

Santurkar, S., Durmus, E., Ladhak, F., Lee, C., Liang, P., & Hashimoto, T. (2023). Whose opinions do language models reflect? _ICML 2023_.

Shafer, G. (1976). _A Mathematical Theory of Evidence_. Princeton University Press.

Shankar, S., Le, D., Basta, S., Lakhotia, K., Edunov, S., & Ghosh, S. (2024). Who validates the validators? Aligning LLM-assisted evaluation of LLM outputs with human preferences. _arXiv:2404.12272_.

Shi, Z., Wang, J., Huang, Z., et al. (2025). Judging the judges: Evaluating alignment and vulnerabilities in LLMs-as-judges. _arXiv:2406.12624_.

Stureborg, R., Alikaniotis, D., & Suhara, Y. (2024). Large language models are inconsistent and biased evaluators. _arXiv:2405.01724_.

Tam, Z. R., Wu, C., Tsai, Y., et al. (2024). Let me speak freely? A study on the impact of format restrictions on performance of large language models. _arXiv:2408.02442_.

Tan, J., Jiang, T., & Bansal, M. (2024). JudgeBench: A benchmark for evaluating LLM-based judges. _arXiv_.

Wei, J., Durmus, E., Liang, P., et al. (2024). Systematic evaluation of LLM-as-a-judge in LLM alignment tasks: Explainable metrics and diverse prompt templates. _arXiv_.

Wu, M. & Aji, A. F. (2023). Style over substance: Evaluation biases for large language models. _arXiv:2307.03025_.

You, J., Ying, Z., & Leskovec, J. (2020). Design space for graph neural networks. _NeurIPS 2020_.

Zheng, L., Chiang, W., Sheng, Y., et al. (2023). Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. _NeurIPS 2023_.
