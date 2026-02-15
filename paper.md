# Measuring Epistemic Entrenchment in LLM-as-Judge Evaluation of Contested Political Concepts

_this document is a temporary generative artifact. it reflects collaborative development with AI assistance. All empirical claims and citations require further verification. Pilot data preliminary; full results forthcoming._
_tldr; i'm treating this as a save state. DO NOT INTERPRET THIS AS REAL PAPER._

> **Working paper — pilot v2 results.**

---

## Abstract

Large language models are increasingly deployed as automated evaluators ("LLM-as-Judge") for tasks ranging from summarization quality to political content analysis. We investigate whether divergent safety training regimes produce **epistemic entrenchment** — models that yield conflicting evaluations of essentially contested political concepts while simultaneously overestimating expert agreement. We introduce **judge-gym**, an open-source design space engine that treats each evaluation dimension — model family, rubric source, concept, evidence, scoring method — as an axis in a configurable ablation surface. Pilot results (n=540 scores, 4 models, 9 evidence items) reveal a striking geometric divergence: GPT-4.1 exhibits smooth, graded adjudication; Gemini-3.0-flash shows selective abstention; GPT-5.2-chat demonstrates extreme expressive compression (binary Stage-1/Abstain collapse with rare Stage-4 spikes); and Qwen-235b maintains expressive bandwidth comparable to GPT-4.1. This pattern suggests that **alignment-induced adjudicative compression** — not vendor identity or model scale — determines evaluative geometry in contested domains. Our experimental design tests four hypotheses: (1) epistemic entrenchment; (2) consensus hallucination; (3) framework sensitivity; and (4) forced-choice inflation. We employ seven methodological controls and validate against discriminant benchmarks. This paper presents the full theoretical motivation, pilot findings, refined methodology, and analysis plan.

---

## 1. Introduction

The use of LLMs as automated judges has scaled rapidly. MT-Bench (Zheng et al., 2023), Alpaca-Eval (Dubois et al., 2024), and numerous downstream applications rely on models to evaluate model outputs — a practice sometimes called "LLM-as-Judge." The appeal is obvious: human annotation is expensive, slow, and itself subject to inter-rater disagreement. LLM judges offer scalability and apparent consistency.

But consistency is not neutrality. Every frontier model arrives shaped by a training regime — RLHF reward models, constitutional AI principles, red-team filters — that encodes implicit evaluative commitments. For factual tasks (math, coding, factual QA), these commitments are largely irrelevant: the answer is right or wrong. For _essentially contested concepts_ (Gallie, 1956) — fascism, democratic backsliding, populism — the situation is different. There is no ground truth. The question is not whether the model gets the answer right, but whether models _trained under different normative regimes_ systematically disagree, and whether they are aware they disagree.

We call this the **epistemic entrenchment** problem: a model that (a) produces evaluations that diverge from the model ensemble on contested concepts, and (b) assigns high probability to expert agreement with its own verdict — hallucinating consensus where none exists. If this pattern holds, it has immediate implications for any pipeline that uses LLM-as-Judge on politically or ethically contested content: the choice of model is not a neutral engineering decision but an implicit normative commitment.

### 1.1. Pilot Discovery: Alignment-Induced Adjudicative Compression

Our pilot study (Section 6) reveals an unexpected and structurally significant pattern. Comparing four frontier models on identical evidence with stochastic rubric generation:

| Model                | Adjudicative Geometry  | Key Behavior                                                                         |
| :------------------- | :--------------------- | :----------------------------------------------------------------------------------- |
| **GPT-4.1**          | Smooth, expressive     | Distributed mass across Stages 2–3; minimal abstention                               |
| **Gemini-3.0-flash** | Thresholded, selective | Moderate graded evaluation; high abstention on "hot" evidence                        |
| **GPT-5.2-chat**     | Collapsed, binary      | Extreme Stage-1 concentration or abstention; rare Stage-4 spikes; hollowed mid-range |
| **Qwen-235b**        | Smooth, expressive     | Distributed mass comparable to GPT-4.1; selective but not systemic abstention        |

