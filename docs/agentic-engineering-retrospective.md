# Agentic Engineering at Judge-Gym: An Operational Retrospective

Judge-Gym was not built by asking an agent to generate a repository in one pass. It evolved through a tighter loop: encode an operating contract, expose enough runtime truth for an agent to act, preserve evidence before intervention, make the smallest justified change, and validate the result against both software and research requirements.

This retrospective separates three kinds of claims throughout:

- **Implemented mechanism** describes a repository surface or operating rule that exists in the project history or current code.
- **Operational evidence** describes what the checked-in incident reports, workflow artifacts, or validation reports record. It is not a claim that every later run behaved identically.
- **Retrospective lesson** is our interpretation of that evidence.

That distinction matters. Agentic operation can make a system easier to inspect and repair; it does not make the system autonomous by assertion, nor does a technically completed run automatically produce scientifically usable evidence.

## 0. A reasonable prototype default accumulated too many kinds of ownership

**Implemented mechanism.** Judge-Gym began as a Convex-native research engine. Its initial blueprint and first implementation mounted Convex Agent, Workflow, and Rate Limiter components; Agent threads preserved LLM interactions while retryable workflows executed individual pipeline stages. The first architectural seam appeared when a local Bun tracker subscribed to Convex status and advanced the overall experiment with process-local deduplication. Later iterations moved orchestration among a Lab supervisor, normalized request and batch ledgers, service modules, durable process workflows, scheduler scans, leases, and reconciliation. By the mature Convex era, the backend owned both domain state and a custom distributed execution substrate.

**Operational evidence.** The history records several incompatible ownership models rather than one clean linear implementation: the initial stage workflows, the external experiment tracker, the 95-file domain/platform reset, provider-native submit/poll/finalize flows, and the later scheduler/job/batch runtime. The Temporal architecture audit subsequently catalogued queue tables, locks and leases, retries, reconciliation, and process routing as workflow-runtime responsibilities the application had rebuilt inside Convex.

**Retrospective lesson.** The original choice was not an obvious mistake. A familiar product backend with useful durable primitives was a reasonable way to discover the research and interface before funding a separate infrastructure project. The boundary changed when long-running provider I/O, execution truth, retries, scheduler ownership, telemetry, and agent-operated recovery accumulated beside product state. The lesson is to recognize when incremental fixes are clarifying a prototype and when they are compensating for a missing owner.

## 1. The live-debug surface became a control plane

**Implemented mechanism.** Judge-Gym acquired a narrow, scriptable debug interface rather than relying on ad hoc database inspection. The current `live_debug.ts` wrapper exposes process watch, stuck-work discovery, trace tailing and analysis, execution inspection, Temporal task-queue health, campaign snapshots, and explicit control actions. Mutating actions are named and bounded: pause, resume, cancel, or `repair_bounded` with an allowlisted operation such as reprojection or clearing a pause marker. Calls go through the repository's Convex runner, so operators and agents use the same supported entry point.

The health view combines stage progress, workflow binding, projection freshness, recent errors, and stall signals. This is deliberately a control plane, not a second workflow engine: Convex supplies queryable product state and commands, while Temporal remains the stronger source of execution truth.

**Operational evidence.** V3 campaign procedures named the exact snapshot, reset, start, inspect, queue-health, and control functions to use. Later V4 launch reports record queue-health checks alongside run completion checks; the V4 baseline report, for example, records an eight-run cohort completing with no failures while the run queue remained healthy and without backlog.

**Retrospective lesson.** Agents work best against a small typed operational API. Giving an agent broad shell and database access is not equivalent to giving it a safe control plane. The useful abstraction is: cheap read paths, explicit mutation verbs, correlation identifiers, and a clear authority order for conflicting observations.

## 2. Campaign manifests turned prose missions into state machines

