# Agent-Kit Thread/Message + Usage Coupling

**Confidence:** 0.72

**Sources:**
- packages/engine/convex/agents/abstract.ts
- packages/engine/convex/data.ts
- packages/engine/convex/schema.ts
- packages/engine/convex/agent_config.ts
- packages/engine/convex/stages/2_rubric/rubric_steps.ts
- packages/engine/convex/stages/3_scoring/scoring_steps.ts

**Summary:**
Agent stages create new agent-kit threads per operation via `AbstractJudgeAgent.createThread`, tagging threads with stage/experiment/model metadata. Rubric and scoring tables persist those thread IDs (`rubricerThreadId`, `criticThreadId`, `threadId`, `probeThreadId`) as the only link to the conversation history stored in agent-kit. Message retrieval is done via `listAgentThreadMessages` in `data.ts`, which queries the agent component by thread ID. Token usage is logged through `experimentConfig.usageHandler` into the `usages` table keyed by thread ID, and the same handler feeds token counts back to the rate limiter. This shows the current coupling between table rows and agent-kit threads for both messages and usage.
