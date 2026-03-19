# Measuring Adjudicative Geometry in LLM-as-Judge Evaluation of Contested Political Concepts

## Abstract

This paper studies how large language models behave when they are used as judges over contested political concepts rather than over tasks with a stable ground truth. The central claim is that judge behavior is strongly configuration-sensitive. Changing abstention policy, concept framing, model placement within the pipeline, scale size, evidence representation, or evidence grouping can produce meaningfully different evaluative regimes. To study this, we built `judge-gym`, a design-space engine that turns judge configuration into an experimental surface instead of a hard-coded benchmark pipeline. Across two pilots, we find that the most stable description of model behavior is not a single scalar score but a geometry: abstention rate, scale occupancy, subset breadth, expected stage, stage entropy, and related summaries. The strongest empirical results are that abstention is a real behavioral lever, concept framing is one of the largest movers in the matrix, model placement inside the rubric/scoring pipeline matters, and bundle construction is part of the measurement instrument rather than an irrelevant implementation detail. We also find that unusual judge behavior is not unitary. Some configurations exhibit genuine adjudicative compression, while others produce interior concentration with low abstention and broad mid-scale use. The practical conclusion is that LLM-as-Judge systems for contested concepts should be treated as configurable measurement regimes, not as neutral drop-in evaluators.

## 1. Introduction

LLM-as-Judge systems are attractive because they are cheap, scalable, and easy to integrate into existing evaluation pipelines. In many standard benchmark settings, the working assumption is that evaluator variation is a nuisance around a basically shared task. That assumption becomes weaker once the target of evaluation is a contested political concept such as fascism, illiberal democracy, democratic erosion, or authoritarian populism. In those settings, disagreement is not always error, and the main problem is not simply whether the evaluator is accurate, but what sort of evaluative behavior it systematically produces.

The project described in this paper begins from that observation. We do not ask only whether a model can output a label. We ask what happens when the full judge configuration is varied in a controlled way. Does the model abstain more? Does it collapse to edge states? Does it occupy the middle of the scale? Does it prefer singleton verdicts or broader subsets? Does a change in concept framing or evidence grouping alter the geometry of judgment? These are the questions that matter if the goal is to build a measurement framework rather than a one-off benchmark.

The paper advances a narrow empirical thesis:

> LLM-as-Judge behavior on contested concepts is strongly configuration-sensitive, and that sensitivity is best described in terms of adjudicative geometry rather than a single aggregate score.

This is a design and measurement paper, not a claim that we have solved contested-concept evaluation. The project is still pilot-scale. But the evidence is strong enough to support a change in framing. The right object of study is not "the model as judge" in the abstract. The right object is the configured regime: model family, rubric policy, scoring policy, abstention gate, scale, evidence surface, and bundle plan.

This project sits in the broader LLM-as-Judge literature, but it departs from the most common framing in a specific way. Much of the existing work focuses on evaluator agreement, position bias, verbosity bias, or self-favoring behavior. Those are real concerns, but they are not enough for contested-concept measurement. In this setting, the main problem is not only whether the judge is biased. It is whether different judge configurations produce systematically different evaluative geometries in the first place.

## 2. Problem Setting

Contested concepts are not cleanly reducible to factual lookup. They are appraisive, internally complex, and open to reasonable disagreement. A judge operating over such concepts is not merely retrieving a latent true label. It is performing a structured interpretation under uncertainty, underdetermination, and framing dependence.

That matters for methodology. If the target concept is politically loaded and operationally unstable, then evaluation cannot be reduced to a single forced-choice classification score. The geometry of the response becomes part of the measurement itself. A system that abstains frequently, uses almost no mid-scale states, and produces nearly all singleton verdicts is doing something meaningfully different from a system that occupies the middle of the scale, returns adjacent subsets, and varies its response breadth across evidence. Those differences are not noise to be averaged away. They are part of the phenomenon.

We therefore treat the judge as a configurable measurement regime. The point is not to identify a universally correct geometry. The point is to map the conditions under which different geometries emerge, determine which interventions materially move them, and build a framework in which those movements can be analyzed systematically.

## 3. System Design

`judge-gym` is a design-space engine for LLM-as-Judge evaluation. Experiments are represented as data rather than as one-off scripts. The main configurable axes include:

