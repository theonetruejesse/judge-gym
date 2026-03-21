# Live Cohort State

**Confidence:** 0.87

**Sources:**
- `packages/codex:getV3CampaignSnapshot` live output captured on 2026-03-21

**Summary:**
The live cohort was still progressing at audit time. All 18 experiments had active runs, no runs were paused or errored, and the stage distribution had shifted into `score_gen` and `score_critic`. Temporal queue readiness was healthy for both `judge-gym.run` and `judge-gym.window`, which ruled out worker polling failure as the dominant problem for this pass.
