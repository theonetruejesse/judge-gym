# V1 - Distribution Exploration

### Experimental Procedure

1. I prompted 12 distinct LLMs to generate an independent 10-point evaluative rubric (0–9) for the concept of "fascism" (our ECC). This served as a pre-registration of each model's internal evaluative framework.
2. Per rubric, the models then evaluated 9 news articles (1/1/26-1/7/26) and outputted its score (0-9) + certainty (0.0-1.0).
3. Sample 30 times per model, then compute final statistics.

### Data

| **Model Name**          | **Score Range** | **Median** | **Mean Cert.** | **Spearman (Std)** | **Cert. Dev. Spearman** | **Jitter** | **Entropy** | **R2** |
| ----------------------- | --------------- | ---------- | -------------- | ------------------ | ----------------------- | ---------- | ----------- | ------ |
| claude-haiku-4.5        | [5, 8]          | 7          | 0.8203         | 0.8958             | -0.8704                 | 0.6299     | 0.3925      | 0.7738 |
| gpt-5.2                 | [2, 4]          | 4          | 0.5350         | 0.4650             | -0.4650                 | 0.4253     | 0.2031      | 0.2041 |
| gpt-4.1                 | [5, 7]          | 6          | 0.8450         | 0.1616             | 0.1934                  | 0.4368     | 0.2955      | 0.0182 |
| grok-4.1-fast-reasoning | [3, 7]          | 5          | 0.7667         | 0.4273             | 0.2952                  | 0.8874     | 0.4755      | 0.1535 |
| gpt-5.2-chat            | [3, 6]          | 5          | 0.6257         | 0.3075             | 0.0230                  | 0.8138     | 0.4825      | 0.1280 |
| gpt-oss-120b            | [1, 6]          | 4          | 0.7093         | 0.3710             | -0.0890                 | 1.4046     | 0.6745      | 0.1224 |
| qwen3-235b              | [2, 9]          | 7          | 0.8467         | 0.6927             | -0.3580                 | 1.5172     | 0.6745      | 0.5945 |
| claude-sonnet-4.5       | [0, 7]          | 5          | 0.7017         | 0.6085             | -0.0114                 | 1.7402     | 0.6974      | 0.6362 |
| gemini-3-flash          | [4, 8]          | 6          | 0.8100         | 0.3394             | -0.1048                 | 0.9977     | 0.5633      | 0.1057 |
| grok-4.1-fast           | [3, 7]          | 6          | 0.8483         | 0.3260             | 0.0000                  | 0.9609     | 0.5080      | 0.0630 |
| gpt-4.1-mini            | [4, 7]          | 6          | 0.8183         | 0.4020             | 0.0799                  | 0.8713     | 0.5004      | 0.1262 |
| glm-4.7                 | [4, 9]          | 5.5        | 0.8833         | 0.1914             | -0.0304                 | 1.5287     | 0.6974      | 0.0713 |

### Table Annotations

- **Cert. Dev. Spearman:** Correlates certainty with the **absolute distance from the median score**.
  - _Negative:_ Model is most certain at its "default" (median) behavior.
  - _Positive:_ Model is most certain when providing "extreme" outliers.
- **Jitter (Exp. Self Disagreement):** The average absolute difference between any two runs. It represents the expected "point-gap" if you prompted the model twice.
- **Entropy (Normalized Score Entropy):** A Shannon Entropy value scaled 0–1. It measures the unpredictability/randomness of the score distribution regardless of the point distance.
- **Spearman (Std):** Measures the rank-order relationship between score and certainty (does confidence rise linearly with the score?).

# Limitations

This pilot study did not control for known LLM-as-judge biases, which likely influenced the observed score distributions. I’ve identified the following, but still need to more thoroughly read through the literature to understand whether I’m controlling for these properly + identify if I’m missing any setups:

- **Absence of Tone Neutralization (Style Bias):** We used raw news article text. Models may have reacted to the "beauty" or "editorial style" of the writing rather than the underlying evidence.
  - **Statistical Evidence:** The high **\( R^2 \) for claude-haiku-4.5 (0.7738)** and **qwen3-235b (0.5945)** indicates a highly deterministic relationship between text features and scores. Without neutralization, we cannot distinguish if this is a response to ideological content or "Style over Substance."
  - _Reference:_ Wu & Aji (2023) show models prefer "polished" prose; Stureborg et al. (2024) identify style as a major confound in judgment consistency.
- **Lack of Position/Anchor Bias Controls:** We did not shuffle rubric stages or the order of evidence presentation. Models may have an inherent bias toward labels presented first or last.
  - **Statistical Evidence:** High **Pearson correlations (0.8796 for Haiku, 0.7975 for Sonnet 4.5)** suggest models may be anchored to the default numeric ordering (0–9).
  - _Reference:_ Shi et al. (2025) and Zheng et al. (2023) document significant "position bias" where LLM judges favor the first available option.
- **Forced-Choice Inflation:** By requiring a single point-verdict (0–9), we likely conflated genuine ideological divergence with "measurement noise."
  - **Statistical Evidence:** Models like **claude-sonnet-4.5** exhibited high **Jitter (1.7402)** and **Entropy (0.6974)**. These metrics suggest "Forced-Choice Inflation," where models struggle to map ambiguous evidence to a single integer.
  - _Reference:_ Guerdan et al. (2025) demonstrate that "indeterminacy" (disagreement) often disappears when judges are allowed to select response sets (subset verdicts) instead of forced labels.
- **Evidence Length (Verbosity Confound):** We did not control for or regress out the length of the evidence provided to the judges.
  - **Statistical Evidence:** The study lacks the **OLS regression** (`Score ~ Ideology + Length`) required to isolate the "true" quality signal from length-based heuristics.
  - _Reference:_ Dubois et al. (2024) in Alpaca-Eval 2 introduce the practice of measuring confounds like length and regressing them out to find the actual evaluation signal.
- **Context Leakage (Metacognitive Anchoring):** Certainty was elicited in the same context window as the reasoning.
  - **Statistical Evidence:** The **Mean Certainty** scores are paradoxically high (**0.8833 for GLM-4.7**) even when **Jitter is high (1.5287)**. This suggests "Consensus Hallucination."
  - _Reference:_ Kadavath et al. (2022) show that asking models about correctness yields better-calibrated estimates when separated from CoT; Stureborg et al. (2024) warned against internal consistency biases.
- **Unvalidated Rubrics (Competence Confound):** We used model-generated rubrics without a secondary "critic" agent validation.
  - **Statistical Evidence:** The divergence in **Score Ranges** (e.g., **GPT-5.2 [2, 4]** vs **Qwen3 [2, 9]**) may be a result of "unanchored" rubrics.
  - _Reference:_ Kim et al. (2024) showed that anchored rubrics reduce variance; Dubois et al. (2024) recommend regressing out rubric quality to isolate ideological commitments.
- **Structured Output Degradation (Syntax Confound):** We enforced structured output formats (JSON/Regex) during the scoring phase, which can bottleneck model reasoning.
  - **Statistical Evidence:** The high **Jitter (0.9977)** and **Entropy (0.5633)** in **gemini-3-flash**, despite its high **Mean Certainty (0.8100)**, suggests a performance collapse under strict formatting constraints.
  - _Reference:_ Tam et al. (2024) demonstrated that constraining model output to structured formats degrades reasoning performance by 5–10% as the model allocates compute to syntax compliance.