- rubric model
- scoring model
- concept framing
- scale size
- abstention policy
- evidence representation level
- evidence grouping policy
- scoring method
- randomization and ordering controls

The engine implements a multi-stage pipeline:

1. collect evidence into reusable pools and windows
2. generate rubrics per sample
3. critique rubrics for observability and discriminability
4. score evidence against the rubric
5. critique scores and compute experiment-level summaries

The important design choice is that the engine treats these settings as an experimental matrix. That makes it possible to compare regimes at matched sample grain instead of only at pooled response grain.

## 4. Measurement Framework

The current analysis framework is built around geometry-first summaries. These are the statistics that turned out to be most interpretable and stable across the pilots:

- abstain rate
- singleton rate
- mean subset size
- expected stage
- mid-scale occupancy
- stage entropy
- expert-agreement confidence

These metrics are complemented by several secondary layers:

- matched family deltas with uncertainty estimates
- local semantic rubric embeddings
- aggregation sensitivity panels
- evidence- and sample-level instability summaries

This stack emerged out of the pilots themselves. Earlier versions of the project leaned more heavily on belief-function aggregation. The current evidence suggests a different hierarchy. Geometry-first summaries are the main analytical language. Weighted linear pooling is the most stable global aggregation baseline. DST and TBM remain useful as diagnostic lenses for ambiguity and conflict, but they are not the most reliable headline summary for this use case.

This choice is also methodologically conservative. The existing evaluator literature already suggests that LLM judgment is sensitive to prompt form, label order, verbosity, and other design choices. The geometry-first framework is an attempt to make that sensitivity visible rather than suppress it inside a single scalar endpoint.

## 5. Experimental Program

### 5.1. V2: Prototype Discovery Pilot

The first mature pilot asked a simple question: do different frontier and near-frontier models already exhibit qualitatively different judgment regimes under a common setup? The answer was yes.

Under a shared task configuration, models exhibited distinct patterns of scale use, abstention, and dynamic range. Some models distributed mass broadly through the interior of the scale. Others thresholded more sharply. One regime in particular showed a pronounced collapse toward abstention and early-stage outputs. That first pilot did not yet support strong causal claims, but it did establish that adjudicative geometry was a meaningful object of analysis rather than a cosmetic byproduct.

The main contribution of V2 was therefore discovery. It justified moving from model comparison to matched ablation.

### 5.2. V3: Matched GPT Ablation Pilot

The second pilot was a matched ablation matrix over GPT-family configurations. The original matrix tested abstention, `l3` evidence view, scale size, rubric/scoring model placement, concept framing, smaller/chat variants, and a control condition. A follow-up correction pass repaired the earlier bundle comparisons and added a cleaner clustering panel, high-scale clustered probes, and symmetric small/chat follow-ups.

The final analyzed slice contains thirty-two completed experiments with thirty matched samples each. Four early legacy bundle experiments were excluded from scientific interpretation because their grouping policy was not comparable across models. The resulting matrix is much cleaner than the earlier exploratory state and is strong enough to support a coherent pilot read.

## 6. Results

### 6.1. Abstention Is a Real Behavioral Lever

The abstention toggle is one of the strongest and cleanest interventions in the whole matrix. It changes the operating regime, not just the formatting of the final answer. The effect is especially strong for `gpt-5.2`, but it is visible across the smaller/chat follow-ups as well.

The important implication is that abstention cannot be treated as a cosmetic feature or a nuisance control. It is part of the measurement regime. Turning it on changes how the judge occupies the space of possible verdicts.

### 6.2. Concept Framing Is One of the Largest Movers

The concept swap from fascism to illiberal democracy produces one of the largest matched shifts in the matrix. It changes abstention, subset breadth, and expected stage together. That coherence makes it one of the strongest findings in the current project.

This result matters because it shows that concept framing is not a shallow wording tweak. The choice of conceptual frame is one of the main determinants of evaluative behavior. For contested-concept measurement, concept engineering is not a peripheral concern. It is central.

### 6.3. Model Placement Inside the Pipeline Matters

The rubric/scoring role swap shows that model identity is not the whole story. Which model generates the rubric and which model applies it affects abstention and confidence materially. That means pipeline placement is a first-class experimental axis. The configured pair matters, not just the individual model labels.

### 6.4. Compression Is Real, but It Is Not the Only Non-Smooth Regime

