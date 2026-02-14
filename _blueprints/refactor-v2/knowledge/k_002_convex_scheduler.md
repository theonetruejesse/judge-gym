# Convex Scheduler/Orchestration Constraints

**Confidence:** 0.66

**Sources:**
- https://docs.convex.dev/scheduling/scheduled-functions
- https://docs.convex.dev/scheduling/cron-jobs
- https://docs.convex.dev/production/state/limits

**Summary:**
Convex supports scheduled functions via `runAfter` and `runAt`, stored durably in the database. Scheduling from mutations is atomic with the write; scheduling from actions is not atomic. Scheduled mutations are exactly-once with automatic retries on internal errors, while scheduled actions are at-most-once and not retried by default. Cron jobs are defined in `convex/crons.ts`, can be specified via interval or cron syntax, and only one run executes at a time, so overlapping schedules may be skipped. Limits include concurrent scheduled job execution caps, per-mutation scheduling caps, and total scheduled-args size limits.
