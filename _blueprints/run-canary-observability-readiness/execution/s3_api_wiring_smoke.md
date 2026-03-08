# S3 API Wiring / Dispatch Smoke

Date: 2026-03-04
Deployment: `ownDev` (`rightful-grouse-57`)

## Run under test

- `experiment_id`: `j9729t9pjh3vx9wk9e9hkwtyzn829bz5`
- `run_id`: `kh7dm90t3fdywk7c67p7zvswj1829tbm`
- Started via `packages/lab:startExperimentRun`

## Checks

1. Start path wiring
- `packages/lab:startExperimentRun` returned run id and sample count.
- Scheduler kick path executed (job claim + queued handler events present).

2. Trace lifecycle wiring
- `packages/lab:getTraceEvents` shows expected early lifecycle:
  - `run_stage_enqueued`
  - `run_started`
  - `job_run_claimed`
  - `job_queued_handler_started`
  - `request_applied`
  - `job_finalized`
  - `run_stage_advanced`

3. Diagnostics wiring
- `packages/lab:getRunDiagnostics` reports artifacts and stage rollup updates.
- `current_stage` advanced from `rubric_gen` to `rubric_critic`.

## Result

- S3 gate **PASS**.
- No API wiring changes required.