The control condition yields a genuinely compressed regime: very high abstention, almost no mid-scale use, low stage entropy, and near-total singleton behavior. That is a real empirical phenomenon and deserves to be named.

But V3 also shows that not all unusual regimes look like compression. The corrected clustered bundle and high-scale follow-ups reveal a different pattern: low abstention, high interior occupancy, and broader subset use. This is not smooth graded use in the ordinary sense, but it is also not collapse. It is better described as interior concentration.

This distinction is important. Without it, different kinds of non-smooth behavior get flattened into the same story. The pilots now support at least four descriptive geometry types:

- smooth graded use
- thresholded gating
- abstain-heavy compression
- interior concentration

### 6.5. Bundle Construction Is Part of the Instrument

The corrected bundle comparisons are one of the most important methodological results in the project. Changing the grouping policy of the same evidence universe changes abstention, singleton behavior, subset breadth, and belief-function conflict. In other words, clustering is not just a data-preparation detail. It is part of the measurement instrument.

This changes how the project should be interpreted going forward. Evidence bundles cannot be treated as innocent packaging. They are one of the ways the experimental surface is instantiated. If they are not standardized, the comparison surface itself becomes unstable.

### 6.6. `l3` Remains Weaker Than Expected

The expectation going into V3 was that abstracted evidence might materially change the geometry of judgment. In the current matrix, that effect is weaker than expected. Once the corrected clustering surface is in place, `l3` still moves the regime modestly, but it does not move it at the level of abstention, concept framing, or model placement.

This does not mean `l3` is useless. It means it is not a first-order driver in the current setup. It remains worth keeping in the design space, especially for future cross-provider comparisons, but the present evidence does not support treating it as a dominant intervention.

### 6.7. Scale Size Changes Expression More Than Confidence

The move from four to five stages lowers abstention and raises expected stage, especially for `gpt-5.2`. The higher clustered scale probes extend that result. `gpt-4.1` uses the added expressive space more cleanly than `gpt-5.2`. The main pattern, however, is consistent: larger scales mostly change how the model expresses judgment, not how confident it reports itself to be.

This is a useful result because it narrows the interpretation of scale design. Scale size seems to be an expressivity lever more than a certainty lever. That suggests future scale ablations should be tied more tightly to geometry than to calibration claims.

### 6.8. Smaller and Chat Variants Are Not Merely Weaker Copies

The follow-up panel shows that `gpt-4.1-mini` and `gpt-5.2-chat` are not simply reduced-capability versions of the mainline regimes. They occupy distinct geometries. In particular, the clustered bundle follow-up for `gpt-5.2-chat` is one of the stronger positive results in the whole follow-up panel.

This matters for study design. If smaller/chat models are treated only as cheaper proxies, the resulting comparison misses the fact that they may be operating under different behavioral regimes altogether.

### 6.9. Rubric Semantics Matter, but They Are Not the Whole Story

The rubric analysis now includes real local semantic embeddings. The main result is that matched contrasts often retain high full-rubric similarity, while larger differences emerge at the stage level, especially toward the upper part of the scale.

That means many behavioral shifts cannot be explained by wholesale rubric rewrites. A significant share of the action is happening in scoring behavior and evidence interaction. The rubric layer is part of the explanation, but not the whole explanation.

### 6.10. Geometry-First Analysis Is More Stable Than Global Conflict-Heavy Aggregation

Belief-function aggregation is still informative, especially for diagnosing bundle-policy sensitivity and conflict structure. But the pilot now makes the hierarchy clearer. Geometry-first summaries are the most stable and interpretable analytical backbone. Weighted linear pooling is the best behaved global aggregation baseline. Log pooling is sharper but more brittle. Local DST and TBM remain useful as diagnostic ambiguity lenses, not as the main headline summary.

This is not a rejection of belief-function thinking. It is a narrowing of role. For this use case, the main report should be geometry-first. Belief-style aggregation belongs in the sensitivity and robustness layer.

## 7. Interpretation

The most important conceptual result of the pilots is that LLM-as-Judge behavior over contested concepts should be treated as a configurable measurement regime. Once that framing is adopted, several puzzles become easier to interpret.

Why does the same model family sometimes look compressed and sometimes look expressive? Because the model label alone is not the operative object. The operative object is the configured regime. Why do bundle comparisons matter so much? Because the way evidence is grouped changes the measurement instrument itself. Why does concept framing move so much? Because contested concepts are not neutral class names. They shape the evaluative surface the model is asked to inhabit.

