# The Rewrite Needs a Safe-Deployment SOP, Not Just General Awareness of Replay and Versioning

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_016_versioning_and_replay_workflow.md
- https://docs.temporal.io/develop/safe-deployments
- https://docs.temporal.io/develop/typescript/testing-suite
- https://docs.temporal.io/develop/typescript/versioning
- https://docs.temporal.io/develop/typescript/continue-as-new
- https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning

**Summary:**
The final high-level weak spot is now concrete enough to close: judge-gym needs a real safe-deployment SOP for Temporal workers.

The safe-deployment story should be expressed in two tiers rather than one all-or-nothing requirement set.

The minimum v0 defaults should be:

1. replay testing is mandatory for workflow-code changes
2. `continue-as-new` is part of workflow design from day one, not an afterthought
3. TypeScript patching is the default way to bridge deterministic workflow-code changes when workflows may still replay old histories

The later, stronger operational tier is:

4. Worker Versioning used deliberately:
   - `Auto-Upgrade` as the default for long-lived workflows
   - `Pinned` only for clearly short-lived workflows that drain quickly
5. rollout includes a verification phase and a ramp phase before promotion

Temporal’s own guidance supports this shape:

- replay tests should run against real histories in CI and at deploy time
- `patched()` / `deprecatePatch()` is the supported TS versioning path
- `workflowInfo().continueAsNewSuggested` should be treated as a real trigger signal
- Worker Versioning adds operational power, but also real complexity and edge cases

One important operational guardrail also needs to be explicit: avoid eager workflow start paths where version-routing guarantees matter, because Temporal warns eager start does not respect Worker Versioning. That guardrail only matters once Worker Versioning is part of the deployment posture.

So the v0 rule is:

- replay before rollout,
- patch deterministic changes,
- continue-as-new proactively,
- and treat Worker Versioning ramping plus pinned-vs-auto-upgrade routing as a staged capability if the initial rollout can stay simpler.
