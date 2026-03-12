import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type ScenarioKind = "window" | "run";

type Scenario = {
  id: string;
  kind: ScenarioKind;
  evidenceCount: number;
  targetCount?: number;
  schedulerKickoff: boolean;
  timeoutMs: number;
  maxEvents: number;
  notes: string;
  runRecoveryCheck?: boolean;
};

type WindowSummary = {
  window_id: string;
  status: string;
  current_stage: string;
  evidence_total: number;
  l1_completed: number;
  l2_completed: number;
  l3_completed: number;
  trace_id: string;
};

type RunSummary = {
  run_id: string;
  status: string;
  current_stage: string;
  target_count: number;
  trace_id: string;
};

const ROOT = path.resolve(process.cwd());
const reportName = process.env.MATRIX_REPORT ?? "synthetic_matrix_report_2026-03-03.md";
const reportLabel = process.env.MATRIX_LABEL ?? "default";
const REPORT_PATH = path.join(ROOT, "docs", reportName);
const timeoutMultiplierRaw = Number(process.env.MATRIX_TIMEOUT_MULTIPLIER ?? "1");
const timeoutMultiplier = Number.isFinite(timeoutMultiplierRaw) && timeoutMultiplierRaw > 0
  ? timeoutMultiplierRaw
  : 1;
const POLL_MS = 5_000;

const ALL_SCENARIOS: Scenario[] = [
  {
    id: "window_job_baseline",
    kind: "window",
    evidenceCount: 8,
    schedulerKickoff: true,
    timeoutMs: 8 * 60_000,
    maxEvents: 8_000,
    notes: "Baseline job-route window (< min_batch_size).",
  },
  {
    id: "window_batch_baseline",
    kind: "window",
    evidenceCount: 30,
    schedulerKickoff: true,
    timeoutMs: 12 * 60_000,
    maxEvents: 12_000,
    notes: "Baseline batch-route window (>= min_batch_size).",
  },
  {
    id: "window_scheduler_recovery",
    kind: "window",
    evidenceCount: 10,
    schedulerKickoff: false,
    timeoutMs: 10 * 60_000,
    maxEvents: 8_000,
    notes: "Recovery drill: start orchestration without scheduler, then auto-heal.",
    runRecoveryCheck: true,
  },
  {
    id: "run_mixed_baseline",
    kind: "run",
    evidenceCount: 12,
    targetCount: 4,
    schedulerKickoff: true,
    timeoutMs: 18 * 60_000,
    maxEvents: 15_000,
    notes: "Baseline run with low sample count and subset scoring fanout.",
  },
];
const requestedScenarioIds = (process.env.MATRIX_SCENARIOS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const SCENARIOS = requestedScenarioIds.length > 0
  ? ALL_SCENARIOS.filter((scenario) => requestedScenarioIds.includes(scenario.id))
  : ALL_SCENARIOS;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonFromStdout(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    try {
      return JSON.parse(line);
    } catch {
      // Continue scanning.
    }
  }
  return JSON.parse(trimmed);
}

function runConvex(functionName: string, payload: object): any {
  const result = spawnSync(
    "npx",
    ["-y", "convex@latest", "run", functionName, JSON.stringify(payload)],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error([
      `Convex call failed: ${functionName}`,
      `payload=${JSON.stringify(payload)}`,
      `stdout=${result.stdout?.trim() ?? ""}`,
      `stderr=${result.stderr?.trim() ?? ""}`,
    ].join("\n"));
  }
  return parseJsonFromStdout(result.stdout ?? "");
}

function initReport() {
  if (!existsSync(path.dirname(REPORT_PATH))) {
    mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  }
  const header = [
    "# Synthetic Matrix Report (2026-03-03)",
    "",
    `- generated_at: ${nowIso()}`,
    `- label: ${reportLabel}`,
    "- runner: `packages/engine/scripts/synthetic_matrix.ts`",
    "",
    "## Scenarios",
    "",
    "| id | kind | evidence | target_count | scheduler_kickoff | notes |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...SCENARIOS.map((scenario) => `| ${scenario.id} | ${scenario.kind} | ${scenario.evidenceCount} | ${scenario.targetCount ?? "-"} | ${scenario.schedulerKickoff} | ${scenario.notes} |`),
    "",
    "## Results",
    "",
  ].join("\n");
  writeFileSync(REPORT_PATH, `${header}\n`);
}

function appendReport(section: string) {
  appendFileSync(REPORT_PATH, `${section}\n`);
}

function classifyRoute(stageSummaries: Array<{ route: string }>): string {
  const routes = new Set(stageSummaries.map((stage) => stage.route).filter(Boolean));
  if (routes.size === 0) return "none";
  if (routes.size === 1) return [...routes][0] ?? "none";
  return "mixed";
}

async function nukeAllTables(): Promise<{ passes: number; totalDeleted: number }> {
  let passes = 0;
  let totalDeleted = 0;
  while (passes < 40) {
    passes += 1;
    const pass = runConvex("domain/maintenance/danger:nukeTablesPass", {
      limitPerTable: 5_000,
      isDryRun: false,
    }) as { total_deleted: number };
    totalDeleted += pass.total_deleted;
    if (pass.total_deleted === 0) break;
  }
  return { passes, totalDeleted };
}

