# Workflow Manager + Rate Limiter Durability

**Confidence:** 0.74

**Sources:**
- packages/engine/convex/workflow_manager.ts
- packages/engine/convex/stages/1_evidence/evidence_workflow.ts
- packages/engine/convex/stages/1_evidence/evidence_steps.ts
- packages/engine/convex/stages/2_rubric/rubric_workflow.ts
- packages/engine/convex/stages/3_scoring/scoring_workflow.ts
- packages/engine/convex/agent_config.ts
- packages/engine/convex/rate_limiter/index.ts
- packages/engine/convex/agents/abstract.ts

**Summary:**
WorkflowManager is configured with bounded parallelism and default retries (max 5 attempts, backoff), and workflows implement explicit batch loops for evidence, rubric, and scoring. Evidence steps use `runWithConcurrency` and `withRetries` for per-item durability, and workflows update experiment status only at milestones, making restarts safe. The rate limiter is a Convex component instantiated with per-model request/token keys; `agents/abstract.ts` performs pre-flight request limiting (`throws: true`), and `agent_config.ts` backfills token usage to the limiter post-hoc (`throws: false`) while logging usage to the DB. This demonstrates a durable retry + rate-limit pattern that can be adapted to batching workflows.