**Implemented mechanism.** The V3 finish pass was encoded as a versioned campaign contract: explicit cohort tags, launch modes, control-plane function names, monitoring policy, validity scope, and machine-readable campaign bookkeeping. The associated skill defined execution/operation states—`preflight_clean`, `healthy_progressing`, `slow_but_progressing`, `stalled_recoverable`, `stalled_unknown`, `forensics_captured`, `patch_required`, `validated`, and `complete`—separately from scientific-validity judgments: `scientifically_valid`, `scientifically_invalid`, and `scientifically_unknown`. A campaign could move from preflight to progress, then either complete or stop for forensics; recurrence after one bounded repair moved it to patch-required rather than back into an unbounded recovery loop. Cohort membership came from the manifest, not a prefix search, while the live experiments table remained the configuration source of truth.

**Operational evidence.** Checked-in campaign and deep-workflow reports use these states to distinguish a clean, launch-ready cohort from a healthy run, a runtime-validation pass, and a scientifically valid completion. The repeatability gate explicitly required a clean reset, all intended experiments present, healthy Temporal queues, and use of the manifest's full launch mode before relaunch.

**Retrospective lesson.** A mission becomes delegable when its states, transitions, and stop conditions are explicit. Prose such as “keep trying until it works” invites unbounded retries and scope drift. A manifest is most useful when it specifies identity and policy without pretending to replace live configuration.

## 3. Forensic snapshots came before repair

**Implemented mechanism.** An unhealthy campaign iteration had to write a snapshot and report before reset or cleanup. Required fields included manifest version, experiment and run identities, launch mode, expected and observed counts, queue readiness, stuck summary, dominant failure domain, validity judgment, repair attempt, patch hypothesis, validation outcome, and commit identity where applicable. In the initial pre-investigation capture, unresolved fields were recorded as `unknown` or `not_attempted`; later iteration reports appended the diagnosis, repair, and validation outcome rather than treating the original evidence capture as if those answers were already known. Only after the initial capture could investigative subagents be started.

**Operational evidence.** The repository retains `_deep_workflows` artifacts with workflow definitions, bootstrap manifests, JSONL traces, execution reports, validation reports, synthesis outputs, and, in some cases, machine-readable comparisons. V4 rerun analysis preserved both a comparison JSON and a human-readable findings report, making later claims traceable to a specific cohort rather than to session memory.

**Retrospective lesson.** State deletion is an evidentiary act. Resetting first may restore service while destroying the facts needed to explain the failure. Agents are especially prone to context loss across sessions, so durable snapshots are not clerical overhead; they are the handoff boundary between operation, diagnosis, and review.

## 4. Repair was one-shot and bounded

**Implemented mechanism.** The V3 loop allowed at most one safe-heal pass after a recoverable stall. In the Temporal-native version, repair was restricted to a small allowlist: reproject a snapshot, resume if paused, clear a pause boundary, or perform an explicit resume. Cancellation was reserved for already-invalid cohorts and only after forensics. If the bounded action did not restore health, the pass stopped for diagnosis and a minimal patch.

**Operational evidence.** The finish-pass procedure says directly that safe-heal is diagnostic evidence, not steady-state operation. Stability reports also rejected broad speculative refactors: they separated cleanup noise from runtime validation and kept follow-up patches trigger-based unless a blocker recurred.

**Retrospective lesson.** An agent should not be rewarded for keeping a sick system alive through repeated nudges. One bounded repair can test a hypothesis. Repeated repair obscures the defect, changes the experimental conditions, and creates an unofficial scheduler outside the engine.

## 5. Agents had to own the logs they depended on

**Implemented mechanism.** Repository guidance requires an agent investigating local Convex errors to own the root `bun dev` process in stream mode. That keeps Turbo and Convex output in the same execution context as the debugging decisions, instead of behind a user-owned TUI or a detached process. Deep-workflow execution reports record when this bootstrap was used.

**Operational evidence.** A V3 stability investigation records recurring projection callback failures observed in both platform failure logs and an agent-owned `bun dev` session. The infra-hardening execution report likewise records that the agent-owned root process kept the development deployment synchronized during its smoke/debug loop.

