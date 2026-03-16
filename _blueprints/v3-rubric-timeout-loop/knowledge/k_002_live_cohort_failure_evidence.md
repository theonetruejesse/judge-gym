# Live Cohort Failure Evidence

**Confidence:** 0.94

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/iterations/20260316T010116Z_rubric_critic_timeout_exhaustion/report.md
- /Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/iterations/20260316T010116Z_rubric_critic_timeout_exhaustion/snapshot.json
- Live observations from `packages/codex:getV3CampaignStatus`
- Live observations from `packages/codex:getStuckWork`
- One-off query inspection of `process_request_targets` for run `kh77g35cyrn0cncx3n9083jat5830kj0`

**Summary:**
The current V3 full pass is already scientifically invalid. A recent live snapshot showed `22` latest runs, `4` completed, `18` still running, and `16` of those stuck at `rubric_critic` with `rubric_critic_count = 29`, `rubric_gen_count = 30`, `has_failures = true`, and `stuck_summary = stage_waiting_on_exhausted_requests`.

Representative inspection of run `kh77g35cyrn0cncx3n9083jat5830kj0` showed `29` `rubric_critic` target states with `resolution = succeeded` and exactly one target with `resolution = exhausted`. This rules out a UI-only lag and shows the stage is blocked by terminal target exhaustion.

Later status samples kept the same `16` scientifically invalid rubric-critic runs even as multiple score-stage runs completed. That is strong evidence that waiting is not fixing the exhausted rubric-critic subset.
