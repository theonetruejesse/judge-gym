# Social Science Resource Viability

## Gilardi et al.

- The paper exposes a strong reconstruction surface: task counts, dataset scale, annotation categories, evaluation metrics, model settings, and crowd-worker filters are all described clearly.
- The paper states that the instruction text and codebooks are in the supplement and that the same annotation instructions were used across trained annotators, MTurk, and ChatGPT.
- The main resource risk is data completeness, especially where only tweet IDs can be shared and rehydration may be lossy.
- The other real gap is time drift from the unpinned `gpt-3.5-turbo` API alias, but that does not block a fair protocol-faithful audit.

Recommendation class: `primary`

Certainty: `0.89`

Why not higher:

- the exact contents of the replication bundle still need direct inspection;
- historical API behavior cannot be reproduced exactly.

## Ziems et al.

- The official repo provides a real reconstruction surface with dataset mappings, raw-data loaders, and execution scripts.
- The paper and repo together make subset-level auditing feasible, but they do not define one single compact target; the suite is broad and heterogeneous.
- The main risk is scope creep: a whole-program replication would import too many datasets, model endpoints, and task styles at once.
- This is viable only if V4 chooses a narrow, public, label-oriented subset.

Recommendation class: `primary` for a scoped subset

Certainty: `0.77`

Why not higher:

- certainty depends on pre-selecting a stable subset whose datasets still download cleanly;
- some tasks may rely on brittle sources or generation-style evaluation that is harder to standardize.

## Törnberg

- The paper is more reconstructable than expected: task definitions, sampling rules, and the zero-shot prompt surface are public.
- The official repo appears to include notebooks, country tweet samples, expert and MTurk coding data, and stored LLM outputs.
- The main problem is not obvious materials absence but fairness under baseline time drift: the paper used `gpt-4-0314`, which is now a legacy endpoint.
- Notebook-centric workflows and stored intermediate outputs make the audit feasible, but less clean than the best targets.

Recommendation class: `conditional`

Certainty: `0.71`

Why not higher:

- the materials still need direct completeness checks;
- a strict requirement to replay the original model endpoint would weaken fairness.

## Area Conclusion

`Gilardi` is the clearest immediate resource candidate. `Ziems` is solid only at subset scope. `Törnberg` is real enough to stay on the board, but not clean enough to anchor the launch bundle.
