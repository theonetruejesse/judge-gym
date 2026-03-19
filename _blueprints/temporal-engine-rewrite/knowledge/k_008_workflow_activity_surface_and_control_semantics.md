# Minimal Workflow Surface Should Stay Small and Use Explicit Control Semantics

**Confidence:** 0.79

**Sources:**
- https://typescript.temporal.io/api/namespaces/workflow
- https://typescript.temporal.io/api/classes/workflow.CancellationScope
- https://temporal.io/change-log/typescript-sdk-v1-9-0-rc0
- https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/workflow-message-passing/handling-messages.mdx
- /Users/jesselee/dev/research/jg/judge-gym/README.md
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts

**Summary:**
The simplest rewrite surface is still one `RunWorkflow` and one `WindowWorkflow`, with no child workflows initially. Temporal message handling and cancellation semantics support that approach well: Workflow code remains deterministic and coordinator-only, while all external I/O moves into Activities. For judge-gym, that means evidence search, LLM calls, batch submit/poll, artifact writes, and telemetry emission all belong in Activities, while the workflow loop owns stage progression, pause gates, and bounded fanout.

The control plane should be explicit rather than generic. `pause_after`, `pause`, and `resume` can be modeled as Workflow messages that update in-memory workflow state, while `cancel` should usually use Temporal cancellation rather than a fake domain-level cancel signal. A strict “signals only” stance is too crude: Signals are still appropriate for fire-and-forget nudges, but Updates are a better fit when the operator or agent needs validation, acknowledgement, or a returned result. Queries remain useful for status reads, but they should not be treated as readiness gates or tight polling primitives. `continue-as-new` should be part of the default design for long or high-fanout workflows, but only after the first minimal shape is working.
