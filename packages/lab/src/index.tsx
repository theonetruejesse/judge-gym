import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import { api, httpClient } from "./helpers/clients";
import { EXPERIMENT_SETTINGS } from "./experiments";
import { bootstrapExperiments } from "./helpers/runner";
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
    }
  });

  const supervisor = useMemo(() => new LabSupervisor(), []);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);
  const [lastTickResult, setLastTickResult] = useState<{
    submitted: number;
    polled: number;
    errors: string[];
  }>({ submitted: 0, polled: 0, errors: [] });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const [runRows, queue] = await Promise.all([
          httpClient.query(api.lab.listRuns, {}),
          httpClient.query(api.lab.getQueueStats, {}),
        ]);
        if (cancelled) return;
        setRuns(runRows);
        setQueueStats(queue);
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
    const shouldBootstrap =
      process.env.LAB_BOOTSTRAP === "1" ||
      process.env.LAB_BOOTSTRAP === "true";
    if (!shouldBootstrap) return;

    const useNewRun =
      process.env.NEW_RUN === "1" || process.env.NEW_RUN === "true";

    void bootstrapExperiments({
      settings: EXPERIMENT_SETTINGS,
      useNewRun,
    }).catch((err) => {
      setLastTickResult((prev) => ({
        ...prev,
        errors: [
          ...prev.errors,
          `bootstrap: ${err instanceof Error ? err.message : String(err)}`,
        ],
      }));
    });
  }, []);

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
