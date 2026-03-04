# V2 - Engine Prototype Testing

## Key Findings

Under identical task configuration, models exhibit **distinct adjudicative geometries:** systematically different patterns of scale utilization, abstention, and dynamic range.

These differences are robust within this pilot, but causal attribution (e.g., alignment regime, safety heuristics, or architectural factors) remains unresolved.

Several plausible alternative explanations remain:

- Thresholded safety or refusal heuristics
- Normative conservatism under contested framing
- True expressive bandwidth differences
- Evidence distribution artifacts
- Prompt interpretation differences

Therefore, the primary conclusion of this pilot is:

> LLM-as-Judge behavior is configuration- and version-sensitive, and requires systematic calibration before downstream use.

### Finding 1: Four Distinct Adjudicative Geometries

Across models, we observe four qualitatively distinct geometry types:

| Model            | Geometry Type         | Stage-1 Mass | Mid-Range (2–3) | Stage-4     | Abstain  | Summary                    |
| ---------------- | --------------------- | ------------ | --------------- | ----------- | -------- | -------------------------- |
| GPT-4.1          | Smooth / graded       | Moderate     | **High**        | Moderate    | Minimal  | Broad dynamic range        |
| Gemini-3.0-flash | Thresholded           | Moderate     | Moderate        | Low         | Moderate | Selective gating           |
| GPT-5.2-chat     | Collapsed             | **Dominant** | **Minimal**     | Rare spikes | **High** | Reduced scale utilization  |
| Qwen-235b        | Distributed + refusal | Moderate     | **High**        | Moderate    | **High** | Expressive with abstention |

The key distinction is **mid-range occupancy**. GPT‑5.2-chat exhibits near-zero utilization of intermediate stages relative to other models.

We define this operationally as a reduction in effective dynamic range.

### Finding 2: Within-Vendor Can Exceed Cross-Vendor Divergence

Mean Jensen–Shannon divergence (closed-world BetP distributions):

| Pair                      | Mean JSD   | Interpretation              |
| ------------------------- | ---------- | --------------------------- |
| GPT-4.1 vs. GPT-5.2-chat  | **0.1904** | Largest divergence observed |
| Gemini-3 vs. GPT-5.2-chat | 0.1169     | Moderate divergence         |
| GPT-4.1 vs. Gemini-3      | **0.0331** | Minimal divergence          |

Version-level differences within a vendor exceed divergence across vendors.

This suggests that **model version and training regime may influence adjudicative geometry more strongly than vendor identity alone**, though causal mechanisms remain untested.

### Finding 3: Reduced Mid-Scale Utilization in GPT‑5.2-chat

Closed-world BetP distributions show:

- **E2, E3, E4, E6, E8:** Stage‑1 mass between 0.85–0.93
- **E3, E4, E7, E8:** Near-total abstention under TBM conflict filtering
- **E1:** Isolated Stage‑4 spike (0.44)
- **Stages 2–3:** Effectively absent across most evidence

Relative to other models, GPT‑5.2-chat demonstrates:

- Concentration of probability mass in early-stage or abstain states
- Minimal intermediate-scale usage

We refer to this pattern descriptively as **adjudicative compression** — a reduction in effective expressive bandwidth over the rubric scale.

Importantly, this is an observational label, not a causal claim.

### Finding 4: Confidence–Compression Pattern

Despite reduced scale utilization, GPT‑5.2-chat exhibits relatively smooth certainty gradients:

- Abstentions: 0.88–0.91 predicted expert agreement
- Stage‑1 assignments: 0.83–0.86
- Stage‑4 spike (E1): 0.72

This suggests:

- Calibration behavior (certainty reporting) remains structured
- Reduced scale usage does not imply uncertainty collapse

The model appears internally consistent within its chosen operating regime.

### Finding 5: Qwen as Comparative Baseline

Qwen‑235b:

- Maintains broader mid-scale distribution
- Exhibits abstention behavior comparable to GPT‑5.2-chat
- Does not exhibit comparable mid-range collapse

This suggests that high abstention rates alone do not mechanically produce compression-like geometry.

However, controlled ablations are required to determine whether this difference is due to alignment regime, architecture, prompting, or sampling effects.

## Limitations

- **Premise ambiguity:** The task framing may conflate structural conceptual evaluation with factual reliability assessment or knowledge uncertainty. In ad‑hoc testing, GPT‑5.2-chat appears sensitive to the fact that several articles occur after its training cutoff, which may induce refusal or abstention behavior unrelated to conceptual judgment. Reframing the task hypothetically reduces some refusal patterns, suggesting framing sensitivity. This needs to be systematically controlled.
- **Scale:** The study includes 9 evidence items and limited domain breadth. While the qualitative divergence is structurally informative, the sample size is insufficient for strong statistical claims. The central claim — that adjudicative geometries differ meaningfully across models — requires larger-scale replication across domains and time periods.
- **Scaling:** One possible extension is sampling top‑N institutional coverage of a given event (leveraging power-law distribution of media attention) to approximate institutional discourse. However, even a well-calibrated instrument would measure only structured, institutionally mediated signals. It would likely underrepresent bottom‑up, affective, or phenomenological dimensions of contested concepts. Thus, any such signal would remain a proxy for institutional framing, not a comprehensive measure of harm or impact.
- **Rubric Analysis:** No systematic analysis of generated rubrics has yet been conducted. Differences in adjudicative geometry may partially reflect differences in rubric construction rather than scoring behavior alone. Embedding-based clustering or semantic analysis of rubric structure is planned.
- **Planned Ablations:** Results are specific to a January 2026 political context and may not generalize. Critical ablations remain incomplete, including rubric swap, prompt reordering, hypothetical framing, and regression controls for known LLM-as-Judge biases. Architectural improvements to the engine are required before drawing stronger conclusions.
- **DST and TBM Issues:** The current implementation of belief combination and certainty weighting requires further validation. High refusal rates reduce the interpretability of TBM aggregation under conflict filtering. It is possible that prompt structure, certainty elicitation, or aggregation rules are distorting the belief mass signal. The engine rewrite is intended to resolve these concerns before larger sweeps.
- **Governance:** A measurement instrument targeting politically sensitive concepts carries non-trivial misuse risk. Licensing constraints (e.g., OpenRAIL-S) are under consideration, but governance strategy is not finalized. Future pilots may prioritize less affectively charged contested concepts to reduce misuse potential while refining the methodology.
- **No Linear Regression / Length Bias Control:** Length effects were heterogeneous across rubrics, with estimated associations ranging from approximately −0.29 to +0.30. The pooled effect is near zero, masking substantial rubric-level variation. We therefore do **not** apply a global length correction, as any uniform discount could amplify bias where the direction of effect differs. Multiple testing is also a concern (30 rubrics × 3 models = 90 tests; several results would be significant at (p < 0.05) by chance). Future iterations will incorporate multiple-testing correction (e.g., Bonferroni or FDR) and apply direction-sensitive adjustments only where robust rubric-level effects are detected.
- **Expert calibration:** No human expert comparison has yet been conducted. All findings are model-relative and descriptive. Human calibration remains future work.