This pattern is inconsistent with simple vendor-identity or left-right ideological explanations. GPT-4.1 and GPT-5.2-chat — same vendor, different versions — show maximal divergence. Qwen-235b — different vendor, different alignment regime — resembles GPT-4.1 more than GPT-5.2-chat.

We interpret this as **alignment-induced adjudicative compression**: aggressive safety training can collapse the expressive dynamic range of political evaluation, transforming graded judges into binary sensors (Stage 1 vs. Abstain/Stage 4) with severely attenuated capacity for intermediate classification. This phenomenon is not universal (Qwen demonstrates), not inevitable (GPT-4.1 demonstrates), but regime-specific.

### 1.2. Contributions

1. **A formal framework for measuring epistemic entrenchment** in LLM judges, combining Jensen-Shannon divergence (information-theoretic polarization), Dempster-Shafer conflict (evidence-theoretic polarization), and self-reported expert agreement probabilities (metacognitive calibration).

2. **judge-gym**, an open-source design space engine that treats LLM-as-Judge evaluation as a configurable experiment. Inspired by GraphGym (You et al., 2020), judge-gym allows researchers to define experiments as configuration records and sweep across model, rubric, concept, and method axes without code changes.

3. **A methodological contribution** distinguishing genuine polarization from forced-choice noise through subset verdicts (multi-label, DST-compatible) and rubric-stochastic analysis. This operationalizes a long-standing distinction in measurement theory (Dempster, 1967; Shafer, 1976) for the LLM evaluation setting.

4. **Pilot evidence of alignment-induced adjudicative compression**, demonstrating that safety regime changes can fundamentally reshape evaluative geometry — with implications for longitudinal benchmarking, automated moderation, and computational social science.

---

## 2. Related Work

### 2.1. LLM-as-Judge Evaluation

The LLM-as-Judge paradigm was formalized by Zheng et al. (2023) with MT-Bench, which demonstrated that GPT-4 judgments aligned with human preferences at >80% agreement. Subsequent work revealed systematic biases: position bias (preferring the first option; Shi et al., 2025), verbosity bias (preferring longer responses; Wu & Aji, 2023; Stureborg et al., 2024), and self-enhancement bias (models preferring their own outputs; Panickssery et al., 2024).

Prometheus 2 (Kim et al., 2024) showed that anchored rubrics reduce variance. Dubois et al. (2024) introduced measuring confounds and regressing them out. Wei et al. (2024) showed that formatting choices significantly affect alignment. Krumdick et al. (2025) warned against forcing evaluations on out-of-distribution inputs, advocating explicit abstention.

Our work extends this literature from _format bias_ to _regime geometry_: we ask not whether prompt structure changes the score, but whether safety training reshapes the entire adjudicative surface — particularly for concepts without ground truth.

### 2.2. Bias and Ideology in Language Models

Santurkar et al. (2023) demonstrated that language models exhibit political opinions varying by model family. Feng et al. (2023) showed RLHF shifts opinions toward annotator preferences. Hartmann et al. (2023) found ChatGPT exhibits left-libertarian bias on political compass instruments.

These findings establish that models _have_ political orientations. Our question is different: whether these orientations _manifest as systematic evaluation geometry_ when models judge contested content, and whether models _know_ they disagree. Our pilot suggests that **within-vendor version differences can exceed cross-vendor differences** — implicating alignment regime over static ideology.

### 2.3. Calibration and Metacognition

Kadavath et al. (2022) showed that probability probes yield better-calibrated confidence than verbal confidence. We adapt this: instead of asking about correctness (undefined for contested concepts), we ask about _expert agreement_ — "What is the probability that independent experts would reach the same verdict?"

Our pilot reveals a paradox: GPT-5.2-chat shows _smoother confidence gradients_ than earlier models, but these gradients are anchored to a collapsed adjudicative surface. Better calibration of worse expressiveness is a novel form of **metacognitive entrenchment**.