**Retrospective lesson.** Log access is part of task ownership. If the agent cannot see the process it is changing, it will substitute stale projections or guesses for runtime evidence. Conversely, owning a log stream does not confer authority to mutate production; observation and control should remain separate capabilities.

## 6. Scientific validity was a separate gate

**Implemented mechanism.** The campaign model distinguished `scientifically_valid`, `scientifically_invalid`, and `scientifically_unknown` from runtime status. A run could be runtime-complete while remaining scientifically unknown. Runtime completion alone could not authorize synthesis or publication: invalid and unknown results stayed retained for diagnosis and analysis but blocked from promoted claims until the campaign's scientific-validity review promoted them to `scientifically_valid`. Launch contracts also froze cohort membership, evidence sets, experiment tags, and expected counts; V4 launch tooling later made experiment-tag conflicts fail fast rather than silently reusing an experiment row.

**Operational evidence.** The first V4 baseline launch completed operationally, but exposed a lineage defect: a Zheng canary and baseline shared an experiment tag, causing reuse of the canary experiment row. The result was retained with an explicit limitation and the launcher was hardened. Later GPT-4.1 reruns showed why this distinction matters at the result level: two conditions reproduced exactly, two had one item flip each, and a first-pass Zheng abstention difference did not survive as a stable regime effect.

**Retrospective lesson.** “Completed with zero failures” is an infrastructure statement. It is not a scientific conclusion. Agent-run experiments need gates for provenance, frozen inputs, cohort identity, parser behavior, repeatability, and interpretation—and they need permission to conclude that a result is noisy or unknown.

## 7. The Convex incident changed the operating model

**Implemented mechanism.** After a development-only runaway event on March 2, 2026, the telemetry write path was redesigned to remove a shared per-trace counter hotspot. Event ordering moved to sortable timestamp-and-entropy values, hot request paths gained deferred telemetry handling, scheduler loops and retries were bounded, and active-run deletion required explicit override. Snapshot-backed health and safer healing tools were added to incident handling.

**Operational evidence.** The incident report records approximately 2.2 million function calls, 149 GB of database storage, and 424–454 GB of database bandwidth in the development deployment, with no production impact. Its root-cause analysis identifies optimistic-concurrency conflicts on the shared telemetry counter as the primary hotspot, amplified by orchestration retries and an observability gap. Post-fix validation recorded clean typechecking, progressing concurrent canaries, and no new burst of the same counter-conflict failures.

**Retrospective lesson.** Observability can participate in the failure it is meant to explain. Transactional telemetry on a hot path must be designed as production load, not as free metadata. More broadly, unattended agent operation requires hard bounds in the engine; a prompt-level instruction to “be careful” is not a scheduler safeguard. We report resource impact here because it is documented, but do not infer or publish an exact monetary cost from it.

## 8. Axiom became optional depth, not operational authority

**Implemented mechanism.** Telemetry storage was migrated toward Axiom while retaining a compact `process_observability` mirror in Convex. Mutations write the local operational projection and can export structured events asynchronously. Process health can therefore answer common questions without making Axiom availability a prerequisite. The architecture treats Axiom as optional structured logging/tracing; repair decisions require stronger execution confirmation rather than an external trace alone.

**Operational evidence.** The migration commit is explicitly titled “Move telemetry storage to Axiom with local observability mirror,” and the architecture documentation records both the asynchronous export and local query path. Temporal-hardening notes subsequently identified the design constraint clearly: the system must remain debuggable when Axiom is unavailable.

**Retrospective lesson.** External telemetry is valuable for depth and retention, but an agent's minimum safe control loop should not depend on a third-party search service. Keep a bounded local projection for discovery, then consult authoritative runtime state before mutation. This is a migration in responsibility, not a claim that one backend alone contains complete truth.

## 9. Temporal took ownership of long-running execution

