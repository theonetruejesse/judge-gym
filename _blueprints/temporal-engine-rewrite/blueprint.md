# Blueprint: Judge Gym Temporal Rewrite

> Greenfield rewrite plan for moving judge-gym's execution runtime from a custom Convex-based scheduler/orchestrator to self-hosted Temporal, while keeping Convex as the domain/UI store.
>
> Pass 10 closed the remaining pre-refactor architecture seams. The current state is now post-cutover: Convex remains the product/domain store, Temporal owns live execution for windows and runs, the legacy Convex scheduler substrate has been removed from the live path, and the active remaining work is setup hardening plus contributor/bootstrap simplification rather than core runtime design. Evidence: `k_001`, `k_002`, `k_005`, `k_012`, `k_013`, `k_014`, `k_015`, `k_016`, `k_017`, `k_018`, `k_019`, `k_020`, `k_021`, `k_022`, `k_023`, `k_024`, `k_025`, `k_026`, `k_027`, `k_028`, `k_029`, `k_030`, `k_031`, `k_032`, `k_033`, `k_034`.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite`
- **Research Question:** Design a greenfield rewrite plan for judge-gym that keeps Convex as the domain/UI store, moves execution orchestration to self-hosted Temporal, preserves simple operator controls like create/start window and run processes with `pause_after` and observability, supports agentic continuous monitoring/fix loops similar to `v3-finish-pass`, and identifies which current tables and abstractions should be kept, removed, or replaced.
- **Pass 2 Focus:** explicit Activity idempotency, `llm_requests` business-logic split, workflow/activity breakdown, control-plane semantics, start/projection consistency, observability truth, and runtime/versioning constraints.
- **Pass 3 Focus:** literal control contract, provider-aware LLM attempt ledger, per-flow start handoff matrix, observability truth precedence, replay/versioning workflow, and requirements-based alternatives comparison.
- **Pass 4 Focus:** monorepo package/runtime boundary, settings and policy flow, worker-side execution policy ownership, and runtime-specific tooling boundaries.
- **Pass 5 Focus:** global multi-worker provider quota design, Temporal-native dispatch controls, and the exact boundary between Temporal queue throttling and external shared-bucket enforcement.
- **Pass 6 Focus:** provider capability divergence, provider-portable adapter architecture, and a registry-first design that stays compatible with future providers without committing to every provider-specific implementation in v0.
- **Pass 7 Focus:** minimal v0 capability-registry schema, provider-portable `llm_attempts` envelope, and normalized quota-key generation derived from normalized quota dimensions.
- **Pass 8 Focus:** concrete v0 quota-dimension enum, concrete Redis settlement policy, and explicit tracked-versus-enforced usage split.
- **Pass 9 Focus:** the initial provider-to-dimension mapping table and the provider-aware output reservation policy.
- **Pass 10 Focus:** final control contract, `llm_attempts` schema and retention contract, Convex-to-Temporal worker API boundary, observability projection/read model, and safe deployment/versioning SOP.
- **Current State Focus:** keep this blueprint aligned with the shipped Temporal cutover, Railway-first deployment model, Redis-backed worker quota layer, and the remaining bootstrap/template work.
- **Non-goals:** preserving backward compatibility or migrating in-flight runs.
- **Constraints:** keep the rewrite agent-operable, keep the product model simpler than the current engine, assume self-hosted Temporal, and keep audit/repro guarantees explicit rather than accidental.

### Current Implementation Status Snapshot

**Completed**

- `engine-convex`, `engine-temporal`, and `engine-settings` are the active monorepo split.
- `WindowWorkflow` and `RunWorkflow` are the live execution owners for new windows and runs.
- `llm_attempts`, `llm_attempt_payloads`, and `process_observability` exist in the live Convex model.
- The legacy Convex queue/orchestrator substrate has been pruned from the live path.
- Local `temporal-server` / proxy packages were removed; the active runtime path is Railway-hosted Temporal plus a Railway-hosted worker.
- Contributor setup now has a Railway-first path, repo-root `railway.toml`, repo-root `Dockerfile`, `.env.example`, and dedicated setup/deploy docs.
- Worker quota enforcement is now Redis-backed and intended to use a standard Railway Redis service.

**Still Active**

- Contributor bootstrap is still a two-step infra flow: official Railway Temporal template first, then deploy `engine-temporal-worker` from this repo.
- The next setup simplification is to publish a project-level `judge-gym` Railway template once the current topology stabilizes.
- Provider support beyond the current OpenAI-first interactive path remains follow-up work.

---

## 1. Worldview Register

`worldview.json` remains the registry for assignments, evidence entries, hypotheses, and certainty scores.

- **Foundational pass:** ownership split, package/runtime layout, observability direction, and table split.
- **Pass 2 refinement:** idempotency ledger, workflow/control surface, start/projection boundary, observability strong-truth split, and runtime/versioning pressure.
- **Pass 3 refinement:** control contract, provider-aware ledger fields, per-flow start handoff patterns, observability truth precedence, replay/versioning workflow, and alternatives pressure.
- **Pass 4 refinement:** package graph, config/policy ownership, and the boundary between Convex-side policy storage and worker-side execution enforcement.
- **Pass 5 refinement:** layered global rate-limit design and the remaining boundaries between Temporal-native dispatch control and Redis-backed quota enforcement.
- **Pass 6 refinement:** provider capability registry, adapter layering, and provider-portable quota/caching/tooling abstractions.
- **Pass 7 refinement:** first-class registry fields, first-class attempt-envelope fields, and normalized quota-key vocabulary.
- **Pass 8 refinement:** exact supported quota dimensions, exact settlement modes, and exact v0 operation-surface narrowing.
- **Pass 9 refinement:** explicit provider/model dimension mapping and explicit output reservation semantics per provider quota shape.
- **Pass 10 refinement:** explicit action semantics, explicit audit-ledger shape, explicit worker API boundary, explicit projection schema, and a staged safe-deployment SOP.
- **Artifacts:** `knowledge/`, `hypotheses/`, `null_challenges/`, `certainty/certainty_report.md`

---

## 2. Evidence Ledger

- `k_001`: the current Convex engine already reimplements a workflow runtime with scheduler loops, queue tables, leases, retries, and reconciliation.
- `k_002`: Temporal's workflow/activity/task-queue model fits the missing execution abstraction well.
- `k_003`: self-hosted Temporal can live beside Convex in `packages/engine`, but workers should run under Node, not Bun.
- `k_004`: the original observability split was directionally right but overstated Visibility as a primary control surface.
- `k_005`: the domain/runtime table boundary is sharp enough to support meaningful deletions.
- `k_006`: Convex scheduling guarantees are real, but the workload is a poor fit for keeping execution entirely inside Convex.
- `k_007`: Activities are at-least-once enough that an explicit idempotency contract and external LLM attempt ledger are required.
- `k_008`: the minimal workflow surface should stay small and the control plane should use explicit message semantics rather than vague "pause" abstractions.
- `k_009`: there is no atomic Convex-plus-Temporal start; the rewrite needs an explicit handoff/projection model.
- `k_010`: observability must split discovery, strong truth, and telemetry; Visibility cannot be the sole automation-grade source.
- `k_011`: Temporal remains the strongest default, but Node workers, versioning, and `continue-as-new` need to be first-class design inputs.
- `k_012`: the control plane needs a literal action taxonomy rather than a vague “Signals vs Updates” principle.
- `k_013`: the `llm_attempts` ledger must capture OpenAI chat/batch semantics, retention classes, and replay metadata explicitly.
- `k_014`: start handoff should be chosen per flow through a decision matrix, not by one universal create/start rule.
- `k_015`: observability needs a precedence order: Visibility, Describe, Update receipt, Query, Convex projection, then Axiom.
- `k_016`: replay testing and `continue-as-new` are low-regret defaults, but pinned rollout is conditional rather than free.
- `k_017`: Temporal is the chosen workflow runtime after requirements-based comparison, and alternatives should stay closed unless implementation reveals a concrete blocker.
- `k_018`: settings/config should split into shared defaults, Convex-stored versioned operator policy, and runtime-local secrets/env parsing.
- `k_019`: the rewrite should split the current engine into runtime-specific packages rather than keep a mixed Bun/Node/Convex package.
- `k_020`: provider-facing rate limiting, adapter execution, and Temporal-facing operational tooling should move with the worker runtime.
- `k_021`: multi-worker provider quotas need a layered design: Temporal for dispatch shaping, Redis only for shared request/token buckets that Temporal cannot express.
- `k_022`: OpenAI, Anthropic, and Gemini diverge enough in quota, caching, batch, and tool semantics that the rewrite needs explicit provider capability metadata.
- `k_023`: maintainable multi-provider support depends on a three-layer execution design: core logic, capability registry, and provider adapters.
- `k_024`: the minimal v0 capability registry should normalize identity, operation flags, usage-field mapping, and quota dimensions, while leaving wire formats inside adapters.
- `k_025`: the `llm_attempts` envelope and quota keys should share one normalized provider-portable vocabulary, with provider-specific metadata living under `provider_extensions`.
- `k_026`: v0 should enforce a small supported quota enum, let providers select the subset they actually use, and keep richer usage fields tracked but not independently bucketed.
- `k_027`: a Redis-backed shared-bucket store should be part of v0 from the start, with token buckets, normalized keys, and conservative reservation/reconciliation rules.
- `k_028`: the initial registry snapshot should map OpenAI PAYG to `requests` plus `total_tokens`, Anthropic to `requests` plus split `input_tokens` and `output_tokens`, and Gemini to `requests` plus `input_tokens`, with room for plan-specific overrides like OpenAI Scale Tier.
- `k_029`: v0 output reservation should follow provider-documented quota semantics rather than a generic bounded heuristic: OpenAI PAYG reserves effective output inside `total_tokens`, Anthropic reserves full `max_tokens` into `output_tokens`, and Gemini has no output-side shared-bucket reservation in v0.
- `k_030`: the rewrite needs a literal control contract, with different Temporal primitives and acknowledgement rules per action.
- `k_031`: the `llm_attempts` design should be metadata-first and append-only, with an explicit retention/replay contract and payloads kept out of the main envelope.
- `k_032`: Temporal workers should talk to Convex through a narrow public worker API rather than using Convex internals as an RPC surface.
- `k_033`: the observability projection should stay small and non-authoritative, with Temporal confirmation required before repair actions.
- `k_034`: the rewrite needs a real safe-deployment SOP, but Worker Versioning should be staged rather than treated as an unconditional day-one requirement.

Critical corrections carried forward:

- **No fake atomicity:** Convex and Temporal cannot share a cross-system start transaction. Evidence: `k_009`.
- **No fake exactly-once:** Temporal Activities still require explicit idempotency and external dedupe. Evidence: `k_007`.
- **No Visibility-only automation:** Visibility is for discovery, not the only correctness source. Evidence: `k_010`.
- **No Bun-by-default assumption:** Bun support is experimental; Node stays the production worker default. Evidence: `k_011`.
- **No Update-everywhere assumption:** Updates are for validated or acknowledged actions, not every control write. Evidence: `k_012`.
- **No one-size-fits-all start rule:** create-then-start, with-start, and outbox serve different product contracts. Evidence: `k_014`.
- **No “Describe plus Query” truth tier:** Describe outranks Query for automation-safe execution truth. Evidence: `k_015`.
- **No free pinned-rollout assumption:** replay testing is default; pinned worker rollout is conditional. Evidence: `k_016`.
- **No mixed-runtime package assumption:** the rewrite should not keep one package that owns Bun-friendly scripts, Convex code, and Node-only workers. Evidence: `k_019`.
- **No shared env-reading settings module:** shared code may define schemas/defaults, but env parsing and runtime wiring stay local to Convex and workers. Evidence: `k_018`.
- **No Convex-owned provider throttling in the rewrite:** provider-facing rate limiting belongs with the worker execution plane, even if Convex stays the policy source. Evidence: `k_020`.
- **No Temporal-native-only quota assumption:** queue dispatch caps and worker throttles do not fully replace shared request/input/output token quotas. Evidence: `k_021`.
- **No OpenAI-shaped core assumption:** provider differences in quota dimensions, caching, tool use, and optional batch support belong in capability metadata and adapters, not in workflow conditionals. Evidence: `k_022`, `k_023`.
- **No provider-wire-names-in-core assumption:** registry fields, `llm_attempts`, and quota keys should all derive from normalized dimension IDs and usage mappings, not raw provider field names. Evidence: `k_024`, `k_025`.
- **No split-only token assumption:** the normalized quota vocabulary needs `total_tokens` as well as split `input_tokens` and `output_tokens`, because providers do not all enforce the same token-bucket shape. Evidence: `k_026`, `k_027`.
- **No fake symmetric provider mapping:** the initial registry snapshot must declare provider/model-specific enforced dimensions instead of inventing an output bucket or split token shape for every provider. Evidence: `k_028`.
- **No under-reserving Anthropic output:** the v0 policy should not use a bounded output heuristic below `max_tokens` for Anthropic, because the provider itself estimates OTPM from `max_tokens` at request start. Evidence: `k_029`.
- **No control-by-vibe:** every mutating operator action needs an explicit primitive, acknowledgement rule, idempotency key, and fallback. Evidence: `k_030`.
- **No giant inline attempt rows:** payload bodies must not define the audit contract for `llm_attempts`; hashes, refs, and retention class are the durable baseline. Evidence: `k_031`.
- **No worker use of Convex internals as architecture:** external workers need a narrow stable worker API, not ad hoc internal-function access. Evidence: `k_032`.
- **No projection-as-truth drift:** Convex observability is for ergonomics and triage, while Temporal remains the source for repair decisions. Evidence: `k_033`.
- **No all-or-nothing versioning posture:** replay testing and continue-as-new are minimum v0 requirements; Worker Versioning rollout complexity can be staged. Evidence: `k_034`.

---

## 3. Refined Areas of Analysis

| Area ID | Scope                                                  | Evidence IDs |
| ------- | ------------------------------------------------------ | ------------ |
| `A_05`  | Activity idempotency and LLM audit ledger              | `k_007`      |
| `A_06`  | Workflow/activity breakdown and control semantics      | `k_008`      |
| `A_07`  | Start consistency and Convex projection boundary       | `k_009`      |
| `A_08`  | Observability/control-plane truth split                | `k_010`      |
| `A_09`  | Runtime/versioning constraints and option pressure     | `k_011`      |
| `A_10`  | Action taxonomy and control contract                   | `k_012`      |
| `A_11`  | Provider-aware LLM attempt ledger                      | `k_013`      |
| `A_12`  | Per-flow start handoff matrix                          | `k_014`      |
| `A_13`  | Observability truth stack and projection schema        | `k_015`      |
| `A_14`  | Versioning and replay workflow                         | `k_016`      |
| `A_15`  | Requirements-based alternatives matrix                 | `k_017`      |
| `A_16`  | Settings and config flow                               | `k_018`      |
| `A_17`  | Monorepo package and runtime boundary                  | `k_019`      |
| `A_18`  | Execution policy, rate limiting, and tooling boundary  | `k_020`      |
| `A_19`  | Global provider quota strategy                         | `k_021`      |
| `A_20`  | Provider capability divergence                         | `k_022`      |
| `A_21`  | Provider-portable code architecture                    | `k_023`      |
| `A_22`  | Minimal v0 capability registry schema                  | `k_024`      |
| `A_23`  | `llm_attempts` envelope and normalized quota-key model | `k_025`      |
| `A_24`  | V0 quota-dimension and tracking split                  | `k_026`      |
| `A_25`  | Redis-backed v0 settlement policy                      | `k_027`      |
| `A_26`  | Initial provider-to-dimension mapping                  | `k_028`      |
| `A_27`  | Provider-aware output reservation policy               | `k_029`      |
| `A_28`  | Final control contract                                 | `k_030`      |
| `A_29`  | `llm_attempts` schema and retention contract           | `k_031`      |
| `A_30`  | Convex to Temporal worker API boundary                 | `k_032`      |
| `A_31`  | Observability projection and repair-read model         | `k_033`      |
| `A_32`  | Safe deployment and versioning SOP                     | `k_034`      |

---

## 4. Active Micro-Hypotheses

| Hypothesis ID | Statement                                                                                                                                                                                                                                                                                                                                                                         | Evidence | Confidence |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| `h_A_05_001`  | Keep `llm_prompt_templates` and replace runtime-shaped `llm_requests` behavior with an append-only Convex LLM attempt ledger keyed by Temporal Activity idempotency identifiers.                                                                                                                                                                                                  | `k_007`  | `0.77`     |
| `h_A_06_001`  | Start with exactly two top-level workflows, `RunWorkflow` and `WindowWorkflow`, no child workflows initially, and a mixed control plane where Signals handle fire-and-forget nudges while Updates are reserved for validated or acknowledged actions.                                                                                                                             | `k_008`  | `0.73`     |
| `h_A_07_001`  | Model start/projection consistency as an explicit idempotent handoff problem, with Temporal as execution truth and Convex as projected product state.                                                                                                                                                                                                                             | `k_009`  | `0.78`     |
| `h_A_08_001`  | Use Temporal Visibility and Search Attributes for discovery, stronger per-execution inspection plus a small Convex read model for automation-grade decisions, and Axiom plus Temporal metrics for deep telemetry.                                                                                                                                                                 | `k_010`  | `0.75`     |
| `h_A_09_001`  | Keep Temporal as the default workflow runtime, with Node workers in production, Bun only as an experimental spike, and treat replay safety plus `continue-as-new` as mandatory design inputs while staging heavier Worker Versioning machinery if needed later.                                                                                                                   | `k_011`  | `0.68`     |
| `h_A_10_001`  | Adopt a literal control contract where Updates are used only when validation or acknowledgement matters, Signals remain cheaper best-effort writes, Describe outranks Query for execution truth, and cancel uses Temporal cancellation.                                                                                                                                           | `k_012`  | `0.67`     |
| `h_A_11_001`  | Keep `llm_prompt_templates` and add an append-only `llm_attempts` ledger with provider correlation IDs, usage, and hashes/blob refs for large payloads.                                                                                                                                                                                                                           | `k_013`  | `0.65`     |
| `h_A_12_001`  | Select start handoff patterns per flow using business-keyed workflow IDs and explicit reconciliation states instead of forcing one global create/start rule.                                                                                                                                                                                                                      | `k_014`  | `0.79`     |
| `h_A_13_001`  | The automation truth stack should be `Visibility -> Describe -> Update receipt -> Query -> Convex projection`, with Convex remaining a compact ergonomics mirror only.                                                                                                                                                                                                            | `k_015`  | `0.69`     |
| `h_A_14_001`  | Require replay testing and continue-as-new discipline by default, while making pinned worker rollout conditional rather than universal.                                                                                                                                                                                                                                           | `k_016`  | `0.63`     |
| `h_A_15_001`  | Treat Temporal as the chosen workflow runtime for the rewrite and do not reopen Restate or Inngest unless implementation reveals a concrete blocker.                                                                                                                                                                                                                              | `k_017`  | `0.58`     |
| `h_A_16_001`  | Split configuration into shared schemas/defaults, Convex-stored versioned operator policy that runs/windows snapshot, and runtime-local secrets/env parsing, rather than keeping one `ENGINE_SETTINGS` module imported everywhere.                                                                                                                                                | `k_018`  | `0.73`     |
| `h_A_17_001`  | Split the engine into `engine-settings`, `engine-convex`, and `engine-temporal`, with hard bans on runtime-specific imports inside the shared settings package.                                                                                                                                                                                                                   | `k_019`  | `0.76`     |
| `h_A_18_001`  | Move provider-facing rate limiting, adapter execution, and Temporal-facing operational tooling to the worker runtime, while Convex remains the owner of policy inputs, policy snapshots, and data-facing ledgers.                                                                                                                                                                 | `k_020`  | `0.70`     |
| `h_A_19_001`  | Use a layered rate-limit design: Temporal queue partitioning and queue-level dispatch caps for coarse shaping, worker concurrency for host protection, and Redis-backed shared buckets only for provider/model quotas that require cross-worker request and token accounting.                                                                                                     | `k_021`  | `0.76`     |
| `h_A_20_001`  | Introduce a provider capability registry and provider-specific extension points so the core engine consumes normalized capabilities and quota dimensions instead of baking OpenAI-shaped assumptions into workflows, ledgers, and limiter code.                                                                                                                                   | `k_022`  | `0.78`     |
| `h_A_21_001`  | Inside `engine-temporal`, use a three-layer split of core execution logic, capability registry, and provider adapters, with a generic attempt-ledger envelope plus `provider_extensions` for provider-specific metadata.                                                                                                                                                          | `k_023`  | `0.74`     |
| `h_A_22_001`  | The minimal v0 provider capability registry should normalize only identity, operation flags, usage-field mapping, and quota dimensions, leaving provider wire formats and transport details inside adapters.                                                                                                                                                                      | `k_024`  | `0.77`     |
| `h_A_23_001`  | The rewritten `llm_attempts` ledger and quota keys should share one normalized vocabulary from the capability registry: keep attempt identity, domain linkage, normalized usage, and payload references as first-class fields, and push provider-specific metadata into `provider_extensions`.                                                                                    | `k_025`  | `0.75`     |
| `h_A_24_001`  | The v0 normalized quota-dimension enum should support `requests`, `input_tokens`, `output_tokens`, `total_tokens`, and optional `batch_enqueued_input_tokens`; providers select the subset they enforce, while `cached_input_tokens`, `thinking_tokens`, and `service_tier` remain tracked usage fields.                                                                          | `k_026`  | `0.78`     |
| `h_A_25_001`  | V0 should use Redis-backed token buckets from day one, with normalized quota keys and a conservative settlement policy: `requests=preflight`, `input_tokens=preflight_then_reconcile`, `output_tokens=preflight_then_reconcile`, `total_tokens=preflight_then_reconcile`, and optional `batch_enqueued_input_tokens=preflight_then_reconcile`.                                    | `k_027`  | `0.75`     |
| `h_A_26_001`  | The initial v0 registry snapshot should map OpenAI PAYG interactive models to `requests` plus `total_tokens`, Anthropic interactive models to `requests` plus split `input_tokens` and `output_tokens`, and Gemini interactive models to `requests` plus `input_tokens`, while leaving room for provider-plan overrides such as OpenAI Scale Tier.                                | `k_028`  | `0.79`     |
| `h_A_27_001`  | V0 should use provider-aware output reservation rules instead of one generic bounded heuristic: OpenAI PAYG `total_tokens` reserves estimated input plus the full effective output cap, Anthropic `output_tokens` reserves full `max_tokens`, and Gemini v0 makes no output-side shared-bucket reservation because Gemini's documented quota shape does not require one.          | `k_029`  | `0.78`     |
| `h_A_28_001`  | Judge-gym should implement operator and agent control as an explicit contract: `StartWorkflow` for start, `Update` for acknowledged state changes like `pause_after`, `pause`, `resume`, and bounded repair, workflow cancellation for `cancel`, and Signals only for best-effort nudges, with explicit command ids for every mutating action.                                    | `k_030`  | `0.76`     |
| `h_A_29_001`  | The v0 audit layer should use a metadata-first, append-only `llm_attempts` design split across a compact attempt envelope, a separate payload/blob reference shape, and a quota-audit shape, with `provider_extensions` carrying provider-wire details and first-class columns limited to cross-provider operational needs.                                                       | `k_031`  | `0.81`     |
| `h_A_30_001`  | Temporal workers should talk to Convex only through a small public worker API of idempotent functions that delegate to internal mutations, while `engine-temporal` owns a `ConvexRepo` client wrapper and `engine-settings` remains runtime-pure.                                                                                                                                 | `k_032`  | `0.78`     |
| `h_A_31_001`  | V0 should add a compact Convex `process_observability` projection keyed by `{process_kind, process_id}` that mirrors only linkage, coarse stage/status, pause state, bounded progress, last error summary, and freshness/correlation fields, while the agent loop treats Temporal Visibility as discovery-only and confirms any repair action through stronger Temporal surfaces. | `k_033`  | `0.74`     |
| `h_A_32_001`  | Judge-gym v0 should adopt a safe-deployment SOP where replay tests against recent histories are mandatory for workflow-code changes, `continue-as-new` is a first-class workflow-design input, deterministic workflow changes use TypeScript patching, and Worker Versioning/ramping is treated as a staged operational tier rather than an unconditional day-one requirement.    | `k_034`  | `0.78`     |

Foundational hypotheses from pass 1 remain directionally valid, but the later-pass hypotheses now carry the real implementation pressure.

---

## 5. Null Challenge Summary

Pass 2 falsification did not overturn the rewrite direction, but it narrowed several defaults:

- A strict **Signals-only** control plane is too weak for acknowledged operator actions; Updates should not be excluded by default.
- A Convex attempt ledger is still justified, but only if it stores metadata plus hashes/blob refs by default instead of dumping raw large payloads indiscriminately.
- A **DB-first outbox** is not automatically required for every start path; With-Start APIs may be sufficient for some flows.
- Visibility remains useful but is still too weak to act as the sole correctness oracle for automation.
- Temporal remains the strongest default, but only with Node workers and an explicit versioning policy.

See `null_challenges/nc_pass2_runtime_boundary_and_control_challenge.json`.

Pass 3 falsification tightened the defaults further:

- `DescribeWorkflowExecution` should outrank `Query` in the automation truth stack.
- Pinned worker rollout is conditional, not a free early default.
- The ledger split holds, but blob-retention and replay semantics must be explicit.
- The alternatives question is now closed; Temporal remains the chosen stack unless implementation reveals a concrete blocker.

See `null_challenges/nc_pass3_contracts_and_alternatives_challenge.json`.

Pass 4 falsification kept the new package defaults, but narrowed them:

- A package split is the safer default, not a metaphysical requirement; a disciplined folder split could work, but would leave more boundary rules unenforced.
- A shared config package is only good if it stays pure and never absorbs env parsing or runtime clients.
- Worker-side limiter ownership is right, but cross-worker global quota enforcement is still an open execution detail.
- A dedicated `engine-tools` package is optional in v0; the real non-negotiable split is worker runtime versus Convex runtime.

See `null_challenges/nc_pass4_package_and_policy_boundary_challenge.json`.

Pass 5 falsification sharpened the last major rate-limit question:

- Temporal-native controls are not expressive enough to replace judge-gym's current request-plus-token quota model by themselves.
- A Redis-only answer would be overreach; it would recreate scheduler responsibility outside Temporal.
- Fairness keys are promising, but should not be a hard v0 dependency for provider quota correctness.
- Redis is the right default once multiple workers share strict provider quotas, but it is not mandatory for a constrained single-worker pilot.

See `null_challenges/nc_pass5_global_rate_limit_challenge.json`.

Pass 6 falsification tightened the provider story without widening v0:

- A silent “generic provider interface” is not enough; explicit capability metadata is required.
- Provider portability does not mean over-normalizing every wire shape into one fake universal request format.
- v0 does not need to implement every provider-specific feature, but the architecture must make optional capabilities like batch, caching, tools, and structured outputs discoverable through the registry.

See `null_challenges/nc_pass6_provider_portability_challenge.json`.

Pass 7 falsification turns the provider-portable direction into a stronger schema default:

- The registry should not absorb full provider wire formats or endpoint details.
- The attempt ledger should not promote every provider field to first-class columns.
- Quota keys should not be generated from provider wire names directly.

See `null_challenges/nc_pass7_registry_and_ledger_schema_challenge.json`.

Pass 8 falsification turned the quota design from “reasonable” into “honest”:

- A split-only token enum is not enough; `total_tokens` is required for provider compatibility.
- Cached input and thinking tokens remain important tracked usage, but they still do not justify independent shared-bucket enforcement in v0.
- Redis-backed shared buckets are now the default v0 quota engine, not just a later scalability option.
- Batch quota handling stays architecture-compatible but optional until batch execution itself is in scope.

See `null_challenges/nc_pass8_quota_and_settlement_challenge.json`.

Pass 9 falsification closed the last wide quota-policy gap:

- OpenAI PAYG should not be forced into split input/output token buckets as the default initial mapping; that should stay a plan-specific override case.
- Anthropic should not use a bounded output reservation below `max_tokens`; the documented safe start-of-request estimate is `max_tokens`.
- Gemini should not gain an invented output bucket in the shared limiter just for symmetry.
- A provider-aware mapping and reservation policy is a necessary refinement, not needless complexity.

See `null_challenges/nc_pass9_provider_mapping_and_output_policy_challenge.json`.

Pass 10 falsification closed the remaining “we still need a pass on this” items, but narrowed two of them into staged adoption:

- The control contract passes, but Updates should be treated as the preferred acknowledged primitive only when the deployed Temporal version and worker availability support them reliably; `Update-With-Start` remains banned by default for correctness-sensitive control writes.
- The audit-ledger direction passes, but the blueprint should not hard-require three separate physical tables on day one; the important commitment is metadata-first separation, not a specific table count.
- The worker-boundary direction passes, but auth remains a required explicit design choice and Activity writes must stay on a very small allowlist.
- The observability projection passes only with a hard rule that discovery and ergonomics are separate from repair authority.
- The safe-deployment SOP passes, but Worker Versioning/ramping should be treated as the stronger later tier, while replay testing and continue-as-new remain the minimum v0 baseline.

See `null_challenges/nc_pass10_remaining_pre_refactor_passes_challenge.json`.

---

## 6. Certainty Summary

- **Most grounded pass-3 item:** start handoff matrix (`k_014 = 0.80`), which is now strong enough to guide implementation choices per flow.
- **Most grounded pass-4 item:** the package/runtime split (`k_019 = 0.77`), which is now strong enough to justify turning the current `packages/engine` into runtime-specific packages.
- **Most grounded pass-5 item:** the layered global rate-limit design (`k_021 = 0.76`), which is strong enough to replace the vague “maybe Redis” placeholder with a concrete default.
- **Most grounded pass-6 item:** the provider capability registry direction (`k_022 = 0.78`), which is strong enough to justify reshaping the core execution API around explicit capabilities rather than OpenAI-shaped assumptions.
- **Most grounded pass-7 item:** the minimal registry and attempt-envelope direction (`k_024 = 0.77`, `k_025 = 0.75`), which is strong enough to guide concrete shared-schema work.
- **Most grounded pass-8 item:** the supported quota enum and settlement policy (`k_026 = 0.77`, `k_027 = 0.74`), which are strong enough to replace the remaining vague limiter placeholders with concrete defaults.
- **Most grounded pass-9 item:** the initial provider mapping and output reservation policy (`k_028 = 0.79`, `k_029 = 0.78`), which are strong enough to freeze the first registry snapshot and remove the last broad output-budget ambiguity from v0 quota design.
- **Most grounded pass-10 item:** the audit-ledger shape and the staged control/versioning closure (`k_031 = 0.80`, `k_030 = 0.76`, `k_034 = 0.78`), which are strong enough to stop treating those topics as missing architecture passes.
- **Still weaker than the rest:** observability projection exactness (`k_033 = 0.74`) carries more implementation drift risk than the other finalized defaults, so it should get extra review during coding.
- **Architecture status:** the remaining work is setup hardening, provider expansion, and rollout hygiene, not another research pass.

See `certainty/certainty_report.md`.

---

## 7. Refined Defaults to Carry Into the Rewrite

- **Execution owner:** Temporal is the sole owner of live execution state for new runs and windows. Evidence: `k_002`, `k_009`.
- **Domain owner:** Convex owns experiments, windows, runs, samples, evidence, bundle plans, bundle-plan items, artifacts, and UI-facing projections. Evidence: `k_001`, `k_005`.
- **LLM audit split:** keep `llm_prompt_templates`; replace the runtime parts of `llm_requests` with an append-only `llm_attempts` ledger that stores provider correlation IDs, usage, outcome metadata, and hashes/blob refs for large payloads. Evidence: `k_007`, `k_013`.
- **Minimal workflow surface:** begin with `RunWorkflow` and `WindowWorkflow` only, with bounded fanout and no child workflows initially. Evidence: `k_008`.
- **Control semantics:** use Updates only when validation, acknowledgement, or returned values matter; use Signals for cheaper best-effort writes; use `DescribeWorkflowExecution` as the stronger execution read; use Temporal cancellation for cancel semantics. Evidence: `k_012`, `k_015`.
- **Start boundary:** do not assume atomicity between Convex and Temporal; choose create-then-start, start-then-project, with-start, or outbox per flow, and keep reconciliation states explicit. Evidence: `k_014`.
- **Observability split:** use `Visibility -> Describe -> Update receipt -> Query -> Convex projection -> Axiom` as the truth and telemetry precedence order. Evidence: `k_015`.
- **Runtime/versioning:** run workers on Node in production, treat Bun as a spike path only, require replay testing and continue-as-new discipline, and make pinned worker rollout conditional rather than automatic. Evidence: `k_016`.
- **Alternatives stance:** Temporal is the chosen stack for the rewrite; no further alternatives research is required before implementation unless a concrete blocker appears. Evidence: `k_017`.
- **Package graph:** the active package graph is `engine-settings`, `engine-convex`, and `engine-temporal`, with runtime-specific imports banned from the shared settings package. Evidence: `k_019`.
- **Config flow:** keep shared defaults and schemas pure, store versioned operator policy in Convex, snapshot policy onto runs/windows, and parse secrets locally in each runtime. Evidence: `k_018`.
- **Execution policy boundary:** keep provider adapters, provider-facing rate limiting, and Temporal-facing operational tooling on the worker side, while Convex keeps policy inputs and audit/projection data. Evidence: `k_020`.
- **Global quota strategy:** use Temporal queue partitioning and centralized queue-level dispatch shaping for coarse control, and add Redis-backed shared buckets only for provider/model request and token quotas that must hold across workers. Evidence: `k_021`.
- **Provider portability:** make provider differences explicit through a capability registry and adapter boundary; optional features like batch stay architecture-compatible even if v0 does not implement them for every provider. Evidence: `k_022`, `k_023`.
- **Shared schema direction:** keep the registry minimal and keep `llm_attempts` generic at the top level; let both the attempt ledger and Redis quota keys derive from the same normalized quota vocabulary. Evidence: `k_024`, `k_025`.
- **Quota direction:** support `requests`, `input_tokens`, `output_tokens`, `total_tokens`, and optional `batch_enqueued_input_tokens`; treat `cached_input_tokens`, `thinking_tokens`, and `service_tier` as tracked usage fields, and use Redis-backed token buckets in v0 with conservative settlement rules. Evidence: `k_026`, `k_027`.
- **Initial provider mapping:** start with OpenAI PAYG as `requests + total_tokens`, Anthropic as `requests + input_tokens + output_tokens`, and Gemini as `requests + input_tokens`, with plan-specific overrides added explicitly in the registry instead of hidden in limiter code. Evidence: `k_028`.
- **Output reservation direction:** reserve output according to provider-documented quota semantics rather than one generic heuristic: OpenAI PAYG reserves the full effective output cap inside `total_tokens`, Anthropic reserves full `max_tokens` inside `output_tokens`, and Gemini has no output-side shared-bucket reservation in v0. Evidence: `k_029`.
- **Control contract direction:** use `StartWorkflow` for start, Updates for acknowledged state changes, cancellation for cancel, and Signals only for best-effort nudges; if Updates are not reliably available in the deployed Temporal environment, define an explicit degraded fallback instead of blurring the contract. Evidence: `k_030`.
- **Command envelope direction:** use one shared `ControlCommand` envelope with a caller-generated `cmdId`; reuse `cmdId` as the Temporal `UpdateId` and as the correlation key in Convex projection/audit surfaces. Evidence: `k_030`.
- **Audit-ledger direction:** keep `llm_prompt_templates`, ship `llm_attempts` plus `llm_attempt_payloads` in v0, keep payload bodies out of the main attempt row, and use Convex file storage for payload blobs unless production constraints later justify an object-store move. Evidence: `k_031`.
- **Boundary direction:** make external workers go through a narrow public Convex worker API owned by `engine-convex`, with `engine-temporal` owning the only repo wrapper that can call it. The current implementation does not use worker-secret auth because the active deployment path is Railway worker plus Convex dev/cloud, but the boundary stays intentionally small. Evidence: `k_032`.
- **Projection direction:** keep `process_observability` intentionally small and non-authoritative, with Temporal confirmation required before any automated repair action. Evidence: `k_033`.
- **Deployment direction:** require replay testing and continue-as-new discipline in v0, use patching when workflow code changes are replay-sensitive, and stage Worker Versioning/ramping as the stronger later operational tier rather than a hard day-one requirement. Evidence: `k_034`.
- **Alternatives stance:** Temporal is the chosen stack for the rewrite; no further alternatives research is required before implementation. Evidence: `k_017`.
- **Deployment topology direction:** the active primary dev/runtime path is Railway-hosted Temporal plus Railway-hosted `engine-temporal-worker`; local `bun dev` starts only UI and Convex surfaces. The removed local Temporal packages should not be reintroduced into the default path. Implementation state.

---

## 8. Refined Implementation Plan

### S1: Freeze the Ownership and Table Matrix

- **Objective:** label every existing table/module as `keep`, `delete`, `replace`, or `mirror`.
- **Key decisions:**
  1. Keep domain tables and freeze them as product truth.
  2. Treat `bundle_plans`, `bundle_plan_items`, and `experiments.bundle_plan_id` as product-state tables/fields that survive the rewrite.
  3. Delete runtime queue substrate after cutover: `scheduler_locks`, `llm_jobs`, `llm_batches`, `process_request_targets`.
  4. Keep `llm_prompt_templates`.
  5. Replace `llm_requests` with a deliberate attempt ledger rather than deleting auditability by accident.
- **Verification:** no runtime-shaped table remains unlabeled.
- **Evidence:** `k_005`, `k_007`
- **Current state:** completed in code. Domain tables, `llm_attempts`, `llm_attempt_payloads`, and `process_observability` are live, and the old queue/orchestrator substrate is no longer part of the active runtime path.

### S2: Freeze the Package Graph and Runtime Boundary

- **Objective:** prevent mixed-runtime ambiguity from surviving the rewrite.
- **Key decisions:**
  1. Keep the current split of `engine-settings`, `engine-convex`, and `engine-temporal`.
  2. Ban `engine-settings` from importing `convex/_generated`, `@temporalio/`\*, provider SDKs, env readers, or filesystem/runtime-specific helpers.
  3. Keep the worker package on its own Node-appropriate scripts, tests, and `tsconfig`.
- **Verification:** each runtime package can typecheck and test without pulling transitive runtime code from another owner.
- **Evidence:** `k_019`, `nc_pass4_001`
- **Current state:** completed in code.

### S3: Split Settings Into Defaults, Policy, and Secrets

- **Objective:** preserve reproducibility without creating a shared settings trap.
- **Key decisions:**
  1. Put schemas, defaults, and pure merge logic in shared code only.
  2. Store versioned operator policy in Convex and snapshot a `policy_id` or equivalent onto runs/windows.
  3. Keep env and secret parsing local to the Convex runtime and the Temporal worker runtime.
- **Verification:** no shared package reads `process.env`, and a process started under policy X does not drift when policy Y becomes active later.
- **Evidence:** `k_018`, `nc_pass4_001`

### S4: Move Execution Policy and Tooling to the Worker Side

- **Objective:** make the execution plane own the policies it actually experiences.
- **Key decisions:**
  1. Keep provider adapters and provider-facing rate-limiter enforcement inside `engine-temporal`.
  2. Keep Convex as the owner of policy inputs, policy snapshots, prompt templates, and LLM attempt/audit rows.
  3. Keep Temporal-facing operational scripts inside `engine-temporal` unless a later dedicated tools package is clearly justified.
- **Verification:** no provider-facing limiter remains correctness-critical inside Convex after cutover.
- **Evidence:** `k_020`, `nc_pass4_001`

### S4b: Define the Global Rate-Limit Strategy

- **Objective:** make cross-worker quota correctness explicit instead of treating "Redis maybe" as a placeholder.
- **Key decisions:**
  1. Partition Activity task queues by provider and mode for coarse isolation.
  2. Use centralized Temporal queue-level dispatch caps for whole-queue shaping rather than relying on per-worker option values.
  3. Use worker concurrency and tuner settings for host protection.
  4. Add Redis-backed shared buckets only for quota dimensions that must hold across workers, such as request, input-token, and output-token budgets per provider/model/scope.
  5. Define reservation and reconciliation rules separately for sync chat calls and batch submit/poll flows.
- **Verification:** the design distinguishes queue dispatch control, worker saturation control, and provider-quota correctness without conflating them.
- **Evidence:** `k_021`, `nc_pass5_001`

### S4c: Define the Provider Capability Registry and Adapter Boundary

- **Objective:** keep the core runtime maintainable as new providers are added.
- **Key decisions:**
  1. Define a capability registry schema that expresses sync support, optional batch support, tools, structured output, prompt caching, quota dimensions, and usage-reporting metadata.
  2. Keep core workflow logic provider-agnostic and route provider-specific request/response handling through adapters.
  3. Keep the attempt ledger generic at the top level and reserve `provider_extensions` for provider-specific metadata.
  4. Treat optional capabilities as registry-driven compatibility points, not mandatory v0 implementation scope.
- **Verification:** adding a new provider does not require editing core workflow logic for basic support, and provider-specific metadata does not distort the generic engine schema.
- **Evidence:** `k_022`, `k_023`, `nc_pass6_001`

### S4d: Freeze the Minimal Registry and Attempt Envelope

- **Objective:** make provider portability concrete enough for shared contracts and storage design.
- **Key decisions:**
  1. Define the minimal v0 capability-registry schema: identity, operation flags, usage-field mapping, and quota dimensions only.
  2. Define the top-level `llm_attempts` envelope: identity, domain linkage, provider/model identity, lifecycle, normalized usage, and payload references.
  3. Keep provider-specific metadata in `provider_extensions`.
  4. Generate Redis quota keys from normalized registry dimension IDs rather than provider wire names.
- **Verification:** a new provider can map into the registry, the attempt envelope, and Redis quota keys without changing core workflow code or the top-level attempt schema.
- **Evidence:** `k_024`, `k_025`, `nc_pass7_001`

### S4e: Freeze the V0 Quota Enum and Settlement Policy

- **Objective:** make provider-portable quota enforcement concrete enough to implement without another architecture loop.
- **Key decisions:**
  1. Support normalized dimensions `requests`, `input_tokens`, `output_tokens`, `total_tokens`, and optional `batch_enqueued_input_tokens`.
  2. Treat `cached_input_tokens`, `thinking_tokens`, and `service_tier` as tracked-only fields in v0.
  3. Use Redis-backed token buckets from day one with normalized keys and dimension-specific reservation modes.
  4. Keep ambiguous provider outcomes conservative: no eager refund until reconciliation is resolved.
  5. Keep batch settlement optional until async batch execution is actually in scope.
- **Verification:** provider/model entries can select split or total token dimensions honestly, and the first rollout no longer depends on vague limiter placeholders.
- **Evidence:** `k_026`, `k_027`, `nc_pass8_001`
- **Current state:** implemented in `packages/engine-temporal/src/quota/redis.ts`, with setup now assuming a Railway Redis service for the worker path.

### S4f: Freeze the Initial Provider Mapping and Output Reservation Rules

- **Objective:** turn the normalized quota vocabulary into a concrete first registry snapshot and remove the last broad output-budget ambiguity before implementation.
- **Key decisions:**
  1. Map OpenAI PAYG interactive entries to `requests` and `total_tokens`.
  2. Map Anthropic interactive entries to `requests`, `input_tokens`, and `output_tokens`.
  3. Map Gemini interactive entries to `requests` and `input_tokens`.
  4. Treat plan-specific variants like OpenAI Scale Tier as explicit registry overrides, not implicit runtime guesses.
  5. Reserve full effective output caps for OpenAI PAYG and Anthropic, and keep Gemini output unreserved in the shared limiter until docs or ops require otherwise.
- **Verification:** the first registry snapshot is concrete enough to implement without inventing unsupported provider dimensions or using under-documented output heuristics.
- **Evidence:** `k_028`, `k_029`, `nc_pass9_001`

### S5: Define the Exact Workflow and Activity Inventory

- **Objective:** turn the rewrite into a small, explicit runtime surface.
- **Key decisions:**
  1. `RunWorkflow(runId, controlConfig)` and `WindowWorkflow(windowId, controlConfig)` are the only top-level workflows in v0.
  2. All external I/O becomes Activities: evidence search, provider calls, batch submit/poll, artifact writes, projection writes, telemetry emission.
  3. No child workflows initially; revisit only if history growth or isolation demands it.
  4. Run planning must honor explicit `bundle_plan_id` when present; otherwise it may derive bundling from experiment scoring config as a compatibility fallback.
- **Verification:** every side effect is represented as an Activity, not hidden in Workflow code.
- **Evidence:** `k_002`, `k_008`
- **Current state:** completed in code for the v0 surface. `RunWorkflow` and `WindowWorkflow` are the only live top-level workflows.

### S6: Write the Control Contract Table

- **Objective:** remove ambiguity from `pause_after`, `pause`, `resume`, `cancel`, and bounded repair.
- **Key decisions:**
  1. Use Convex-only create, `StartWorkflow` for start, `Update` for acknowledged state changes, and workflow cancellation for cancel.
  2. Distinguish `startUpdate(..., ACCEPTED)` from `executeUpdate` and reserve Signals for best-effort nudges only.
  3. Standardize one `ControlCommand` envelope with caller-generated `cmdId`, and reuse `cmdId` as the Temporal `UpdateId` plus the audit/projection correlation key.
  4. Define the degraded fallback if Updates are not reliably available in the deployed Temporal environment.
  5. Define `pause_now` as cooperative unless in-flight Activity cancellation is explicitly wired and heartbeating.
- **Verification:** there is a single action table the future agent loop can rely on.
- **Evidence:** `k_030`, `nc_pass10_001`

**ControlCommand Envelope**

| Field         | Type   | Notes                                                                               |
| ------------- | ------ | ----------------------------------------------------------------------------------- | ----------- | -------- | -------- | ---------------- |
| `cmdId`       | string | Caller-generated stable command id. Reused as Temporal `UpdateId` where applicable. |
| `action`      | enum   | `set_pause_after`                                                                   | `pause_now` | `resume` | `cancel` | `repair_bounded` |
| `processKind` | enum   | `run`                                                                               | `window`    |
| `processId`   | string | Convex process id                                                                   |
| `workflowId`  | string | Business-keyed Temporal workflow id                                                 |
| `issuedBy`    | enum   | `user`                                                                              | `agent`     | `system` |
| `issuedAt`    | number | Epoch ms                                                                            |
| `payload`     | object | Action-specific payload                                                             |

**Action Contract**

| Action                         | Primitive                    | Ack mode                     | Idempotency key                          | Success condition                                                         | Fallback                                                                       |
| ------------------------------ | ---------------------------- | ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `create_run` / `create_window` | Convex mutation only         | immediate DB success         | Convex entity id                         | row created                                                               | fail fast                                                                      |
| `start_run` / `start_window`   | `StartWorkflow`              | service start ack            | `workflowId`                             | workflow start accepted by Temporal                                       | if already exists, attach or error by conflict policy                          |
| `set_pause_after(stage)`       | `startUpdate(..., ACCEPTED)` | accepted                     | `cmdId`                                  | workflow persisted the new pause target                                   | if Updates unavailable, fallback Signal with same `cmdId` and no ack guarantee |
| `pause_now`                    | `executeUpdate`              | completed                    | `cmdId`                                  | workflow state marked paused                                              | cooperative pause only; if updates unavailable, do not fake completion         |
| `resume`                       | `executeUpdate`              | completed                    | `cmdId`                                  | workflow state marked running again                                       | if terminal, surface terminal error                                            |
| `cancel`                       | workflow cancellation        | accepted, then poll terminal | `workflowId` plus optional audit `cmdId` | Temporal status becomes terminal canceled/terminated state                | if in-flight Activities ignore cancellation, keep polling Describe             |
| `repair_bounded(op)`           | `executeUpdate`              | completed                    | `cmdId`                                  | workflow accepted bounded repair and returned correlation/result metadata | reject unsafe repairs in validator; no signal fallback for dangerous ops       |

**Pause Semantics**

- `pause_now` means: stop scheduling new stage work after the current safe point.
- It does **not** imply hard interruption of an in-flight Activity unless that Activity is explicitly cancellation-aware and heartbeating.
- `pause_after` is stage-boundary control, not arbitrary instruction-pointer suspension.

### S7: Design the Audit Ledger and Idempotency Contract

- **Objective:** guarantee reproducibility and dedupe under Activity retries.
- **Key decisions:**
  1. Use stable Activity idempotency keys and, where needed, business-operation keys.
  2. Store attempt metadata, provider identifiers, provider correlation IDs, outcome, retry info, normalized usage, retention class, and blob refs/hashes in the durable envelope.
  3. Keep `llm_prompt_templates` as the canonical prompt-definition store.
  4. Ship `llm_attempts` plus `llm_attempt_payloads` in v0; leave a separate quota-event table as a later normalization option if needed.
  5. Keep large payloads out of the main attempt envelope, store payload blobs in Convex file storage, and make the replay contract explicit about what survives payload expiry or redaction.
  6. Keep quota reservation/reconciliation auditable, even if the exact v0 physical normalization stays simpler than a fully separate event table.
- **Verification:** duplicate Activity execution cannot silently create duplicate scientific artifacts.
- **Evidence:** `k_031`, `nc_pass10_001`

`**llm_attempts` Required Fields\*\*

| Field                                                                      | Notes                                         |
| -------------------------------------------------------------------------- | --------------------------------------------- | ---------- | ----------- | --------- | ---------- |
| `attemptId`                                                                | Primary attempt id                            |
| `businessOpKey`                                                            | Stable scientific-operation key               |
| `idempotencyKey`                                                           | Stable dedupe key for Activity retry/re-entry |
| `workflowId` / `workflowRunId`                                             | Temporal linkage                              |
| `activityId` / `activityType` / `activityAttempt`                          | Activity linkage                              |
| `processKind` / `processId`                                                | Domain linkage                                |
| `stageKey` / `operationType`                                               | Stage + operation classification              |
| `providerId` / `modelId` / `providerPlan?`                                 | Provider identity                             |
| `registrySnapshotId`                                                       | Capability/quota snapshot ref                 |
| `providerRequestId?` / `providerResponseId?`                               | First-class provider correlation              |
| `providerBatchId?` / `providerBatchCustomId?` / `providerBatchRequestId?`  | Batch correlation where applicable            |
| `status`                                                                   | `created`                                     | `running`  | `succeeded` | `failed`  | `canceled` |
| `createdAt` / `startedAt?` / `finishedAt?` / `durationMs?`                 | Lifecycle timestamps                          |
| `errorClass?` / `errorCode?` / `errorMessageShort?`                        | Bounded error metadata                        |
| `retryIndex`                                                               | Retry count / attempt number                  |
| `requests?` / `inputTokens?` / `outputTokens?` / `totalTokens?`            | Normalized usage                              |
| `cachedInputTokens?` / `thinkingTokens?` / `serviceTier?`                  | Tracked-only usage                            |
| `estimatedInputTokens?` / `reservedOutputBudget?` / `reservedTotalBudget?` | Reservation metadata                          |
| `reconciled` / `reconciledAt?`                                             | Quota reconciliation status                   |
| `retentionClass`                                                           | `none`                                        | `debug_7d` | `audit_90d` | `forever` | `redacted` |
| `requestPayloadRef?` / `responsePayloadRef?`                               | Blob refs                                     |
| `requestSha256?` / `responseSha256?`                                       | Content hashes                                |
| `payloadExpiresAt?`                                                        | Retention boundary                            |
| `providerExtensions`                                                       | Provider-specific structured metadata         |

`**llm_attempt_payloads` Required Fields\*\*

| Field                           | Notes                     |
| ------------------------------- | ------------------------- | ---------- | -------- | -------------- |
| `attemptId`                     | Parent attempt            |
| `part`                          | `request`                 | `response` | `events` | `error_detail` |
| `storageBackend`                | v0 default: `convex_file` |
| `blobRef`                       | Convex file storage ref   |
| `sha256`                        | Integrity hash            |
| `sizeBytes` / `contentType`     | Payload metadata          |
| `createdAt` / `expiresAt?`      | Retention timestamps      |
| `redacted` / `redactionReason?` | Redaction state           |

**Replay Contract**

- Full replay is available only when render inputs and required prompt context are still retained.
- After payload expiry/redaction, the baseline guarantee is auditability via envelope metadata, hashes, and artifact linkage.
- `llm_prompt_templates` remains the canonical prompt-definition store; `llm_attempts` records concrete rendered executions.
- After payload expiry/redaction, v0 guarantees:
  - hash-level audit of the original payload,
  - re-render eligibility only when the template version, render inputs, and required referenced context are still retained,
  - no promise of byte-identical provider request reconstruction once raw payloads are gone.

**V0 Schema Defaults**

- `operationType` defaults to:
  - `sync_inference`
  - `structured_output`
  - `tool_loop`
  - `async_batch_submit`
  - `async_batch_poll`
- Promote these fields out of `providerExtensions` in v0 because they are operationally useful across more than one provider:
  - `finishReason`
  - `cacheReadInputTokens`
  - `cacheWriteInputTokens`
  - `safetyBlocked`
- Keep provider-wire details, provider-native stop reasons, and request-shape-specific metadata inside `providerExtensions`.

**Policy Snapshot Contract**

- Snapshot these fields into the attempt or process-level execution record for reproducibility:
  - `providerId`
  - `modelId`
  - `providerPlan`
  - `operationType`
  - `temperature?`
  - `topP?`
  - `maxOutputTokens?`
  - `toolChoicePolicy?`
  - `structuredOutputMode?`
  - `quotaPolicySnapshotId`
  - `retryPolicyId`
  - `timeoutPolicyId`
  - `promptTemplateVersionId`
- Treat these as emergency ops overrides that may be logged but are explicitly non-reproducible defaults:
  - temporary worker concurrency caps,
  - temporary queue pause/drain flags,
  - temporary quota throttle multipliers,
  - temporary kill-switch or provider-disable flags.

**Provider Plan Override Shape**

- The registry should support explicit plan-level override entries keyed by:
  - `providerId`
  - `providerPlan`
  - optional `modelMatch`
  - optional `region`
- Each override may replace:
  - enforced quota dimensions,
  - usage-field mapping,
  - reservation policy,
  - queue routing hints,
  - billing/quota profile metadata.
- Example use case: OpenAI PAYG versus OpenAI Scale Tier must be modeled as explicit registry overrides, not inferred ad hoc in worker code.

### S8: Choose the Start/Projection Handoff Pattern

- **Objective:** prevent split-brain between started workflows and projected Convex state.
- **Key decisions:**
  1. Decide per flow whether create-then-start, start-then-project, `Signal-With-Start`, `Update-With-Start`, or DB-first intent/outbox is the right pattern.
  2. Define the reconciliation rules for `row_exists_but_workflow_missing`, `workflow_exists_but_row_missing`, and `workflow_started_but_update_missing`.
  3. Keep outbox narrow enough not to reintroduce a generalized queue substrate.
- **Verification:** every start path has an explicit, documented handoff rule.
- **Evidence:** `k_014`, `nc_pass3_001`

**V0 Start Pattern Defaults**

- `create_run` and `create_window` are Convex-only mutations that allocate the domain id first.
- `start_run` and `start_window` use `create-then-start` with a business-keyed `workflowId` derived from the Convex process id.
- `init_experiment` should be allowed to bind an explicit `bundle_plan_id` up front; bundle-plan creation/linkage remains domain setup, not workflow execution state.
- `with-start` is allowed later for flows that truly need single-call UX, but is not the default v0 pattern.
- DB-first intent/outbox is not part of v0; only introduce it if a concrete flow proves that create-then-start cannot satisfy its consistency or UX contract.
- Reconciliation defaults:
  - `row_exists_but_workflow_missing`: retry start idempotently or surface `not_started`
  - `workflow_exists_but_row_missing`: treat as invariant violation and require operator repair
  - `workflow_started_but_projection_missing`: re-run projection write idempotently
- **Current state:** `create-then-start` is the live path for windows and runs, and the Railway-backed worker path is now the active execution route.

### S9: Build the Two-Layer Observability Model

- **Objective:** support both human and agent monitoring without rebuilding the current scheduler UI.
- **Key decisions:**
  1. Define the Search Attributes used for fleet discovery.
  2. Define the truth precedence order: Visibility, Describe, Update receipt, Query, Convex projection.
  3. Define the exact `process_observability` fields for discovery and triage ergonomics, while explicitly banning the projection from becoming repair authority.
  4. Route Temporal service/worker metrics through Prometheus/Otel Collector into Axiom.
- **Verification:** the system can answer what exists, what is truly stalled, and what safe action comes next.
- **Evidence:** `k_033`, `nc_pass10_001`

`**process_observability` Required Fields\*\*

| Field                  | Notes                                    |
| ---------------------- | ---------------------------------------- | ---------------- | -------- | ------ | -------- |
| `processKind`          | `run`                                    | `window`         |
| `processId`            | Convex process id                        |
| `workflowId`           | Temporal workflow id                     |
| `workflowRunId`        | Current Temporal run id                  |
| `workflowType`         | `RunWorkflow`                            | `WindowWorkflow` |
| `executionStatus`      | Coarse Temporal status mirror            |
| `stage`                | Coarse stage name                        |
| `stageStatus`          | `pending`                                | `running`        | `paused` | `done` | `failed` |
| `pauseAfter?`          | Current pause-after target               |
| `pausedAt?`            | Pause timestamp                          |
| `lastErrorAt?`         | Last error time                          |
| `lastErrorCategory?`   | Retryable/provider/quota/projection/etc. |
| `lastErrorMessage?`    | Short bounded summary                    |
| `lastErrorRef?`        | Attempt/activity/correlation ref         |
| `projectionSeq`        | Monotonic projection sequence            |
| `lastProjectedAt`      | Projection freshness timestamp           |
| `lastControlUpdateId?` | Correlates last control action           |
| `traceRef?`            | Axiom trace or equivalent                |

**Optional Fields**

| Field                    | Notes                    |
| ------------------------ | ------------------------ |
| `progressTotal?`         | Total units of work      |
| `progressDone?`          | Completed units          |
| `progressFailed?`        | Failed units             |
| `progressMeta?`          | Small capped JSON only   |
| `lastTemporalEventTime?` | If cheaply available     |
| `provider?` / `model?`   | Convenience-only mirrors |

**Anti-Staleness Rule**

- Agents may use `process_observability` for discovery and triage only.
- Before any mutating action, agents must confirm with Temporal directly.
- A projection row is considered stale for mutation purposes if:
  - `lastProjectedAt` is older than the configured freshness window, or
  - the relevant control action has no matching acknowledged Temporal receipt.

**V0 Freshness Defaults**

- Active processes (`running`, `paused`, `failing`) should target a freshness window of `30s`.
- Terminal processes may use a relaxed freshness window of `5m`.
- If the projection is stale, automation must fall back to Temporal `Describe` before deciding on repair or control actions.

**V0 Search Attributes**

- Use these Search Attributes for workflow discovery in v0:
  - `process_kind`
  - `process_id`
  - `workflow_type`
  - `execution_status`
  - `stage`
  - `stage_status`
  - `experiment_id?`
  - `run_id?`
  - `window_id?`
  - `provider_id?`
  - `model_id?`
  - `pause_after?`
  - `paused?`
- Keep Search Attributes bounded and discovery-oriented.
- Do not add large or rapidly changing counters to Search Attributes in v0.

**V0 Required vs Optional Cutoff**

- Keep `provider` and `model` optional in `process_observability` for v0.
- Rationale:
  - execution truth and repair do not depend on them,
  - some process states may be pre-provider-selection or multi-provider in the future,
  - they remain useful convenience mirrors without becoming part of the minimal correctness contract.

### S10: Define Runtime and Versioning Policy

- **Objective:** keep rollout safety from becoming a late surprise.
- **Key decisions:**
  1. Node is the production worker runtime.
  2. Bun is validated only through a narrow spike.
  3. Replay testing becomes a required workflow-code gate.
  4. `continue-as-new` becomes a required workflow-design input for long-lived run/window workflows.
  5. Use the minimum safe tier in v0: replay testing, patching discipline, and continue-as-new.
  6. Treat Worker Versioning, ramping, and pinned-vs-auto-upgrade routing as a staged later tier unless early workflows are already long-lived enough to justify that complexity.
- **Verification:** a deployment policy exists before the first long-lived workflow rollout.
- **Evidence:** `k_034`, `nc_pass10_001`

**Minimum Safe Tier (v0)**

- Replay tests required for workflow-code changes.
- `continue-as-new` required for long-lived run/window workflows.
- Use patching when workflow code changes can affect replayed command history.

**Later Tier**

- Worker Versioning rollout ramps.
- Pinned vs auto-upgrade routing.
- More advanced rollout/drain policies for long-lived workflows.

**Patching Rubric**

| Change Type                                                                                                                                  | Requirement                |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Activity-only implementation change                                                                                                          | no workflow patch required |
| Config/default change that does not alter workflow command history                                                                           | no patch required          |
| Workflow logic change affecting command ordering, branching, timers, activity scheduling, child workflow behavior, or message handling order | patch required             |
| New workflow type with no old histories                                                                                                      | no patch required          |

**Worker Versioning Adoption Rule**

- Do not require Worker Versioning in v0.
- Revisit it when either of these becomes true:
  - a typical `RunWorkflow` or `WindowWorkflow` is expected to survive across multiple production deploy windows, or
  - multiple concurrently active worker builds become a normal operational state rather than an exception.

**Tooling Package Default**

- Keep Temporal-facing CLIs and operational scripts inside `engine-temporal` in v0.
- Do not introduce a separate tools package unless the control surface later grows enough to justify it.

**Worker Auth Default**

- The current implementation does not use worker-secret auth.
- Keep the worker API narrow and idempotent; only add explicit worker auth later if the deployment surface becomes broader or multi-tenant enough to require it.

### S11: Record the Runtime Choice

- **Objective:** treat the workflow-runtime decision as closed so implementation can begin.
- **Key decisions:**
  1. Use Temporal as the workflow runtime for the rewrite.
  2. Do not spend more pre-refactor time reopening Restate or Inngest unless implementation reveals a concrete blocker.
  3. Accept Temporal’s operational complexity in exchange for deleting the homemade orchestration substrate.
- **Verification:** the refactor plan no longer depends on another alternatives pass.
- **Evidence:** `k_017`

### S12: Define the Greenfield Cutover

- **Objective:** avoid dual-runtime ambiguity.
- **Key decisions:**
  1. Do not migrate in-flight runs or windows.
  2. Once Temporal v0 is ready, all new executions start there.
  3. Keep old Convex-executed processes readable only.
  4. Delete old runtime tables only after the Temporal path is proven.
- **Verification:** every new execution has exactly one runtime owner.
- **Evidence:** `k_005`, `k_009`
- **Current state:** completed for the active path. New windows and runs launch through Temporal; the old Convex runtime substrate has been removed from the live route.

### S13: Rebuild the Agent Monitoring Loop

- **Objective:** preserve the spirit of `v3-finish-pass` without making agents reason about leases, queue ownership, or orphan scans.
- **Key decisions:**
  1. Reframe the loop around workflow discovery, strong-truth inspection, domain validation, and bounded control actions.
  2. Make the loop ask a small fixed set of questions: what exists, what is truly stalled, what landed, is it scientifically usable, and what safe action is next.
  3. Keep autonomous mutation bounded and explicit.
- **Verification:** the agent loop can be described without referencing the current scheduler substrate.
- **Evidence:** `k_010`

---

## 9. Validation Gates

1. **Ownership Gate:** every table/module is labeled `keep`, `delete`, `replace`, or `mirror`.
2. **Package Boundary Gate:** every runtime module belongs to `engine-settings`, `engine-convex`, or `engine-temporal`, and the shared settings package does not import runtime-specific code.
3. **Config Flow Gate:** shared config code is pure, policy snapshots are explicit, and secrets remain runtime-local.
4. **Execution Policy Gate:** provider-facing rate limiting and adapters live with workers, not Convex.
5. **Global Quota Gate:** the design distinguishes Temporal-native dispatch shaping from Redis-backed shared quota enforcement and justifies each quota dimension explicitly.
6. **Provider Portability Gate:** the capability registry and adapter boundary keep OpenAI-specific semantics out of core workflow logic.
7. **Registry Schema Gate:** the minimal v0 registry contains only fields the core runtime, ledger, and Redis quota layer truly consume.
8. **Quota Enum Gate:** the normalized quota vocabulary supports split and total token providers without forcing tracked-only usage fields into independent buckets.
9. **Provider Mapping Gate:** the initial registry snapshot declares explicit enforced dimensions per provider/model or provider-plan entry instead of assuming fake symmetry.
10. **Reservation Policy Gate:** output reservation follows provider-documented quota semantics and does not under-reserve Anthropic or invent Gemini output pressure.
11. **Minimal Surface Gate:** only `RunWorkflow` and `WindowWorkflow` exist until proven insufficient.
12. **Control Contract Gate:** every operator action has a documented primitive, ack mode, and failure rule.
13. **Ledger Gate:** the `llm_attempts` schema defines provider IDs, normalized usage, payload-retention rules, replay metadata, and extension strategy explicitly.
14. **Idempotency Gate:** every Convex-writing Activity has a stable dedupe strategy.
15. **Start Consistency Gate:** every create/start path has an explicit handoff rule and repair states.
16. **Observability Gate:** the truth precedence order is explicit and Visibility is not treated as the only automation-grade truth source.
17. **Versioning Gate:** replay testing and rollout policy exist before the first serious long-lived workflow launch.
18. **Alternatives Gate:** the Temporal choice is justified against explicit rejection criteria.
19. **Agent Operability Gate:** the monitoring/fix loop does not depend on queue tables, lease state, or orphan scans.

---

## 10. Finalized Defaults

- **Temporal fairness keys:** do not use them in v0. Revisit only if coarse provider/mode queue partitioning proves insufficient under real multi-tenant or hot-partition load.
- **`providerExtensions` promotions:** do not promote additional provider fields in v0 beyond `finishReason`, `cacheReadInputTokens`, `cacheWriteInputTokens`, and `safetyBlocked`. Promote later only when a field is operationally important across at least two providers.
- **With-start / outbox:** no v0 flow requires with-start or DB-first outbox. Default every run/window flow to create-then-start unless a later concrete product contract proves otherwise.
- **`process_observability` mirrors:** keep `provider` and `model` optional in v0.

**V0 Registry Seed Policy**

- Seed the registry with one interactive profile per launched provider family:
  - OpenAI PAYG interactive profile
  - Anthropic interactive profile
  - Gemini interactive profile
- Add explicit plan overrides only where quota or billing semantics differ materially from the base provider profile.
- In practice, the first required override is expected to be an OpenAI Scale Tier entry rather than a generic runtime guess.

**Convergence Note**

- No further architecture research passes are required before implementation.
- Remaining work is implementation: scaffold packages, create schemas/tables/APIs, and translate this blueprint into code.

---

## Appendix: Sources

- `knowledge/k_001_current_engine_execution_shape.md`
- `knowledge/k_002_temporal_runtime_model.md`
- `knowledge/k_003_self_hosted_temporal_engine_layout.md`
- `knowledge/k_004_observability_and_operator_control.md`
- `knowledge/k_005_table_ownership_and_cutover.md`
- `knowledge/k_006_convex_scheduler_tradeoff.md`
- `knowledge/k_007_activity_idempotency_and_audit_ledger.md`
- `knowledge/k_008_workflow_activity_surface_and_control_semantics.md`
- `knowledge/k_009_start_and_projection_consistency.md`
- `knowledge/k_010_observability_truth_and_control_plane.md`
- `knowledge/k_011_runtime_versioning_and_option_pressure.md`
- `knowledge/k_012_control_contract_and_action_taxonomy.md`
- `knowledge/k_013_ledger_schema_and_provider_semantics.md`
- `knowledge/k_014_start_handoff_patterns_decision_matrix.md`
- `knowledge/k_015_observability_truth_stack_and_projection_schema.md`
- `knowledge/k_016_versioning_and_replay_workflow.md`
- `knowledge/k_017_requirements_based_alternatives_matrix.md`
- `knowledge/k_018_settings_and_config_flow.md`
- `knowledge/k_019_monorepo_package_runtime_split.md`
- `knowledge/k_020_execution_policy_and_tooling_boundary.md`
- `knowledge/k_021_global_rate_limit_strategy.md`
- `knowledge/k_022_provider_capability_divergence.md`
- `knowledge/k_023_provider_portable_code_architecture.md`
- `knowledge/k_024_minimal_v0_capability_registry_schema.md`
- `knowledge/k_025_llm_attempt_envelope_and_upstash_key_model.md`
- `knowledge/k_026_v0_quota_dimensions_and_tracking_split.md`
- `knowledge/k_027_upstash_v0_settlement_policy.md`
- `knowledge/k_028_initial_provider_dimension_mapping.md`
- `knowledge/k_029_provider_aware_output_budget_policy.md`
- `knowledge/k_030_control_contract_v0.md`
- `knowledge/k_031_llm_attempts_schema_and_retention.md`
- `knowledge/k_032_convex_temporal_worker_api_boundary.md`
- `knowledge/k_033_process_observability_projection_v2.md`
- `knowledge/k_034_safe_deployment_and_versioning_sop.md`
- `null_challenges/nc_h_A_01_001_challenge.json`
- `null_challenges/nc_h_A_02_001_challenge.json`
- `null_challenges/nc_h_A_03_001_challenge.json`
- `null_challenges/nc_h_A_04_001_challenge.json`
- `null_challenges/nc_pass2_runtime_boundary_and_control_challenge.json`
- `null_challenges/nc_pass3_contracts_and_alternatives_challenge.json`
- `null_challenges/nc_pass4_package_and_policy_boundary_challenge.json`
- `null_challenges/nc_pass5_global_rate_limit_challenge.json`
- `null_challenges/nc_pass6_provider_portability_challenge.json`
- `null_challenges/nc_pass7_registry_and_ledger_schema_challenge.json`
- `null_challenges/nc_pass8_quota_and_settlement_challenge.json`
- `null_challenges/nc_pass9_provider_mapping_and_output_policy_challenge.json`
- `null_challenges/nc_pass10_remaining_pre_refactor_passes_challenge.json`
- `certainty/certainty_report.md`