### 2.4. Dempster-Shafer Theory and Uncertainty

Dempster (1967) and Shafer (1976) developed belief functions permitting mass assignment to _sets_ of hypotheses. This formalism suits our setting: when a model selects subset verdicts (e.g., "stages B and C"), it expresses basic mass assignment on the power set.

Guerdan et al. (2025) showed judge performance changes with forced-choice versus response-set elicitation. We connect this to DST, enabling principled combination of uncertain verdicts. Our innovation: **rubric-stochastic analysis** — treating each rubric as a sample from a conceptual distribution, enabling interval aggregation without assuming rubric stability.

### 2.5. Evaluation Validity

Shankar et al. (2024) proposed three criteria: discriminant validity (agreement on easy cases), construct validity (measuring what claimed), and consistency (test-retest reliability). Our design addresses all three through: (a) V-Dem controls for discriminant validity, (b) JudgeBench (Tan et al., 2024) for construct validity, (c) repeated scoring for reliability.

Tam et al. (2024) showed structured JSON during reasoning degrades performance 5–10%. We adopt free-form reasoning with parsed suffixes.

---

## 3. Problem Formulation

### 3.1. Essentially Contested Concepts

Gallie (1956) defined an _essentially contested concept_ as one where: (1) appraisive, (2) internally complex, (3) liable to modification, (4) reasonable disagreement persists. Paradigmatic examples: _democracy_, _justice_, _fascism_, _democratic backsliding_.

When an LLM judge evaluates evidence about "fascism in the United States," it makes evaluative commitments that would be recognized as contested in human context. The question is whether different models make _different_ commitments, and whether they recognize contestedness.

### 3.2. Epistemic Entrenchment

_this formulation i don't agree with. legacy generation from hypothetical framing._

We define an **entrenched judge** as model $M_i$ exhibiting:

1. **Divergence:** For contested concept $c$, $M_i$'s score distribution $p_i$ diverges from ensemble $\bar{p}$, with $\text{JSD}(p_i \| \bar{p}) > \tau$.

2. **Confidence:** Self-reported expert agreement $\mathbb{E}[\text{Prob}_{expert}] > 0.8$.

3. **Entrenchment:** Both hold simultaneously. **Entrenchment Index**:

$$E_i = P_i \times \mathbb{E}[\text{Prob}_{expert,i}]$$

High $E_i$ is pathological: the model disagrees with peers _and_ believes everyone agrees.

### 3.3. Adjudicative Compression

Our pilot suggests a structural phenomenon beyond simple disagreement: **alignment-induced adjudicative compression** — the collapse of expressive dynamic range to binary or near-binary output (Stage 1 vs. Abstain/Stage 4), with attenuated or absent intermediate classification.

Formal characterization: A model exhibits compression when, across evidence samples, the entropy of its stage distribution $H(p_i) < \epsilon$ despite evidence heterogeneity, and abstention mass $m(\emptyset)$ or Stage-1 mass $p(s_1)$ dominates.

### 3.4. Forced-Choice Inflation

Standard evaluation forces single-label selection. When evidence is genuinely ambiguous, models must commit to one, potentially inflating apparent disagreement. Two models both believing "stage 2 or 3" but forced to choose differently appear to disagree when they agree on uncertainty.

We compare:

- **Point verdict:** Single label; JSD analysis.
- **Subset verdict:** Multi-label; DST mass assignment and conflict $k$.

If $k_{\text{subset}} \ll P_{\text{single}}$, measured polarization was forced-choice noise. If $k_{\text{subset}} \approx P_{\text{single}}$, disagreement is genuine.

---

## 4. Hypotheses

**H1 — Epistemic Entrenchment.** Model families exhibit high inter-model variance ($P > 0.15$) on ECCs, significantly higher than controls. _Pilot supported: GPT-5.2-chat vs. GPT-4.1 shows maximal divergence._