**Implemented mechanism.** Judge-Gym removed the legacy Convex queue/orchestrator substrate from the active path and made Temporal workflows the owners of run execution. The current V4 split is explicit: Convex owns control-plane state and storage persistence; Railway-hosted Temporal workers own long-running provider calls, Media Cloud discovery and hydration, and semantic transforms. Workflow bindings, task-queue readiness, heartbeats, retry behavior, and idempotent worker APIs make that boundary observable. Media Cloud acquisition was moved out of Convex actions and into `engine-temporal` rather than into another microservice.

**Operational evidence.** The infra-hardening report records a rebuilt and verified Railway worker, a successful bounded live acquisition smoke, and cleanup of transient smoke data. It also records that the first failure was a rate-limit signal; bounded page budgets plus transient retry/backoff made the smoke pass without weakening the production path. Current README documentation records activity heartbeats, paged stage inputs, and recovery across worker restarts or slow observability writes.

**Retrospective lesson.** Ownership should follow failure duration and side-effect type. Convex is well suited to product state, idempotent APIs, and projections; long external I/O belongs in a durable workflow runtime. The transfer also required agents to abandon queue-era diagnoses and repairs. Keeping old nouns after an architecture change is an operational bug.

## 10. Deep workflows made large refactors reviewable

**Implemented mechanism.** Larger planning, implementation, infra, launch, and analysis efforts were represented as checked-in deep workflows. A workflow could include an objective and operating mode, node workspaces, bootstrap state, trace, execution report, validation report, machine-readable merge, and final synthesis. Work was split into bounded roles or nodes where useful, while a lead agent retained responsibility for patch selection, integration, and validation.

**Operational evidence.** The repository contains successive V4 workflows for architecture planning, implementation logistics, package/runtime implementation, infra hardening, data organization, five launch passes, and rerun comparison. Their outputs show an important pattern: early planning rejected an over-broad generic rewrite, implementation added package-aware canaries and local bundles before live mutation, infra work corrected execution ownership, and launch iterations converted discovered lineage and repeatability problems into narrow hardening changes.

**Retrospective lesson.** The value of multi-agent work was not maximal parallelism. It was decomposition with durable artifacts and a single integration authority. Some workflows completed without subagents; some bounded investigators timed out; neither invalidated the workflow because synthesis did not depend on indefinite delegation. Deep workflows helped most when they narrowed a refactor into reviewable decisions, not when they multiplied agents.

## What we would keep

1. A manifest-scoped mission with named states and explicit stop conditions.
2. Cheap cohort snapshots plus stronger runtime confirmation before mutation.
3. Forensics before reset, and machine-readable artifacts beside narrative reports.
4. One allowlisted repair attempt, followed by stop-and-diagnose.
5. Agent-owned development logs for any debugging claim based on local runtime behavior.
6. Separate software-health, lineage, and scientific-validity gates.
7. Narrow smoke tests before cohort launches, with external work bounded by page, item, or action budgets.
8. A single lead owner for patches and synthesis, even when investigation is parallelized.

## What we would avoid

1. Treating an agent prompt as a substitute for engine-level retry and dispatch limits.
2. Allowing telemetry writes to share a contended transactional hotspot with core work.
3. Letting an external log backend become the only route to basic health or repair decisions.
4. Repeatedly healing a workflow until it appears healthy.
5. Reusing campaign identity by naming convention or prefix inference.
6. Calling a technically successful run scientifically valid without provenance and repeatability checks.
7. Carrying old queue-era repair concepts into a Temporal-owned runtime.
8. Starting broad refactors before a captured failure or locked research requirement justifies them.

## Closing

The practical achievement was not “agents built Judge-Gym.” The more accurate account is that Judge-Gym gradually acquired interfaces and records that let agents contribute without making their private context the system of record. The control plane constrained action; manifests constrained missions; snapshots preserved evidence; logs grounded diagnosis; Temporal clarified execution ownership; and scientific gates constrained claims.

The remaining standard is intentionally stricter than successful agent-assisted operation: the engine should not require continuous agentic monitoring to stay healthy. Agents are useful operators and engineers when the system exposes truth and enforces bounds. They are not a replacement for those properties.
