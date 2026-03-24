# Engine Fit And Fairness Criteria

## Fair Reconstruction Standard

A paper is a fair V4 audit target only if all of the following are substantially true:

- the evidence universe is public or reconstructable with low ambiguity;
- the prompt, rubric, or codebook surface is directly available or tightly inferable from the paper or official artifacts;
- the evaluation protocol is specific enough that a baseline can be reproduced without inventing major hidden steps;
- the `judge-gym` version of the baseline would still be recognizably the original pipeline rather than a new experiment inspired by it.

## Fatal Resource Gaps

Any of these should push certainty down sharply:

- exact evidence items are unavailable and the paper's sample construction materially affects the result;
- the prompt or rubric is not recoverable and must be reverse-engineered from a prose description;
- the result depends on hidden preprocessing, private annotation files, or unshared rubric logic;
- replication would require too much guesswork about label normalization, evaluation filtering, or tie-breaking policy.

## Tolerable Adaptations

These are acceptable if the original pipeline is still legible:

- data distributed as tweet IDs or standard benchmark references rather than raw text;
- modest wrapper code differences when the task specification is otherwise clear;
- porting the task into `judge-gym` primitives so long as the baseline-faithfulness stage is explicit and distinct from the later perturbation stage.

## Engine-Lift Bands

### Low lift

- single-item classification or coding;
- codebook or class-label prompts;
- standard agreement and accuracy metrics;
- repeated sampling as a small extension rather than a structural rewrite.

### Medium lift

- multiple task families under one paper;
- free-form generation mixed with classification;
- more complex aggregation or human-agreement comparisons;
- benchmark or model-output ingestion as first-class evidence items.

### High lift

- pairwise or list-wise judging with order randomization;
- multi-turn benchmark conversations;
- survey or opinion-distribution matching;
- persona conditioning, demographic conditioning, or distributional similarity metrics rather than ordinary labeling.

## Certainty Scoring Rule

Certainty should be interpreted as:

- `0.85 to 1.00`: strong confidence the target can fairly support the recommendation class with current public resources;
- `0.70 to 0.84`: good confidence, but one meaningful uncertainty remains;
- `0.55 to 0.69`: plausible target with visible resource or fairness gaps;
- `0.40 to 0.54`: conditional or expansion-only target; too much uncertainty for a strong recommendation;
- below `0.40`: not currently supportable as a fair V4 target.

## Recommendation Classes

- `primary`: fair to reconstruct now, strong payoff, manageable engine lift.
- `clean comparator`: fair to reconstruct now, but better as a contrast case than as a flagship social-science audit.
- `conditional`: attractive, but blocked by a real resource gap or fairness risk.
- `expansion target`: resources may be good, but the engine-lift cost is large enough that it should follow the launch bundle.
- `support only`: useful for framing or triangulation, not as a main V4 audit.