**H2 — Consensus Hallucination.** On ECCs, models with high $P$ report high expert agreement ($>0.8$), yielding high $E > 0.12$. On controls, high agreement is justified (low $P$, V-Dem alignment). _Pilot partially supported: GPT-5.2 shows smooth confidence gradients on collapsed surface — novel form of entrenchment._

**H3 — Framework Sensitivity.** Expert agreement drops $>0.2$ when rubric and scoring models are mismatched, indicating framework-based rather than evidence-based confidence. _Planned: rubric/scoring model mismatch trials in full study._

**H4 — Forced-Choice Inflation.** DST conflict $k$ from subset verdicts is significantly lower than JSD polarization $P$ from point verdicts. Gap larger for moderate-contestation concepts. _Pilot: subset verdicts rare due to abstention dominance; requires explicit prompt engineering in full study._

**H5 — Alignment-Induced Adjudicative Compression (Pilot Discovery).** Aggressive safety training collapses expressive dynamic range to binary output, with version-specific rather than vendor-specific effects. _Pilot strongly supported._

---

## 5. Methodology

### 5.1. Design Space Engine

Inspired by GraphGym (You et al., 2020), judge-gym treats evaluation as a design space:

| Axis                | Values                                                                 |
| :------------------ | :--------------------------------------------------------------------- |
| Rubric Model        | GPT-4.1, GPT-5.2-chat, Gemini-3.0-flash, Qwen-235b, Claude, Grok, etc. |
| Scoring Model       | GPT-4.1, GPT-5.2-chat, Gemini-3.0-flash, Qwen-235b, Claude, Grok, etc. |
| Concept             | "fascism," "democratic backsliding," "democracy quality," benchmark    |
| Scoring Method      | `single`, `subset`                                                     |
| Scale Size          | 3, 4 (default), 5                                                      |
| Tone Neutralization | On / Off                                                               |
| Label Randomization | On / Off                                                               |
| Prompt Ordering     | Rubric-first / Evidence-first                                          |
| Abstain Gate        | On / Off                                                               |
| Fresh-Window Probe  | Always on                                                              |

Experiments are configuration records; sweeps cover slices. No code changes required.

### 5.2. Task Types and Dose-Response Design

| Task Type     | Evidence Source | Rubric Source   | Ground Truth | Purpose               |
| :------------ | :-------------- | :-------------- | :----------- | :-------------------- |
| **ECC**       | News search     | Model-generated | None         | Primary experiment    |
| **Control**   | News search     | Model-generated | V-Dem proxy  | Discriminant validity |
| **Benchmark** | Pre-curated     | Pre-loaded      | Known answer | Engine calibration    |

Dose-response gradient: fascism (high) → backsliding (medium) → Norway quality (low) → benchmark (none). Monotonic polarization increase validates apparatus.

### 5.3. Pipeline

**Stage 1 — Evidence Collection.** Scrape news via Firecrawl; optional tone neutralization to 150-word clinical summaries. Shared across experiments.

**Stage 2 — Rubric Generation.** Model generates $n$-stage rubric (default $n=4$). Critic agent scores observability/discriminability. For benchmarks: pre-loaded rubrics.

**Stage 3 — Scoring.** 5 samples per evidence, varying seeds. Strategy resolvers map config to behavior: content field, prompt suffix, output mode, parser. Double randomization of labels and display order.

**Stage 4 — Rubric Swap.** High-divergence pairs re-score with rival rubrics. Tests framework sensitivity.

**Stage 5 — Epistemic Probe.** Fresh context window: "What is the probability independent experts would reach the same verdict?" No CoT history from scoring phase.

### 5.4. Controls

