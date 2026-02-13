import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import { buildExperimentSpecSignature } from "@judge-gym/engine";
import { api, httpClient } from "./helpers/clients";
import { EXPERIMENT_SETTINGS } from "./experiments";
import {
  collectEvidenceForTags,
  createRunsForTags,
  ensureExperiments,
} from "./helpers/runner";
import { LabSupervisor } from "./supervisor";

type RunRow = {
  run_id: string;
  experiment_tag: string;
  status: string;
  desired_state: string;
  current_stage?: string;
  stop_at_stage?: string;
  updated_at?: number;
};

type QueueStats = {
  totals: Record<string, number>;
  by_stage: Record<string, Record<string, number>>;
  by_provider_model: Array<{
    provider: string;
    model: string;
    queued: number;
  }>;
};

type ExperimentState = {
  experiment_tag: string;
  exists: boolean;
  spec_signature?: string;
  window?: {
    start_date: string;
    end_date: string;
    country: string;
    concept: string;
  };
  evidence_total?: number;
  evidence_neutralized?: number;
  rubric?: {
    rubric_id: string;
    model_id: string;
    parse_status?: string;
  };
  run_count?: number;
  running_count?: number;
  latest_run?: {
    run_id: string;
    status: string;
    desired_state: string;
    current_stage?: string;
    updated_at?: number;
  };
};

