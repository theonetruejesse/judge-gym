# Versioning and Replay Testing Need an Operational Workflow, Not Just Awareness

**Confidence:** 0.62

**Sources:**
- https://docs.temporal.io/develop/typescript/versioning
- https://docs.temporal.io/patching
- https://docs.temporal.io/develop/typescript/testing-suite
- https://docs.temporal.io/develop/safe-deployments
- https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning
- https://docs.temporal.io/develop/typescript/continue-as-new

**Summary:**
Temporal’s determinism and replay model means deployment safety has to be designed in, not bolted on later. This pass clarifies a plausible small-team operating model: replay testing must become a required gate for workflow-code changes, `continue-as-new` should be part of the design for histories that can grow meaningfully, and Worker Versioning plus patching should be treated as explicit rollout tools rather than abstract future options.

The one correction is that “Pinned early” is not free. Worker Versioning is still documented with preview-era caveats and comes with real draining/version-retention costs. The safer default is conditional: if workflow runs are short enough to drain old workers cleanly, pinned workflows are attractive. If runs span deploy windows, the system will need auto-upgrade behavior plus patching discipline, or a workflow-type cutover strategy. A practical rollout workflow should therefore include workflow-type policy, replay testing in CI, a pre-deploy verification phase against real histories, a documented `continue-as-new` trigger, and an explicit decision on when preview Worker Versioning is acceptable versus when simpler cutover/patching discipline is safer.