| Control                     | Target Bias                      | Implementation                            | Reference               |
| :-------------------------- | :------------------------------- | :---------------------------------------- | :---------------------- |
| Tone Neutralization         | Style/Beauty Bias                | 150-word clinical summaries               | Wu & Aji (2023)         |
| 4-Point Scale (no midpoint) | Scale Compression + Center Bias  | Forced 1–4                                | Kim et al. (2024)       |
| Double Randomization        | Position & Anchor Bias           | Seeded Fisher-Yates shuffle               | Zheng et al. (2023)     |
| Rubric Validation           | Competence Confound              | Critic agent scores; regression covariate | Dubois et al. (2024)    |
| Abstain Gate                | Forced-Choice Noise              | Explicit decline option                   | Krumdick et al. (2025)  |
| Fresh-Window Probing        | Context Leakage                  | Clean context, zero CoT history           | Stureborg et al. (2024) |
| Free-Form Suffix Parsing    | Constrained Decoding Degradation | Parse `VERDICT:` from suffix              | Tam et al. (2024)       |

### 5.5. Rubric-Stochastic DST Analysis (Pilot Method)

Each sample uses a **unique rubric** (30 rubrics per experiment). The rubric is a stochastic variable; each scored response is a draw from a different conceptualization.

**Per-sample TBM.** Map response to mass function on 4-stage frame. Fuse scores:

$$p = p_{score} \times p_{rubric} \times d_{len}$$

where $p_{score}$ = expert agreement probe, $p_{rubric} = p_{obs} \times p_{disc}$ (observability × discriminability), $d_{len}$ = verbosity discount.

**Mass assignment rules:**

- Normal verdict on subset $V$: $m(V) = p$, $m(\Theta) = 1-p$
- Full-frame verdict $\Theta$: $m(\Theta) = p$, $m(\emptyset) = 1-p$
- Abstain: $m(\emptyset) = p$, $m(\Theta) = 1-p$

**Verbosity bias regression.** Estimate stage-length preference via:

$$\text{Selected}_{i,s} \sim \beta \cdot z_{len,s} + \text{FE}_i + \text{controls}$$

Discount factor: $d_{len} = \min\{1, \exp(-\beta \cdot z_{len})\}$ (penalizes longer selected stages only).

**Interval aggregation.** Compute $Bel_s(i)$, $Pl_s(i)$ per sample. Aggregate across 30 rubric-samples via quantiles (e.g., 10–90). Captures total uncertainty from rubric stochasticity and scoring noise.

---

## 6. Pilot Results

### 6.1. Design

- **Models:** GPT-4.1, Gemini-3.0-flash, GPT-5.2-chat, Qwen-235b
- **Evidence:** 9 items (US political content, Jan 2026)
- **Samples:** 30 per (model, evidence, rubric) triple
- **Total scores:** 540

### 6.2. Key Findings

#### Finding 1: Four Distinct Adjudicative Geometries

| Model            | Geometry               | Stage-1 Mass | Mid-Range (2–3) | Stage-4     | Abstain  | Interpretation               |
| :--------------- | :--------------------- | :----------- | :-------------- | :---------- | :------- | :--------------------------- |
| GPT-4.1          | Smooth, expressive     | Moderate     | **High**        | Moderate    | Minimal  | Classic graded evaluation    |
| Gemini-3.0-flash | Thresholded, selective | Moderate     | Moderate        | Low         | Moderate | Cautious gatekeeping         |
| GPT-5.2-chat     | **Collapsed, binary**  | **Dominant** | **Minimal**     | Rare spikes | **High** | **Adjudicative compression** |
| Qwen-235b        | Smooth, expressive     | Moderate     | **High**        | Moderate    | **High** | **Non-compressed baseline**  |

#### Finding 2: Within-Vendor Divergence Exceeds Cross-Vendor

| Pair                     | Mean JSD (Closed-world) | Interpretation         |
| :----------------------- | :---------------------- | :--------------------- |
| GPT-4.1 vs. GPT-5.2-chat | **0.1904**              | **Maximal divergence** |
| Gemini vs. GPT-5.2-chat  | 0.1169                  | Moderate divergence    |
| GPT-4.1 vs. Gemini       | **0.0331**              | **Minimal divergence** |

