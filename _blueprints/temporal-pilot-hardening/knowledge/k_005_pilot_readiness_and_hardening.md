# Pilot Readiness And Hardening (Temporal-Backed)

**Confidence:** 0.76

**Sources:**
- [/Users/jesselee/dev/research/jg/judge-gym/README.md](/Users/jesselee/dev/research/jg/judge-gym/README.md)
- [/Users/jesselee/dev/research/jg/judge-gym/docs/setup.md](/Users/jesselee/dev/research/jg/judge-gym/docs/setup.md)
- [/Users/jesselee/dev/research/jg/judge-gym/docs/railway.md](/Users/jesselee/dev/research/jg/judge-gym/docs/railway.md)
- [/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md)
- [/Users/jesselee/dev/research/jg/judge-gym/scripts/deploy_railway_worker.sh](/Users/jesselee/dev/research/jg/judge-gym/scripts/deploy_railway_worker.sh)
- [/Users/jesselee/dev/research/jg/judge-gym/railway.toml](/Users/jesselee/dev/research/jg/judge-gym/railway.toml)
- [/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/quota/redis.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/quota/redis.ts)
- [/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/tests/v3_campaign_control_plane.test.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/tests/v3_campaign_control_plane.test.ts)
- Railway Redis docs citeturn0search0
- Railway TCP proxy docs citeturn0search3
- Railway config-as-code docs citeturn0search1turn0search2
- Railway variables reference (TCP proxy + private domain vars) citeturn0search4
- Temporal CLI note on `task-queue describe` pollers/reachability citeturn0search7

**Summary:**
The core execution cutover is complete (Convex domain store + Temporal execution + Railway-first deployment), but pilot-scale reliability will be dominated by: (1) end-to-end operability gaps (being able to answer “is the worker polling / are workflows stuck / why”), (2) campaign-scale cost/read-budget and “cohort-only” status paths, and (3) reproducible bootstrap/testing that catches regressions without requiring a human to eyeball Temporal UI.

## What Still Needs Hardening Before A Full-Scale Pilot Loop

### 1) Operator/Agent Observability Needs A “One Hop” Truth Path
Today, the repo is Railway-first: Convex is cloud-hosted and Temporal is on Railway; the worker runs on Railway and polls the private frontend alias (via `RAILWAY_TEMPORAL_PRIVATE_ADDRESS`, default `temporal-frontend:7233`). [/Users/jesselee/dev/research/jg/judge-gym/docs/setup.md](/Users/jesselee/dev/research/jg/judge-gym/docs/setup.md)

Pilot-scale failures will include “no worker polling”, “workflow exists but isn’t progressing”, and “projection is stale”. The agent must be able to confirm worker polling and task queue health without relying on UI screenshots.

Practical hardening step: add a **CLI-backed task-queue check** that can be invoked from the agent loop, using Temporal CLI’s `task-queue describe` (pollers + reachability are in the same command in newer versions). citeturn0search7

### 2) Campaign Control Plane Must Stay Cohort-Scoped (Avoid Table-Wide Scans)
The old V3 loop accumulated observability/read-limit problems when cohort status required scanning large sets of runtime rows; the backlog explicitly called out “status hot read limit” failure modes and recommended cohort-scoped aggregation. [/Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/observability_backlog.json](/Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/observability_backlog.json)

Even after the Temporal cutover, pilot readiness still requires a fast path that:
- enumerates **only** cohort experiments/runs (manifest tags or “v3_” prefix),
- summarizes progress off persisted per-stage counts and `process_observability`,
- does not need to read “all runs” or “all windows” to produce a cohort verdict.

The existing tests cover v3 control-plane behavior but are not a substitute for a “large cohort” runtime health budget check. [/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/tests/v3_campaign_control_plane.test.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/tests/v3_campaign_control_plane.test.ts)

### 3) Redis Quota Store Is Correctness-Critical; Treat Redis As First-Class Infra
The worker quota layer now uses Redis + Lua `EVAL` for atomic reservation and settlement. [/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/quota/redis.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/quota/redis.ts)

If Redis is unavailable or `EVAL` fails, quota enforcement can block all LLM work. This means:
- Redis must be in the Railway project (not optional) for “pilot mode”.
- Worker deploy should hard-require `REDIS_URL` in “pilot mode”.
- Alerting/metrics should include quota-denied vs quota-store-failed vs provider-failed.

Railway’s Redis guide documents the env vars it provides (`REDIS_URL`, `REDISHOST`, `REDISPORT`, `REDISPASSWORD`, etc.) and notes that it is “unmanaged” and needs monitoring/backup decisions. citeturn0search0

### 4) Deployment Reproducibility: Worker Is Config-As-Code, But The Project Topology Isn’t
You have `railway.toml` (config-as-code) which correctly pins *service-level* build/deploy settings (Dockerfile builder, watch patterns, restart policy). citeturn0search1turn0search2

But for a reviewer/contributor, the project topology is still manual:
- deploy official Temporal template,
- add Redis,
- add Temporal frontend TCP proxy,
- deploy worker,
- copy Temporal public TCP endpoint to Convex.

This is “acceptable for now”, but it’s still a pilot risk because the most common break will be inconsistent service names / wrong private alias / missing TCP proxy. Railway exposes variables like `RAILWAY_PRIVATE_DOMAIN` and TCP proxy vars, but those are per-service and don’t automatically wire Convex. citeturn0search4turn0search3

### 5) End-to-End Smoke Tests Need To Be Automated (Not Just Documented)
`docs/setup.md` describes manual smoke verification steps. [/Users/jesselee/dev/research/jg/judge-gym/docs/setup.md](/Users/jesselee/dev/research/jg/judge-gym/docs/setup.md)

For pilot hardening, you want a scripted smoke that:
- creates a tiny window (low evidence limit),
- asserts workflow binding was written,
- waits for at least one evidence row and at least one stage transform,
- creates a minimal run with small `target_count`,
- asserts rubric + score artifacts land.

This should run against a dev Convex deployment and the Railway Temporal cluster, so regressions in workflow start/bind or worker polling are caught quickly.

## What To Fix Before vs During The Pilot Loop

**Before the pilot loop (blocking):**
- A Temporal “worker polling” check (task queue pollers) that the agent can run without UI (Temporal CLI based). citeturn0search7
- Scripted end-to-end smoke (window + run) that exercises the real start/bind path and proves worker polling + artifact writes.
- Cohort-scoped status path that stays under Convex read limits and doesn’t depend on stale/legacy assumptions.
- Redis service as a required part of the Railway project topology (quota store availability is correctness-critical). citeturn0search0

**During the pilot loop (iterative):**
- Better classification of provider failures vs quota failures vs parse failures in `llm_attempts` and `process_observability`.
- Scaling policies: concurrency caps, task queue partitioning, and cost controls (not required for first end-to-end pilot, but will matter at full matrix scale).
- Postmortem-quality traces and “artifact provenance” improvements.

## Counterevidence / Uncertainty

- Some of the “operator checks” might be implementable without Temporal CLI by adding a worker-side “I am polling queue X” heartbeat into Convex `process_observability`. That could reduce CLI reliance, but it also risks turning Convex into the truth source for worker liveness again.
- Temporal CLI behavior varies with server version; `task-queue describe` behavior and legacy flags depend on server support. citeturn0search7
- Railway template service naming is not stable over time; docs already acknowledge service names may vary by template version. [/Users/jesselee/dev/research/jg/judge-gym/docs/setup.md](/Users/jesselee/dev/research/jg/judge-gym/docs/setup.md)

