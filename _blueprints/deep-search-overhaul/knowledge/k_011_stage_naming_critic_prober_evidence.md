# Stage Pipeline + Critic/Prober Naming

**Confidence:** 0.7

**Sources:**
- packages/engine/convex/stages/2_rubric/rubric_agent.ts
- packages/engine/convex/stages/2_rubric/rubric_steps.ts
- packages/engine/convex/stages/2_rubric/rubric_workflow.ts
- packages/engine/convex/stages/3_scoring/scoring_agent.ts
- packages/engine/convex/stages/3_scoring/scoring_steps.ts
- packages/engine/convex/stages/3_scoring/scoring_workflow.ts

**Summary:**
The current pipeline is staged as evidence → rubric → scoring. The rubric stage uses a `Rubricer` and a `Critic`, each extending `AbstractJudgeAgent` with explicit role names (`"rubricer"`, `"critic"`) and persists `criticThreadId` plus critic output/reasoning to the `rubrics` table. The scoring stage uses a `Scorer` followed by a `Prober` (role name `"prober"`), and stores `probeThreadId`, `expertAgreementProb`, and probe outputs in the `scores` table. Renaming the probe to a standardized critic implies updating these agent role identifiers and the persisted column names or labels tied to probe fields.