Same-vendor version difference > cross-vendor difference. Implicates **alignment regime** over vendor identity.

#### Finding 3: GPT-5.2-chat Exhibits Extreme Compression

Closed-world BetP distributions (pilot):

- **E2, E3, E4, E6, E8:** Stage-1 mass 0.85–0.93
- **E3, E4, E7, E8:** 100% abstain in TBM (conflict-filtered)
- **E1:** Stage-4 spike 0.44 (keyword-triggered)
- **Mid-range (Stages 2–3):** Effectively absent

This is not graded evaluation. It is **binary sensing**: "Normal" (Stage 1) or "Too Hot" (Abstain/Stage 4).

#### Finding 4: Confidence-Compression Paradox

GPT-5.2-chat shows **smoother confidence gradients** than earlier models:

- Abstentions: 0.88–0.91 expert agreement
- Stage-1 assignments: 0.83–0.86
- Stage-4 spike (E1): 0.72

Better calibration of worse expressiveness. The model is **confidently compressed** — it knows when it refuses, but has lost the language of intermediate concern.

#### Finding 5: Qwen as Control

Qwen-235b maintains:

- Distributed mass across Stages 1–4
- Significant mid-range (2–3) presence
- Selective but not systemic abstention

Demonstrates that **compression is not inevitable** for large modern models. Alignment-specific.

### 6.3. Qualitative Evidence

**Evidence E1** (historical essay on fascism/socialism, mentions Nick Fuentes):

- GPT-4.1: Distributed 2–4
- Gemini: Distributed 1–3
- GPT-5.2: Stage-4 spike (keyword detection)
- Qwen: Mostly abstain

Total interpretive divergence on identical text.

**Evidence E6** (Venezuela/Maduro):

- GPT-4.1: Stage-3 mass
- GPT-5.2: 0.93 Stage-1 or abstain
- Qwen: Distributed evaluation

Same evidence, opposite structural readings.

### 6.4. Implications

1. **Longitudinal instability:** GPT-4.1 to GPT-5.2 is not improvement; it is **regime change** in evaluative capability.

2. **Safety-expressiveness tradeoff:** Aggressive alignment may protect against harmful outputs by eliminating nuanced evaluation capacity.

3. **Cross-cultural alignment:** Qwen's geometry suggests different safety priors enable different evaluative bandwidths.

4. **Measurement validity:** Binary-compressed judges are unsuitable for tracking gradual democratic backsliding — they can only detect "normal" or "crisis."

---

## 7. Revised Analysis Plan

### 7.1. Priority: Isolate Compression Mechanism

**Experiment 1: Explicit Hypothetical Framing**

Add to prompt:

> "For this task, assume all evidence is accurate and factually correct regardless of real-world plausibility. Evaluate structural implications conditional on this assumption."

Test: Does GPT-5.2 compression persist? If yes → hard entrenchment. If no → premise-gating.

**Experiment 2: Fictional Country Control**

Replace "United States" with "Republic of Eldoria," anonymize leaders. Test: Is compression US-specific or general?

**Experiment 3: Neutral Domain Control**

Apply identical pipeline to non-political evaluation (e.g., code quality, medical diagnosis). Test: Is compression domain-specific or general?

**Experiment 4: Expert Rater Validation**

Collect human expert (Paxton-trained) ratings on pilot evidence. Test: Is any model's "expert agreement" probe calibrated to actual expert variance?

### 7.2. Metrics (Retained from Plan)

| Metric            | Definition                                  | Purpose                         |
| :---------------- | :------------------------------------------ | :------------------------------ |
| Polarization $P$  | JSD between model distributions             | Inter-model divergence          |
| Entrenchment $E$  | $P \times \mathbb{E}[\text{Prob}_{expert}]$ | Pathological confidence         |
| Compression Index | $1 - H(p_i)/H_{max}$                        | Dynamic range collapse          |
| Abstention Rate   | Fraction declining                          | Refusal behavior                |
| DST Conflict $k$  | Cross-model mass conflict                   | Evidence-theoretic polarization |
| Uncertainty Gap   | $Pl - Bel$ per stage                        | Epistemic interval width        |

