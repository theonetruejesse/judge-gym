# Workflow replay and action retries via workpool

**Confidence:** 0.67

**Sources:**
- packages/engine/convex/domain/orchestrator/process_workflows.ts
- packages/engine/node_modules/@convex-dev/workflow/src/client/workflowMutation.ts
- packages/engine/node_modules/@convex-dev/workflow/src/component/journal.ts
- packages/engine/node_modules/@convex-dev/workflow/src/component/pool.ts

**Summary:**
Workflows are executed via a workflow mutation that replays prior steps from a journal and only starts new steps when needed. Each step completion re-enqueues the workflow handler, so the handler runs multiple times per workflow. In this repo, `processWorkflow` enables `retryActionsByDefault` with a retry policy, meaning `runAction` steps can retry. This increases the chance that a running-batch workflow or its action steps (polling, provider calls) execute more than once.