function makeSyntheticEvidences(scenarioId: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    return {
      title: `${scenarioId} evidence ${ordinal}`,
      url: `https://synthetic.local/${scenarioId}/${ordinal}`,
      raw_content: [
        `Scenario ${scenarioId} evidence ${ordinal}.`,
        "This is deterministic synthetic content for orchestration testing.",
        "The policy impact was discussed by officials with mixed certainty.",
      ].join(" "),
    };
  });
}

function createSyntheticWindow(scenario: Scenario) {
  const created = runConvex("domain/window/window_repo:createWindow", {
    country: "US",
    model: "gpt-4.1-mini",
    start_date: "2026-03-01",
    end_date: "2026-03-03",
    query: `synthetic ${scenario.id}`,
  }) as { window_id: string };

  runConvex("domain/window/window_repo:insertEvidenceBatch", {
    window_id: created.window_id,
    evidences: makeSyntheticEvidences(scenario.id, scenario.evidenceCount),
  });

  runConvex("domain/window/window_service:startWindowOrchestration", {
    window_id: created.window_id,
  });

  if (scenario.schedulerKickoff) {
    runConvex("domain/orchestrator/scheduler:startScheduler", {});
  }

  return created;
}

async function waitForWindow(windowId: string, timeoutMs: number): Promise<WindowSummary> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const summary = runConvex("packages/lab:getWindowSummary", {
      window_id: windowId,
    }) as WindowSummary;
    if (summary.status === "completed" || summary.status === "error" || summary.status === "canceled") {
      return summary;
    }
    await sleep(POLL_MS);
  }
  throw new Error(`Timeout waiting for window ${windowId}`);
}

function defaultExperimentConfig() {
  return {
    rubric_config: {
      model: "gpt-4.1-mini",
      scale_size: 5,
      concept: "policy quality",
    },
    scoring_config: {
      model: "gpt-4.1-mini",
      method: "subset",
      abstain_enabled: true,
      evidence_view: "l3_abstracted",
      randomizations: [],
      evidence_grouping: {
        mode: "single_evidence",
      },
    },
  };
}

function createRunFromWindow(windowId: string, targetCount: number) {
  const evidenceRows = runConvex("packages/lab:listEvidenceByWindow", {
    window_id: windowId,
  }) as Array<{ evidence_id: string }>;
  const evidenceIds = evidenceRows.map((row) => row.evidence_id);
  if (evidenceIds.length === 0) {
    throw new Error(`No evidence rows found for window ${windowId}`);
  }

  const initialized = runConvex("packages/lab:initExperiment", {
    experiment_config: defaultExperimentConfig(),
    pool_id: runConvex("packages/lab:createPool", {
      evidence_ids: evidenceIds,
    }).pool_id,
  }) as { experiment_id: string };

  const started = runConvex("packages/lab:startExperimentRun", {
    experiment_id: initialized.experiment_id,
    target_count: targetCount,
  }) as { run_id: string; samples_created: number };

  return {
    experiment_id: initialized.experiment_id,
    run_id: started.run_id,
  };
}

async function waitForRun(runId: string, timeoutMs: number): Promise<RunSummary> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const summary = runConvex("packages/lab:getRunSummary", { run_id: runId }) as RunSummary;
    if (summary.status === "completed" || summary.status === "error" || summary.status === "canceled") {
      return summary;
    }
    await sleep(POLL_MS);
  }
  throw new Error(`Timeout waiting for run ${runId}`);
}

function recoveryCheck(processType: "window" | "run", processId: string) {
  const stuckBefore = runConvex("packages/codex:getStuckWork", {
    process_type: processType,
    older_than_ms: 1_000,
    limit: 50,
  }) as { items: Array<{ process_id: string; reason: string }> };
  const processItems = stuckBefore.items.filter((item) => item.process_id === processId);

  const dry = runConvex("packages/codex:autoHealProcess", {
    process_type: processType,
    process_id: processId,
    dry_run: true,
    older_than_ms: 100,
  }) as { actions?: unknown[]; planned_actions?: unknown[]; results?: unknown[] };

  const apply = runConvex("packages/codex:autoHealProcess", {
    process_type: processType,
    process_id: processId,
    dry_run: false,
    older_than_ms: 100,
  }) as { actions?: unknown[]; planned_actions?: unknown[]; results?: unknown[] };
  const dryActions = dry.actions ?? dry.planned_actions ?? [];
  const dryResults = dry.results ?? [];
  const applyActions = apply.actions ?? apply.planned_actions ?? [];
  const applyResults = apply.results ?? [];

  return {
    stuck_reasons: processItems.map((item) => item.reason),
    dry_action_count: dryActions.length,
    dry_result_count: dryResults.length,
    apply_action_count: applyActions.length,
    apply_result_count: applyResults.length,
    dry_actions: dryActions,
    apply_actions: applyActions,
  };
}

