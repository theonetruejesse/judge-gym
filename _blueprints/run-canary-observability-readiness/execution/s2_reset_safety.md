# S2 Reset/Preservation Safety

Date: 2026-03-04

## Scope

Validated and hardened targeted run cleanup safety for `domain/maintenance/danger:deleteRunData`.

## Changes

1. Added active-run guard to `deleteRunData`:
- New arg: `allow_active` (default `false`)
- If run status is one of `start|queued|running|paused`, cleanup now throws unless `allow_active=true`.

2. Added tests:
- `danger_reset.test.ts` verifies:
  - active run deletion is blocked by default,
  - explicit override allows dry-run planning,
  - run-linked rows are deleted while windows/evidence remain intact.

3. Updated operator docs:
- `AGENTS.md`
- `README.md`
- `docs/live_debug_loop.md`

## Validation

```bash
cd packages/engine
bun run test -- tests/danger_reset.test.ts

cd /Users/jesselee/dev/research/jg/judge-gym
bun run typecheck
```

Both passed.

## Result

- S2 gate **PASS**.
- Reset workflow is now safer by default and explicit for active-run destructive operations.