The project therefore shifts from a search for the best judge in the abstract to a search for a stable and interpretable measurement framework. That is a more demanding goal, but it is also the only framing that matches the empirical behavior we have observed.

## 8. Limitations

The current evidence remains pilot-scale. The matrix is much cleaner than the earlier exploratory passes, but it is still small relative to the ambition of the framework.

The strongest current claims are about geometry and matched intervention effects, not about human validity or external truth. The project does not yet establish that any given regime is correct. It establishes that regimes differ materially and systematically.

Several important tasks remain incomplete:

- direct certainty analysis by verdict geometry
- motif-level rubric analysis
- broader provider-family comparisons
- stronger case-study treatment of the most unstable samples
- more formal robustness treatment for global aggregation choices

The project is also still concentrated in a narrow provider space. That was acceptable for a pilot designed to stabilize the instrument, but it should not be mistaken for a comprehensive comparative study.

## 9. Toward V4

The next pilot should be narrower in narrative scope and broader in experimental support.

First, the provider family should expand. The current project is strong enough to justify symmetric follow-up panels across additional commercial and open-weight families. The point is no longer to see whether the phenomenon exists. The point is to determine how much of it is regime-specific versus provider-family-specific.

Second, the window and bundle process should be standardized more aggressively. Bundle plans should be first-class measurement objects. Random baselines, semantic clusters, and projected abstraction bundles should be reusable plans defined over a shared evidence universe. That would make matching provable rather than merely plausible.

Third, concept-space exploration should become more explicit. The current concept result is already strong enough to justify treating conceptual engineering as part of the experimental program. A future pass should move from isolated concept swaps to a small engineered family of related successor concepts and test whether some of them induce more stable geometries than inherited political labels do.

Fourth, the analysis stack should continue to formalize its own outputs. Pre-registered primary endpoints, standard multiplicity control, stronger verdict-geometry certainty tables, and a tighter split between report-grade and exploratory figures would make the system more legible and easier to extend.

## 10. Conclusion

The main result of this project is not that one model won a benchmark. The main result is that contested-concept LLM judging is configuration-sensitive in ways that are empirically large, methodologically important, and analytically tractable.

Across the current pilots, several findings now look robust enough to carry forward: abstention is a real behavioral lever, concept framing is one of the strongest movers, model placement matters, compression is real but not universal, and bundle construction is part of the instrument. These findings support a shift in how LLM-as-Judge systems should be studied in politically and conceptually contested settings.

The project is therefore best understood as the construction of a measurement framework. The framework is not finished. But it is far enough along to support a clear conclusion: if contested-concept judging is going to be studied seriously, it has to be studied as a design space, not as a single frozen evaluator.

## References

Dubois, Y., Li, X., Taori, R., Zhang, T., Gulrajani, I., Ba, J., Guestrin, C., Liang, P., & Hashimoto, T. Alpaca-Eval 2: Length-controlled evaluation of instruction-following models.

Gallie, W. B. Essentially contested concepts.

Guerdan, L., et al. Rating indeterminacy: Examining when LLM evaluators disagree with humans.

Kadavath, S., Conerly, T., Askell, A., et al. Language models (mostly) know what they know.

Krumdick, M., Lovering, C., Singh, S., & Hoover, B. No free labels: Limitations of LLM-as-a-judge without human grounding.

Panickssery, A., Bowman, S. R., & Feng, S. LLM evaluators recognize and favor their own generations.

Santurkar, S., Durmus, E., Ladhak, F., Lee, C., Liang, P., & Hashimoto, T. Whose opinions do language models reflect?

Shafer, G. A Mathematical Theory of Evidence.

Shi, Z., Wang, J., Huang, Z., et al. Judging the judges: Evaluating alignment and vulnerabilities in LLMs-as-judges.

Stureborg, R., Alikaniotis, D., & Suhara, Y. Large language models are inconsistent and biased evaluators.

Tam, Z. R., Wu, C., Tsai, Y., et al. Let me speak freely? A study on the impact of format restrictions on performance of large language models.

Wu, M., & Aji, A. F. Style over substance: Evaluation biases for large language models.

Zheng, L., Chiang, W., Sheng, Y., et al. Judging LLM-as-a-judge with MT-Bench and Chatbot Arena.
