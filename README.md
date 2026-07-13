# Judge-Gym

A research engine for treating LLM judges as measurement instruments.

Judge-Gym makes evaluator configuration explicit—model, rubric construction, scale, abstention, evidence representation, sampling, and aggregation—then measures how those choices change the geometry of judgment. The project grew through four pilots from exploratory notebooks into a Temporal-backed evaluation system with frozen evidence sets, matched experimental cohorts, and committed analysis artifacts.

**Completed evidence:** V3 retained 32 controlled cells × 30 matched samples; V4 expanded the promoted native matrix to 20 cells across four OpenAI model variants and 48 evidence items, producing 28,800 item-level scores.

> This repository studies evaluator sensitivity. It does not claim to identify ground truth for contested political concepts or validate any model as the correct judge.

## Start here

- [V3 final results](docs/pilots/v3_final_results.md) — the completed matched-ablation pilot and its scientific caveats
- [V4 native OpenAI report](apps/analysis/_outputs/v4/native_openai_scale/report.md) — the 20-cell, four-model matrix
- [V4 boundary-set design](docs/pilots/v4_native_fascism_boundary_set.md) — acquisition and curation for a frozen 48-item evidence set
- [Agentic engineering retrospective](docs/agentic-engineering-retrospective.md) — campaign state machines, live debugging, bounded recovery, and the Convex → Temporal migration
- [Inspect existing results offline](docs/reproduce_existing_results.md) — use committed reports, tables, and figures without provider credentials or paid calls
- [Incident postmortem](docs/post_mortem.md) — the telemetry contention failure that forced clearer system boundaries

## Research progression

### V1 — distribution exploration

Twelve models generated their own evaluative rubrics and repeatedly scored a small shared evidence set. The pilot exposed large differences in score utilization and self-reported certainty, but left major prompt, evidence, and aggregation confounds uncontrolled.

### V2 — instrument prototype

The project moved from point scores to set-valued verdicts, abstention, critic stages, and geometry-oriented summaries. This established the engine’s core object of study: not a single score, but the distribution of evaluator behavior under a declared configuration.

### V3 — controlled matched ablations

V3 retained **32 completed experiment cells**, each with **30 matched samples**, across 14 reported families. The frozen analysis contract contains 28 registered contrasts and reports all 28 as fully matched through exported signatures. Four earlier bundle cells were excluded because their grouping policies were not scientifically comparable.

The cleanest result was the abstention intervention. For GPT-5.2, enabling abstention changed the aggregate abstention rate by **+0.438** (95% bootstrap CI **0.377–0.497**). Related cells showed that scale size often changed expression and occupancy without clearly changing measured certainty, while evidence grouping changed observed geometry and diagnostic conflict.

See [the final V3 result note](docs/pilots/v3_final_results.md) for exact evidence classes and limitations. In particular, the promoted V3 `a5` contrast does **not** isolate concept framing from model identity and is not presented as a causal concept-framing result.

### V4 — evidence-set-native evaluation

V4 replaced mutable window/pool/bundle inputs with:

1. canonical source records;
2. semantic evidence views;
3. explicitly curated, frozen evidence sets;
4. experiment and run contracts bound to those sets.

The promoted native OpenAI matrix contains:

- 20 experiment cells;
- four model variants;
- 30 matched samples per cell;
- 48 frozen evidence items;
- 28,800 item-level scores.

V4 is both a larger study and an architectural correction: experimental inputs became inspectable, reusable, and versioned independently of the execution machinery.

## System architecture

```text
Media Cloud discovery
        │
        ▼
Convex control plane and storage
  evidence universes → candidates → source records
        │
        ▼
Temporal / Railway execution plane
  acquisition → semantic transforms → run stages
        │
        ▼
Frozen evidence sets
  source_text | l1_cleaned | l2_neutralized | l3_abstracted
        │
        ▼
Experiment cohorts
  rubric_gen → rubric_critic → score_gen → score_critic
        │
        ▼
Committed analysis exports
  reports | CSV tables | JSON contracts | figures
```

### Ownership boundaries

- `apps/engine-convex` — schemas, control-plane APIs, experiment state, bounded operational projections, storage persistence
- `apps/engine-temporal` — durable long-running execution, provider calls, acquisition, and semantic transforms
- `apps/lab` — authoring and inspection for evidence universes, evidence sets, experiments, and runs
- `apps/analysis` — frozen exports, statistical summaries, figures, and reports
- `packages/engine-prompts` — shared prompt and output contracts
- `packages/engine-settings` — shared provider/runtime policy

## Agent-operated engineering campaigns

