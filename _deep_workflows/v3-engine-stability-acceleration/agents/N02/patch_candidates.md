# Runtime Patch Candidates

## Keep

- Keep the current preflight guard patch in place and use the next relaunch to validate it.

## Monitor Next

- Count and surface explicit `Timed out reserving ...` and `Timed out preparing batch execution ...` events as first-class operator signals.
- If the next loop still stalls, distinguish:
  - preamble timeout recurrence
  - post-dispatch provider/batch polling stall
  - projection lag after heartbeats are already arriving

## Do Not Expand Yet

- Do not widen this into a broader batching refactor until the next relaunch proves the remaining failure is still runtime-side.
