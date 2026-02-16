# Certainty Scoring Report

No new evidence was collected; the scores below are based entirely on the existing `_blueprints/simplify` artifacts (knowledge entries, hypothesis files, and blueprint steps).

**Evidence**
| ID | Score | Rationale |
| --- | --- | --- |
| `k_001_evidence` | 0.78 | `ScoringStageConfig` schema plus `experiments_scoring_seed_requests` and `bindExperimentEvidence` all read `sample_count`/`evidence_cap` off `experiment.config`, so the anchor is directly observable in the referenced files. |
| `k_002_evidence` | 0.76 | `bindExperimentEvidence` enforces `evidence_cap` slicing and README wording calls it evidence-freeze, so the freeze behavior is well documented and consistent. |
| `k_003_evidence` | 0.74 | Run creation snapshots `run_policy`/`run_config` via `runs_entrypoints.ts` and `models/runs.ts`, showing counts can live with per-run metadata. |
| `k_004_evidence` | 0.72 | Template, experiment, and signature builders in `configs.ts` and `spec_signature.ts` serialize scoring-stage fields, confirming tight coupling between templates and experiment config. |
| `k_005_evidence` | 0.70 | `experiments_data.ts` recomputes counts from samples/scores, so summaries do not yet rely on stored run-level totals. |
| `k_006_evidence` | 0.70 | Lab editor/detail pages surface and validate `config.scoring_stage.sample_count` and `evidence_cap`, making UI changes mandatory if counts move. |
| `k_007_evidence` | 0.68 | README design-space table and CLI examples list counts as experiment axes, establishing the public contract. |

**Hypotheses**
| ID | Score | Rationale |
| --- | --- | --- |
| `h_A1_001` | 0.72 | No null challenges; schema and flows (see `k_001`) consistently read counts from experiment config, and no run-level overrides surfaced. |
| `h_A2_001` | 0.37 | Null challenge `nc_h_A2_001.json` cites `spec_signature.ts` and UI files as breaking if counts are removed from experiments, so the move cannot proceed without those refactors. |
| `h_A3_001` | 0.62 | Binding remains experiment-scoped (`k_002`); scoring currently reads only `experiment_evidence`, so preserving the set while applying run caps appears feasible. |
| `h_A4_001` | 0.40 | Null challenge `nc_h_A4_001.json` reiterates the same spec-signature/UI blockers as `h_A2_001`, reducing confidence in a minimal migration without broader refactor. |

**Steps**
| ID | Score | Rationale |
| --- | --- | --- |
| `S1` | 0.70 | Enumerating count usages builds off `k_001`, `k_006`, `k_007`, and is an information-gathering step with low implementation risk. |
| `S2` | 0.45 | Deciding the new source of truth hits the spec-signature/UI blockers already cited in `nc_h_A2_001.json`; without resolving those, the experiment identity cannot change so the work is uncertain. |
| `S3` | 0.60 | Run creation already snapshots policy/config (`k_003`), so persisting run counts is achievable if spec signatures are adjusted. |
| `S4` | 0.50 | Evidence binding/scoring touches `k_001`/`k_002`; keeping the frozen set while reading run caps is plausible but requires coordination to avoid per-run slicing mistakes. |
| `S5` | 0.52 | UI/docs already expect experiment-level counts (`k_006`, `k_007`), so updating summaries and README is straightforward but depends on clarified UX for run-level knobs. |
| `S6` | 0.48 | A fallback migration is conceptually clear (`S2` blockers aside), yet dual-source counts introduce ambiguity and demand careful logging/tests, which remain unresolved. |

**Lowest Confidence**
1. Step `S2` — spec signature and Lab UI sensitivities documented in `nc_h_A2_001.json` mean the move of counts is not yet validated. 2. Step `S6` — migration/fallback logic still depends on resolving the same blockers and on clarifying how dual sources are deprecated.