function formatTimestamp(ts?: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function App() {
  const { exit } = useApp();
  useInput((input, key) => {
    if (input === "q" || key.escape) {
      exit();
      return;
    }
    if (actionBusy) return;
    if (input === "i") {
      void handleInit();
      return;
    }
    if (input === "e") {
      void handleEvidence();
      return;
    }
    if (input === "r") {
      void handleRun();
      return;
    }
    if (input === "b") {
      void handleBootstrap();
      return;
    }
  });

  const supervisor = useMemo(() => new LabSupervisor(), []);
  const settingsWithSignature = useMemo(
    () =>
      EXPERIMENT_SETTINGS.map((setting) => ({
        ...setting,
        spec_signature: buildExperimentSpecSignature({
          window: setting.window,
          experiment: setting.experiment,
        }),
      })),
    [],
  );
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [experimentStates, setExperimentStates] = useState<ExperimentState[]>(
    [],
  );
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);
  const [lastTickResult, setLastTickResult] = useState<{
    submitted: number;
    polled: number;
    errors: string[];
  }>({ submitted: 0, polled: 0, errors: [] });
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  const statesByTag = useMemo(
    () =>
      new Map(
        experimentStates.map((state) => [state.experiment_tag, state]),
      ),
    [experimentStates],
  );

  async function handleInit() {
    setActionBusy(true);
    setActionStatus("init: syncing experiments");
    setActionErrors([]);
    const result = await ensureExperiments({
      settings: settingsWithSignature,
    });
    setActionErrors(result.errors);
    setActionStatus(
      result.errors.length > 0
        ? `init: ${result.errors.length} error(s)`
        : "init: ok",
    );
    setActionBusy(false);
  }

  function getRunnableTags(): string[] {
    const tags: string[] = [];
    for (const setting of settingsWithSignature) {
      const tag = setting.experiment.experiment_tag;
      const state = statesByTag.get(tag);
      if (state && state.exists) {
        const specMatch =
          state.spec_signature &&
          state.spec_signature === setting.spec_signature;
        if (!specMatch) continue;
        if ((state.run_count ?? 0) > 0) continue;
        tags.push(tag);
        continue;
      }
      tags.push(tag);
    }
    return tags;
  }

  async function handleRun() {
    const tags = getRunnableTags();
    if (tags.length === 0) {
      setActionStatus("run: no missing runs");
      return;
    }
    setActionBusy(true);
    setActionStatus(`run: creating ${tags.length} run(s)`);
    setActionErrors([]);
    const result = await createRunsForTags({ experiment_tags: tags });
    setActionErrors(result.errors);
    setActionStatus(
      result.errors.length > 0
        ? `run: ${result.errors.length} error(s)`
        : "run: ok",
    );
    setActionBusy(false);
  }

  function getEvidenceTargets(): Array<{
    experiment_tag: string;
    evidence_limit: number;
  }> {
    const targets: Array<{ experiment_tag: string; evidence_limit: number }> =
      [];
    for (const setting of settingsWithSignature) {
      const tag = setting.experiment.experiment_tag;
      const state = statesByTag.get(tag);
      if (!state || !state.exists) continue;
      const specMatch =
        state.spec_signature &&
        state.spec_signature === setting.spec_signature;
      if (!specMatch) continue;
      const evidenceTotal = state.evidence_total ?? 0;
      const evidenceNeutralized = state.evidence_neutralized ?? 0;
      const needsNeutralized =
        setting.experiment.config.evidence_view === "neutralized" ||
        setting.experiment.config.evidence_view === "abstracted";
      const hasEnoughEvidence = evidenceTotal >= setting.evidence_limit;
      const hasEnoughNeutralized = !needsNeutralized
        ? true
        : evidenceNeutralized >= setting.evidence_limit;
      if (hasEnoughEvidence && hasEnoughNeutralized) continue;
      targets.push({
        experiment_tag: tag,
        evidence_limit: setting.evidence_limit,
      });
    }
    return targets;
  }

  async function handleEvidence() {
    const targets = getEvidenceTargets();
    if (targets.length === 0) {
      setActionStatus("evidence: nothing to do");
      return;
    }
    setActionBusy(true);
    setActionStatus(`evidence: collecting for ${targets.length} experiment(s)`);
    setActionErrors([]);
    const result = await collectEvidenceForTags({ items: targets });
    setActionErrors(result.errors);
    setActionStatus(
      result.errors.length > 0
        ? `evidence: ${result.errors.length} error(s)`
        : "evidence: ok",
    );
    setActionBusy(false);
  }

  async function handleBootstrap() {
    setActionBusy(true);
    setActionStatus("bootstrap: init + run");
    setActionErrors([]);
    const initResult = await ensureExperiments({
      settings: settingsWithSignature,
    });
    const tags = getRunnableTags();
    const runResult =
      tags.length > 0 ? await createRunsForTags({ experiment_tags: tags }) : {
        run_ids: [],
        errors: [],
      };
    const errors = [...initResult.errors, ...runResult.errors];
    setActionErrors(errors);
    setActionStatus(
      errors.length > 0
        ? `bootstrap: ${errors.length} error(s)`
        : "bootstrap: ok",
    );
    setActionBusy(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const [runRows, queue, states] = await Promise.all([
          httpClient.query(api.lab.listRuns, {}),
          httpClient.query(api.lab.getQueueStats, {}),
          httpClient.query(api.lab.getExperimentStates, {
            experiment_tags: settingsWithSignature.map(
              (setting) => setting.experiment.experiment_tag,
            ),
          }),
        ]);
        if (cancelled) return;
        setRuns(runRows);
        setQueueStats(queue);
        setExperimentStates(states);
      } catch (err) {
        if (cancelled) return;
        setLastTickResult((prev) => ({
          ...prev,
          errors: [
            `refresh: ${err instanceof Error ? err.message : String(err)}`,
          ],
        }));
      }
    }

    void refresh();
    const interval = setInterval(
      refresh,
      supervisor.getConfig().poll_interval_ms,
    );
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [supervisor]);

  useEffect(() => {
    let active = true;

    async function loop() {
      while (active) {
        const result = await supervisor.tick();
        if (!active) return;
        setLastTickAt(Date.now());
        setLastTickResult({
          submitted: result.submitted_batches,
          polled: result.polled_batches,
          errors: result.errors,
        });
        await new Promise((resolve) =>
          setTimeout(resolve, supervisor.getConfig().poll_interval_ms),
        );
      }
    }

    void loop();
    return () => {
      active = false;
    };
  }, [supervisor]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text>judge-gym · Lab (press q to exit)</Text>
      <Text>
        Actions: [i] init · [e] evidence · [r] create runs · [b] init+run · [q] quit
      </Text>
      <Text>
        Poll interval: {supervisor.getConfig().poll_interval_ms}ms · Max batch:
        {` ${supervisor.getConfig().max_batch_size}`} · Max new/tick:
        {` ${supervisor.getConfig().max_new_batches_per_tick}`}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          Last tick: {lastTickAt ? formatTimestamp(lastTickAt) : "—"} · Submitted:{" "}
          {lastTickResult.submitted} · Polled: {lastTickResult.polled}
        </Text>
        {lastTickResult.errors.length > 0 && (
          <Text color="red">
            Errors: {lastTickResult.errors.slice(0, 3).join(" | ")}
          </Text>
        )}
        {actionStatus && (
          <Text>
            Action: {actionStatus}
            {actionBusy ? " (busy)" : ""}
          </Text>
        )}
        {actionErrors.length > 0 && (
          <Text color="red">
            Action errors: {actionErrors.slice(0, 3).join(" | ")}
          </Text>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>Configs (source of truth)</Text>
        {settingsWithSignature.length === 0 && <Text dimColor>  (none)</Text>}
        {settingsWithSignature.map((setting) => {
          const state = statesByTag.get(setting.experiment.experiment_tag);
          const specMatch =
            state?.spec_signature &&
            state.spec_signature === setting.spec_signature;
          const statusLabel = !state || !state.exists
            ? "MISSING"
            : specMatch
              ? "OK"
              : "DRIFT";
          const evidenceTotal = state?.evidence_total ?? 0;
          const evidenceNeutralized = state?.evidence_neutralized ?? 0;
          const evidenceTarget = setting.evidence_limit;
          const windowLabel = `${setting.window.start_date}..${setting.window.end_date} ${setting.window.country} ${setting.window.concept}`;
          const rubricStatus = state?.rubric?.parse_status ?? "missing";
          const runSummary = state?.latest_run
            ? `${state.latest_run.status} · stage: ${
                state.latest_run.current_stage ?? "—"
              }`
            : "none";
          return (
            <Text key={setting.experiment.experiment_tag}>
              {`  [${statusLabel}] ${setting.experiment.experiment_tag} · window ${windowLabel} · evidence ${evidenceTotal}/${evidenceTarget} (neutralized ${evidenceNeutralized}) · rubric ${rubricStatus} · runs ${
                state?.run_count ?? 0
              } (running ${state?.running_count ?? 0}) · latest ${runSummary}`}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>Runs</Text>
        {runs.length === 0 && <Text dimColor>  (none)</Text>}
        {runs.map((run) => (
          <Text key={run.run_id}>
            {`  ${run.experiment_tag} · ${run.status} (desired: ${run.desired_state}) · stage: ${
              run.current_stage ?? "—"
            } · stop: ${run.stop_at_stage ?? "—"} · updated: ${
              formatTimestamp(run.updated_at)
            }`}
          </Text>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>Queue</Text>
        {queueStats ? (
          <>
            <Text>
              {`  queued: ${queueStats.totals.queued ?? 0} · submitted: ${
                queueStats.totals.submitted ?? 0
              } · completed: ${queueStats.totals.completed ?? 0} · error: ${
                queueStats.totals.error ?? 0
              }`}
            </Text>
            {Object.entries(queueStats.by_stage)
              .map(([stage, counts]) => ({
                stage,
                counts,
              }))
              .filter((row) => (row.counts.queued ?? 0) > 0)
              .slice(0, 6)
              .map((row) => (
                <Text key={`stage:${row.stage}`}>
                  {`  ${row.stage} · queued ${row.counts.queued ?? 0} · submitted ${
                    row.counts.submitted ?? 0
                  } · completed ${row.counts.completed ?? 0} · error ${
                    row.counts.error ?? 0
                  }`}
                </Text>
              ))}
            {queueStats.by_provider_model.length > 0 ? (
              queueStats.by_provider_model
                .sort((a, b) => b.queued - a.queued)
                .slice(0, 6)
                .map((row) => (
                  <Text key={`${row.provider}:${row.model}`}>
                    {`  ${row.provider}:${row.model} · queued ${row.queued}`}
                  </Text>
                ))
            ) : (
              <Text dimColor>  (no queued requests)</Text>
            )}
          </>
        ) : (
          <Text dimColor>  (loading...)</Text>
        )}
      </Box>
    </Box>
  );
}

render(<App />);
