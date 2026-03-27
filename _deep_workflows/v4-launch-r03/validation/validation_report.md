# Validation Report

- `bun run v4:build:headline`
- `bun run v4:launch:headline --cohort=abstention`
- `bun run v4:launch:headline --cohort=abstention --live --start-run`
- `cd apps/engine-convex && bun run test -- run_parsers`
- `bun run validate:convex`
- `./scripts/run_convex.sh packages/lab:startExperimentRun '{"experiment_id":"jh7aysajh6n2psahwx2p28pcp983p55a","target_count":1}'`
- `./scripts/run_convex.sh packages/lab:listExperiments '{}'`
- `./scripts/run_convex.sh packages/lab:getRunSummary '{"run_id":"kx71amrny64cca0531pppf83sx83pr2d"}'`
- `./scripts/run_convex.sh packages/lab:getRunDiagnostics '{"run_id":"kx731tbxet65nrban46p0ntctn83pgz9"}'`
- `./scripts/run_convex.sh packages/codex:getTemporalTaskQueueHealth '{}'`
