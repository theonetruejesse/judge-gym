# Current Cohort Is Scientifically Invalid and Non-Recovering

**Confidence:** 0.95

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/iterations/20260316T010116Z_rubric_critic_timeout_exhaustion/snapshot.json
- /Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/iterations/20260316T010116Z_rubric_critic_timeout_exhaustion/report.md

**Summary:**
The live full-pass cohort already contains enough evidence to justify termination for engineering purposes. At capture time, `16` latest runs were scientifically invalid, each stalled at `rubric_critic=29/30` with `stage_waiting_on_exhausted_requests`. A representative failed target had `resolution = exhausted`, no parse artifact, and terminal attempts ending with `Your request timed out.`, which makes parser-repair the weaker explanation. Waiting longer may produce more examples, but the current stuck runs have no pending internal recovery path.
