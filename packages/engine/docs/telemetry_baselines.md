# Telemetry Baselines

## 2026-03-04 Window Validation (Post-Synthetic Cleanup)

Deployment: `rightful-grouse-57` (dev)

### Window A: foreign policy (limit 10)
- `window_id`: `jx7far6q591dcekxegsd175k2n828p2c`
- status: `completed`
- evidence total: `10`
- route by stage: all job (`l1/l2/l3`)
- duration (trace): `127,569 ms` (~2.13m)
- request applied total: `30`
- duplicate apply success total: `0`
- jobs finalized multiple times: `0`
- events after terminal: `0`
- errors: none

### Window B: the economy (limit 10)
- `window_id`: `jx75vkh5x61ksx2eb0vc2c54jd828ja4`
- status: `completed`
- evidence total: `9` (search returned fewer than requested)
- route by stage: all job (`l1/l2/l3`)
- duration (trace): `100,041 ms` (~1.67m)
- request applied total: `27`
- duplicate apply success total: `0`
- jobs finalized multiple times: `0`
- events after terminal: `0`
- errors: none

## Readiness Notes

- Window orchestration is currently stable for low-count live collection.
- No duplicate-apply churn or post-terminal event leakage observed.
- Scheduler was able to drain both windows and settle to idle.
