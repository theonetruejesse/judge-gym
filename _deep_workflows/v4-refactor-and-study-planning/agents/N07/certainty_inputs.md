# Certainty Inputs (N07)

## Evidence Scores

- Repo is OpenAI-centric in settings and runtime today: **0.95**
Rationale: N01 points to provider registry, models list, execution settings, and Temporal transport code being OpenAI-only; this is directly inspectable and unlikely to be a misread.

- Current evidence model is “news window run -> article-shaped evidence” and is too narrow for paper/benchmark imports: **0.90**
Rationale: N01 + N02 identify hard requirements (`window_id`, `window_run_id`, URL/title/markdown assumptions) plus `windows.source_provider = firecrawl`, which is structurally incompatible with imported corpora.

- Generalization pressures are real (paper audits + comparator lane): **0.75**
Rationale: N05’s launch bundle plus N06’s objections expose concrete mismatches (multi-turn/pairwise evidence, codebook coding, benchmark replay). The direction is clear; the exact “minimum viable abstraction” is the uncertain part.

## Recommendation Scores

- Evidence-model direction: move canonical evidence to universe-scoped items with explicit provenance and versioned views (decouple from windows): **0.80**
Rationale: This addresses the main correctness issue (imports are not windows) while preserving windows as a convenience layer (N02). Main risk: “textual by default” becomes a dead-end if MT-Bench-style comparator remains in wave 1 (N06).

- Evidence schema specifics as proposed (Universe + Source + SamplingFrame + ImportJob + Item + ItemView, plus backfill + dual-write): **0.55**
Rationale: Conceptually coherent (N02), but N06 is right that 6 tables plus migration/dual-write is likely the critical path and may crowd out shipping a paper-quality audit. The confidence hit is about sequencing and implementation tax, not about long-run usefulness.

- Provider abstraction direction: capability matrix + provider-owned wire shapes + transport adapter interface: **0.85**
Rationale: This is a standard, defensible boundary that matches observed problems (OpenAI-shaped assumptions in settings/runtime; N01/N03). Even if the exact interface evolves, “capabilities + adapters” is very likely correct.

- Provider rollout claim (Anthropic first, OpenRouter second; direct first, batching later): **0.60**
Rationale: Anthropic-first does “force the abstraction” (N03), but wave-1 feasibility is dominated by cross-cutting persistence/UI/batch artifacts and throughput needs (N06). For a first shipped audit, “one non-OpenAI provider, direct-only, on a subset” is more credible than “all three providers as a core claim.”

- Experiment/prompt-surface direction: separate evidence universe, task family, scoring regime, execution profile, reporting, reproducibility: **0.75**
Rationale: N04’s decomposition matches real coupling problems (rubric-first, l0–l3, stage-fixed assumptions). High confidence on separation-of-concerns; medium confidence on how much needs to land in wave 1.

- StagePlan generalization (fully generic stage runner + new task families like pairwise and prompt replay in wave 1): **0.40**
Rationale: N04 describes the need; N06 is correct that this repo’s current fixed-stage counters/orchestration make “StagePlan” a platform rewrite, not a config tweak. Likely correct long-run, but risky as an early dependency.

- Launch target bundle as written (Gilardi + scoped Ziems + comparator in wave 1): **0.50**
Rationale: Gilardi as primary audit is externally legible and fits “judge as coder” framing (N05). The bundle’s weak link is the comparator lane, which drags in structured/multi-turn evidence and/or StagePlan pressure (N06). If comparator is deferred, the bundle certainty rises substantially.

- Provider expansion as a headline methodological control in the first V4 paper (OpenAI + Anthropic + OpenRouter all required): **0.35**
Rationale: In practice, OpenRouter introduces routing-policy confounds (N06) and Anthropic batching implies cross-cutting refactors (N06/N03). Treating multi-provider as a robustness check (subset + preregistered) is more defensible than making it a core claim in wave 1.

## Phase Scores

- Phase 1 (recommended): Lock wave-1 scope and preregistrations before refactors (paper spine, target bundle, subset rule, perturbations count, provider claim strength): **0.90**
Rationale: This reduces invalidation risk and prevents platform work from being driven by moving study requirements (N05/N06).

- Phase 2 (recommended): Minimal evidence substrate for paper-audit imports with strong invariants (stable external IDs, immutable raw payload, explicit rendered view used per judgment; keep windows intact): **0.70**
Rationale: High likelihood this is necessary; uncertainty is “how minimal can it be” without rework. N06’s warning suggests explicitly cutting/deferring SamplingFrame/ImportJob unless multiple importers demand them.

- Phase 3 (recommended): Minimal experiment surface bridge for paper audits without StagePlan (support imported/frozen/no rubric or codebook, strict output contract, compat/fidelity logging, geometry endpoints where applicable): **0.60**
Rationale: Likely needed for “faithful reconstruction vs perturbation” to be data-driven (N04/N05). Main uncertainty is how far the current fixed-stage runner can stretch before it becomes harder than introducing a lightweight “audit mode.”

- Phase 4 (recommended): Provider scaffold + one non-OpenAI direct-only robustness slice (defer provider-native batching, defer OpenRouter routing policies as a “clean control”): **0.55**
Rationale: The adapter scaffold is high-confidence engineering (N03), but the paper value of cross-provider runs depends on confound control and throughput constraints. Keeping it “direct-only + subset + robustness framing” avoids the batch-artifact persistence blocker (N06).

## Gating Uncertainties (Lowest-Confidence, Should Block Implementation)

- Comparator lane decision: If MT-Bench (or any multi-turn/pairwise benchmark) is truly in wave 1, the evidence contract must support structured payloads (dialogs, A/B responses) and the run/prompt surface must support pairwise or replay; otherwise, comparator should be deferred. (N06)

- Migration tax decision: Whether to implement the full Universe/Source/Frame/ImportJob stack with backfill + dual-write in wave 1 versus a smaller evidence core with explicit invariants. This choice determines whether “engine refactor” becomes the paper’s critical path. (N02/N06)

- StagePlan scope: Whether wave 1 really requires a generic stage runner. If yes, acknowledge it as a platform project with orchestration/counters/UI/analysis impacts; if no, constrain task families to what the fixed pipeline can execute cleanly. (N04/N06)

- Provider batching and batch-artifact persistence: If Anthropic batching is required for wave 1 throughput, schema/UI changes to store provider-specific batch result refs become unavoidable; otherwise, commit to direct-only for non-OpenAI in wave 1. (N03/N06)

- OpenRouter as “provider control”: If OpenRouter is included, routing must be frozen tightly (no fallbacks; conservative parameter requirements) or else it becomes an experimental factor that undermines the provider-control claim. (N03/N06)

- Faithful reconstruction feasibility: Before heavy refactors, verify that required paper artifacts (prompts, codebooks, example IDs, splits, evaluation rules) are actually available for Gilardi and the chosen Ziems subset; otherwise “faithful reconstruction” becomes hand-wavy and collapses the audit protocol claim. (N05/N06)

_deep_workflows/v4-refactor-and-study-planning/agents/N07/certainty_inputs.md

