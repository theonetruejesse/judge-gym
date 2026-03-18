# Temporal Fits the Missing Execution Layer

**Confidence:** 0.91

**Sources:**
- https://docs.temporal.io/workflows
- https://docs.temporal.io/activities
- https://docs.temporal.io/task-queue

**Summary:**
Temporal’s core model matches the missing abstraction in judge-gym. Workflows are durable orchestrators backed by event history and deterministic replay. Activities are the failure-prone side effects and are the appropriate home for external API calls, polling, and network work. Task queues and workers replace the need for ad hoc scheduler loops and lease tables.

For judge-gym, that means the current run/window control flow can move into `RunWorkflow` and `WindowWorkflow`, while evidence search, model calls, batch submission, and result persistence become Activities. This directly addresses the current pain point: maintaining a distributed execution engine just to coordinate API calls and retries.