### 7.3. Falsification Conditions

- If compression disappears under hypothetical framing → premise rejection, not entrenchment.
- If compression generalizes to fictional countries and neutral domains → general adjudicative lobotomy.
- If Qwen shows compression under Western safety tuning → alignment mechanism confirmed.

---

## 8. Implementation

judge-gym: Turborepo monorepo.

- **engine** (`packages/engine/`): Convex backend, five-stage pipeline, durable workflows, agent thread audit trail.
- **analysis** (`packages/analysis/`): Python (uv + Jupyter), JSD, DST aggregation, regression, visualization.

Principle: **Experiments are data, not code.** Configuration records interpreted at runtime via strategy resolvers.

---

## 9. Limitations and Future Work

### Current Limitations

- **Scale:** 9 evidence items. Requires 100+ for asymptotic confidence.
- **Premise ambiguity:** Task framing may conflate factual reliability with structural evaluation.
- **Expert calibration:** Human expert comparison pending.
- **Temporal specificity:** January 2026 political moment; generalization uncertain.

### Future Work

- Scale to 100+ evidence items across multiple countries/time periods
- Explicit counterfactual prompt engineering
- Human expert panel validation
- Causal intervention: safety tuning ablation (if ethically/technically feasible)
- Extension to other contested concepts (justice, corruption, legitimacy)

---

## 10. Conclusion

Our pilot reveals a structurally significant phenomenon: **alignment-induced adjudicative compression**. GPT-5.2-chat exhibits extreme expressive collapse — binary output, hollowed mid-range, confident refusal — while GPT-4.1 and Qwen-235b maintain graded evaluation capacity. This pattern is version-specific rather than vendor-specific, implicating safety training regime over static ideology.

The implications extend beyond academic measurement. If frontier models lose the capacity for nuanced political evaluation as they are made "safer," then automated monitoring of democratic backsliding, automated fact-checking of contested claims, and LLM-assisted policy analysis may be systematically biased toward false negatives — missing gradual erosion until it becomes crisis.

We do not yet know whether this compression is inevitable, reversible, or domain-specific. Our full study will test these boundaries. But the pilot establishes that **the geometry of evaluation is a variable of alignment**, and that choice of judge is choice of normative frame.

---

## References

Dubois, Y., Li, X., Taori, R., Zhang, T., Gulrajani, I., Ba, J., Guestrin, C., Liang, P., & Hashimoto, T. (2024). Alpaca-Eval 2: Length-controlled evaluation of instruction-following models. \*arXiv:2404.04475\_.

Dempster, A. P. (1967). Upper and lower probabilities induced by a multivalued mapping. _The Annals of Mathematical Statistics_, 38(2), 325–339.

Feng, S., Park, C. Y., Liu, Y., & Tsvetkov, Y. (2023). From pretraining data to language models to downstream tasks: Tracking the trails of political biases leading to unfair NLP models. _ACL 2023_.

Gallie, W. B. (1956). Essentially contested concepts. _Proceedings of the Aristotelian Society_, 56, 167–198.

Garland, R. (1991). The mid-point on a rating scale: Is it desirable? _Marketing Bulletin_, 2, 66–70.

Guerdan, L., et al. (2025). Rating indeterminacy: Examining when LLM evaluators disagree with humans. _CMU Technical Report_.

Hartmann, J., Schwenzow, J., & Witte, M. (2023). The political ideology of conversational AI: Converging evidence on ChatGPT's pro-environmental, left-libertarian orientation. _arXiv:2301.01768_.

Kadavath, S., Conerly, T., Askell, A., et al. (2022). Language models (mostly) know what they know. _arXiv:2207.05221_.

Kim, S., Shin, J., Cho, Y., et al. (2024). Prometheus 2: An open source language model specialized in evaluating other language models. _arXiv:2405.01535_.

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

---