Judge-Gym’s engineering process became part of the system itself. Campaigns used versioned manifests, explicit state machines, forensic snapshots, bug ledgers, and scientific-validity gates. The live-debug surface exposed process health, stuck-work classification, trace tails, queue state, and deliberately bounded repair controls.

The operating rule was not “heal until green.” One dry-run-first repair could test a recovery hypothesis. If the same failure recurred, the campaign preserved evidence and converted it into a minimal code-level hypothesis, followed by local validation, worker deployment, queue verification, clean reset, and live rerun.

That distinction—technical completion versus scientifically usable evidence—was a first-class campaign invariant. Read the [engineering retrospective](docs/agentic-engineering-retrospective.md) for concrete files, commits, and limitations.

## The Convex → Temporal migration

Convex was a reasonable prototype default: the initial implementation used its Agent, Workflow, and Rate Limiter components while the research pipeline and Lab interface were still being discovered. The boundary changed as experiment-level orchestration moved through an external tracker, a Lab supervisor, provider batch ledgers, and eventually custom scheduler, lease, retry, and reconciliation machinery. At that point Convex was serving as both product store and a distributed execution runtime.

The project postmortem records the sharpest failure of that arrangement: a shared telemetry sequence counter became an optimistic-concurrency hotspot, and retries and reconciliation amplified the workload during an unattended development run.

The remediation was architectural:

- durable workflow execution moved to Temporal;
- Convex remained the control plane and bounded operational projection;
- telemetry moved toward asynchronous Axiom export with a small local mirror;
- live debugging and repair were rewritten around Temporal workflow state;
- provider work ran in a deployable Railway worker.

Temporal did not remove the need for idempotency, cross-system reconciliation, provider quota accounting, bounded callbacks, or campaign stop conditions. V3 became runnable only after those seams were hardened with durable batch identity, paged checkpoints, projection heartbeats, callback-safe resets, worker-version checks, and a manifest-scoped operating contract.

The exact incident totals in the postmortem are repository-authored operational records rather than independently preserved billing exports. The counter removal, telemetry redesign, and execution migration are corroborated by the implementation history.

## Repository map

```text
apps/
  analysis/          committed reports, figures, tables, and analysis code
  engine-convex/     control plane, storage, telemetry projection, debug APIs
  engine-temporal/   durable workflows, activities, provider execution
  lab/               Next.js experiment and evidence-set UI
packages/
  engine-prompts/    prompt and output contracts
  engine-settings/   provider and runtime policy
docs/
  pilots/            study designs, final results, and canonical run manifests
  post_mortem.md     operational incident analysis
_deep_workflows/     structured planning, execution, validation, and synthesis records
_blueprints/         architecture and research contracts
```

## Inspecting the evidence without running the platform

The public artifact is designed to be useful without Convex, Temporal, Railway, Media Cloud, or model-provider credentials. The committed V3/V4 output directories contain the reports, tables, figures, contracts, and summaries used in the writeups.

Follow [the offline inspection guide](docs/reproduce_existing_results.md). Do not run scripts with `--live`, `--start-run`, or `--refresh` unless you explicitly intend to access deployed infrastructure or providers.

## Development validation

Runtime development uses Bun and Python analysis uses `uv`.

```bash
bun install
bun run typecheck
bun run validate:convex
cd apps/engine-temporal && bun run test
```

Targeted Convex tests:

```bash
cd apps/engine-convex
bun run test -- evidence_package evidence_repo worker_idempotency telemetry_observability
```

These checks validate the codebase; they are not required to read the committed research outputs.

## Scope and limitations

- The studies characterize evaluator behavior; they do not establish external truth or human validity.
- V3 is OpenAI-heavy and pilot-scale.
- Matching is validated through exported signatures, not a claim about hidden provider internals.
- Belief-function conflict metrics are diagnostics, not headline endpoints.
- V4’s political evidence sets are narrow, time-bound measurement substrates—not representative samples of all political discourse.
- Some historical campaign artifacts survive in Git history rather than remaining runnable on the current architecture.

## Historical milestones

The repository preserves named milestones for the major architectural eras:

- `v0-convex-baseline`
- `v1-refactor-v2`
- `v2-temporal-baseline`
- `v3-complete`
- `v4-evidence-set-cutover`
- `v4-current`

The disconnected former public history is retained under `archive/public-main-pre-v4` and `legacy-public-main`; the alternative 58-commit refactor side line is retained under `archive/refactor-everything`.

## Status

The experimental campaign is complete for portfolio/research-archive purposes. The repository remains a record of the instrument, the completed V3/V4 studies, and the engineering lessons required to run agent-operated evaluation infrastructure safely.
