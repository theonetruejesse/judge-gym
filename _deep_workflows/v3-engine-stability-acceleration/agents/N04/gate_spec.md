# Relaunch Gate Spec

## Red

Do not relaunch if any of the following are true:

- live or local Convex logs continue to show repeated missing-row callback failures
- reset cleanliness depends on manual destructive fallbacks as the routine path
- queues are healthy but campaign state still degrades without a differentiated explanation

## Yellow

Proceed only as a validation relaunch, not an autonomy claim, if:

- the runtime patch is newly deployed and unproven
- worker identity handoff has just converged
- all queue and campaign surfaces are otherwise green

## Green

Allow a full next V3 loop only when:

- the cleanup-race patch is in place and validated
- the reset path returns to preflight_clean without abnormal noise
- the queue state and campaign state are green
- the next relaunch gate is recorded in campaign or workflow artifacts
