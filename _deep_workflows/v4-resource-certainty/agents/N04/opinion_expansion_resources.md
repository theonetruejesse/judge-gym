# Opinion Expansion Resource Viability

## Santurkar et al.

- The public artifact surface is strong: the paper is public, the official repo exists, and the task bundle includes model inputs, human responses, and precomputed model runs.
- The core protocol is reconstructable: the paper specifies the Pew ATP source waves, demographic grouping, refusal handling, ordinal mapping, and the main distance metric.
- The main resource-side gap is bundle completeness. If demographic weights or required fields are missing from the released bundle, exact recomputation would require going back to the underlying Pew downloads.
- The more important blocker is engine lift, not materials. A fair audit here is a distributional alignment problem over weighted group references and refusal-aware outputs, not a standard single-item labeling task.
- Live reruns of the original stack are less important than being able to audit against archived runs and a clearly reconstructed evaluation surface.

Recommendation class: `expansion target`

Certainty: `0.86`

Why not higher:

- the released bundle still needs direct inspection for weights and demographic completeness;
- certainty would drop if the intended audit required brittle live HELM or API replay rather than archived-run analysis.

## Area Conclusion

`Santurkar` is a resource-real candidate. It should not be rejected for missing materials. It should be sequenced based on whether V4 wants to take on a higher-lift expansion into survey and opinion auditing.