function analyzeProcess(
  processType: "window" | "run",
  processId: string,
  maxEvents: number,
) {
  const health = runConvex("packages/codex:getProcessHealth", {
    process_type: processType,
    process_id: processId,
    include_recent_events: 50,
  });
  const analysis = runConvex("packages/codex:analyzeProcessTelemetry", {
    process_type: processType,
    process_id: processId,
    max_events: maxEvents,
  }) as {
    trace_id: string;
    sampled_events: number;
    reached_end_of_trace: boolean;
    stage_summaries: Array<{ stage: string; route: string; request_error: number }>;
    terminal_stats: { terminal_event_name: string | null; events_after_terminal: number };
    request_stats: { duplicate_apply_success_total: number };
    job_stats: { jobs_finalized_multiple_times: number };
  };
  return { health, analysis };
}

function reportScenarioHeader(scenario: Scenario) {
  appendReport(`### ${scenario.id}`);
  appendReport("");
  appendReport(`- started_at: ${nowIso()}`);
  appendReport(`- kind: ${scenario.kind}`);
  appendReport(`- evidence_count: ${scenario.evidenceCount}`);
  appendReport(`- target_count: ${scenario.targetCount ?? "-"}`);
  appendReport(`- scheduler_kickoff: ${scenario.schedulerKickoff}`);
  appendReport(`- notes: ${scenario.notes}`);
  appendReport("");
}

function reportJson(label: string, value: unknown) {
  appendReport(`- ${label}:`);
  appendReport("```json");
  appendReport(JSON.stringify(value, null, 2));
  appendReport("```");
}

async function executeScenario(scenario: Scenario) {
  reportScenarioHeader(scenario);
  const nukeBefore = await nukeAllTables();
  reportJson("nuke_before", nukeBefore);

  const createdWindow = createSyntheticWindow(scenario);
  reportJson("window_created", createdWindow);

  let recoveryResult: unknown = null;
  if (scenario.runRecoveryCheck) {
    await sleep(15_000);
    recoveryResult = recoveryCheck("window", createdWindow.window_id);
    reportJson("recovery_check", recoveryResult);
  }

  const effectiveTimeoutMs = Math.round(scenario.timeoutMs * timeoutMultiplier);
  const windowSummary = await waitForWindow(createdWindow.window_id, effectiveTimeoutMs);
  const windowStats = analyzeProcess("window", createdWindow.window_id, scenario.maxEvents);
  reportJson("window_summary", windowSummary);
  reportJson("window_analysis", {
    trace_id: windowStats.analysis.trace_id,
    sampled_events: windowStats.analysis.sampled_events,
    reached_end_of_trace: windowStats.analysis.reached_end_of_trace,
    route: classifyRoute(windowStats.analysis.stage_summaries),
    stage_summaries: windowStats.analysis.stage_summaries,
    terminal_stats: windowStats.analysis.terminal_stats,
    duplicate_apply_success_total: windowStats.analysis.request_stats.duplicate_apply_success_total,
    jobs_finalized_multiple_times: windowStats.analysis.job_stats.jobs_finalized_multiple_times,
  });

  if (scenario.kind === "run") {
    const targetCount = scenario.targetCount ?? 3;
    const runStarted = createRunFromWindow(createdWindow.window_id, targetCount);
    reportJson("run_started", runStarted);
    const runSummary = await waitForRun(runStarted.run_id, effectiveTimeoutMs);
    const runStats = analyzeProcess("run", runStarted.run_id, scenario.maxEvents);
    const diagnostics = runConvex("packages/lab:getRunDiagnostics", {
      run_id: runStarted.run_id,
    });
    reportJson("run_summary", runSummary);
    reportJson("run_analysis", {
      trace_id: runStats.analysis.trace_id,
      sampled_events: runStats.analysis.sampled_events,
      reached_end_of_trace: runStats.analysis.reached_end_of_trace,
      route: classifyRoute(runStats.analysis.stage_summaries),
      stage_summaries: runStats.analysis.stage_summaries,
      terminal_stats: runStats.analysis.terminal_stats,
      duplicate_apply_success_total: runStats.analysis.request_stats.duplicate_apply_success_total,
      jobs_finalized_multiple_times: runStats.analysis.job_stats.jobs_finalized_multiple_times,
    });
    reportJson("run_diagnostics", diagnostics);
  }

  const nukeAfter = await nukeAllTables();
  reportJson("nuke_after", nukeAfter);
  appendReport("");
}

async function main() {
  initReport();
  appendReport(`- script_started_at: ${nowIso()}`);
  appendReport("");
  for (const scenario of SCENARIOS) {
    await executeScenario(scenario);
  }
  appendReport("## Complete");
  appendReport("");
  appendReport(`- finished_at: ${nowIso()}`);
}

main().catch((error) => {
  appendReport("## Failure");
  appendReport("");
  appendReport("```text");
  appendReport(error instanceof Error ? error.stack ?? error.message : String(error));
  appendReport("```");
  process.exit(1);
});
