# N01 Evidence Index

- Live V3 snapshot: cohort is `preflight_clean`, `launch_ready = true`, all 18 experiments in `start`, no stuck items.
- Queue health: both Temporal queues are ready with zero backlog and only worker identity `1@8ca2e1f3c6ee` polling.
- Railway deploy: deployment `565cc726-ffe2-4ef1-8b97-bcc6e08dd4d1` succeeded and started both run/window workers.
- Convex failure logs:
  - short burst of `packages/worker:recordLlmAttemptFinish -> Attempt not found`
  - recurring `packages/worker:projectProcessState -> Window run not found`
- Local agent-owned `bun dev` stream confirms the recurring `Window run not found` failures are still happening in real time.
- Relevant code paths:
  - `apps/engine-convex/convex/packages/worker.ts`
  - `apps/engine-convex/convex/domain/maintenance/v3_campaign.ts`
  - `apps/engine-convex/convex/domain/maintenance/danger.ts`
