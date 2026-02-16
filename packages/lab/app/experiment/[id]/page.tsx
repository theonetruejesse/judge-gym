"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import {
  NORMALIZATION_LEVELS,
  RANDOMIZATION_LABELS,
  SCORING_METHOD_LABELS,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
} from "@/lib/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LabNavbar from "@/components/lab_navbar";

type ExperimentListItem = {
  experiment_id: string;
  experiment_tag?: string;
  task_type: string;
  status: string;
  window_id: string;
  window_tag?: string;
  evidence_window?: {
    start_date: string;
    end_date: string;
    country: string;
    concept: string;
    model_id: string;
  };
};

type ExperimentState = {
  experiment_id: string;
  experiment_tag?: string;
  exists: boolean;
  status?: string;
  evidence_total?: number;
  evidence_neutralized?: number;
  evidence_selected_count?: number;
  run_count?: number;
  latest_run?: {
    run_id: string;
    status: string;
    desired_state: string;
    current_stage?: string;
    updated_at?: number;
  };
};

type ExperimentSummary = {
  experiment_id: string;
  experiment_tag?: string;
  window_id: string;
  rubric_model_id: string;
  scoring_model_id: string;
  concept: string;
  task_type: string;
  status: string;
  config: {
    rubric_stage: { scale_size: number; model_id: string };
    scoring_stage: {
      model_id: string;
      method: string;
      randomizations: string[];
      evidence_view: string;
      abstain_enabled: boolean;
    };
  };
  counts: {
    samples: number;
    scores: number;
    abstained: number;
    critics: number;
  };
};

type EvidenceItem = {
  evidence_id: string;
  position: number;
  title: string;
  url: string;
};

type RunListItem = {
  run_id: string;
  experiment_id: string;
  experiment_tag?: string;
  status: string;
  desired_state: string;
  current_stage?: string;
  stop_at_stage?: string;
  run_counts?: { sample_count: number };
  updated_at?: number;
};

type RunSummary = {
  run_id: string;
  status: string;
  desired_state: string;
  current_stage?: string;
  stop_at_stage?: string;
  run_counts?: { sample_count: number } | null;
  stages: Array<{
    stage: string;
    status: string;
    total_requests: number;
    completed_requests: number;
    failed_requests: number;
  }>;
};

function StatusDot({ status }: { status: string }) {
  const color =
    STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#6b7280";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

export default function RouteOneExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [tab, setTab] = useState<"config" | "runs" | "evidence">("config");
  const [evidenceLimit, setEvidenceLimit] = useState<string>("");
  const [runSampleCount, setRunSampleCount] = useState<string>("1");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [evidenceMessage, setEvidenceMessage] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null,
  );

  useEffect(() => {
    const maybePromise = params as unknown as {
      then?: (onfulfilled: (value: { id: string }) => void) => void;
    };
    if (typeof maybePromise.then === "function") {
      maybePromise.then(setResolvedParams);
    } else {
      setResolvedParams(params as unknown as { id: string });
    }
  }, [params]);

  const experiments = useQuery(
    api.lab.listExperiments,
    {},
  ) as ExperimentListItem[] | undefined;
  const experimentsLoading = experiments === undefined;

  const experimentRows = experiments ?? [];

  const selected =
    experimentRows.find((e) => e.experiment_id === resolvedParams?.id) ??
    experimentRows[0];

  const summary = useQuery(
    api.lab.getExperimentSummary,
    selected ? { experiment_id: selected.experiment_id } : "skip",
  ) as ExperimentSummary | undefined;
  const states = useQuery(
    api.lab.getExperimentStates,
    selected ? { experiment_ids: [selected.experiment_id] } : "skip",
  ) as ExperimentState[] | undefined;
  const state = states?.[0];

  const evidenceItems = useQuery(
    api.lab.listExperimentEvidence,
    selected ? { experiment_id: selected.experiment_id } : "skip",
  ) as EvidenceItem[] | undefined;
  const evidenceItemsData = evidenceItems ?? [];

  const activeRuns = useQuery(api.lab.listRuns, {}) as
    | RunListItem[]
    | undefined;
  const activeRunsForExperiment = (activeRuns ?? []).filter(
    (run) => run.experiment_id === selected?.experiment_id,
  );

  const summaryData = summary;
  const runSummary = useQuery(
    api.lab.getRunSummary,
    state?.latest_run?.run_id ? { run_id: state.latest_run.run_id } : "skip",
  ) as RunSummary | undefined;
  const runSummaryData = runSummary;

  const startExperiment = useMutation(api.lab.startExperiment);
  const updateRunState = useMutation(api.lab.updateRunState);
  const collectEvidence = useAction(api.lab.collectEvidence);

  useEffect(() => {
    if (!runSummaryData?.run_counts) return;
    setRunSampleCount(String(runSummaryData.run_counts.sample_count));
  }, [runSummaryData?.run_counts]);

  const runProgress = useMemo(() => {
    if (!runSummaryData?.stages) return 0;
    const totals = runSummaryData.stages.reduce(
      (acc, stage) => {
        acc.total += stage.total_requests;
        acc.done += stage.completed_requests + stage.failed_requests;
        return acc;
      },
      { total: 0, done: 0 },
    );
    if (totals.total === 0) return 0;
    return Math.round((totals.done / totals.total) * 100);
  }, [runSummaryData?.stages]);

  const handleStart = async () => {
    if (!selected) return;
    setActionMessage(null);
    const sampleCount = Number(runSampleCount);
    if (!Number.isFinite(sampleCount) || sampleCount < 1) {
      setActionMessage("Provide a valid sample count.");
      return;
    }
    try {
      const result = await startExperiment({
        experiment_id: selected.experiment_id,
        run_counts: { sample_count: sampleCount },
      });
      if (!result.ok) {
        setActionMessage(result.error ?? "Failed to start experiment.");
        return;
      }
      const started = result.started ?? result.run_ids?.length ?? 0;
      setActionMessage(
        started > 0
          ? `Started ${started} run${started === 1 ? "" : "s"}.`
          : "Run start queued.",
      );
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Failed to start experiment.",
      );
    }
  };

  const handlePause = async () => {
    if (!selected) return;
    const runningRuns = activeRunsForExperiment.filter(
      (run) => run.status === "running",
    );
    if (runningRuns.length === 0) {
      setActionMessage("No running runs to pause.");
      return;
    }
    setActionMessage(null);
    try {
      await Promise.all(
        runningRuns.map((run) =>
          updateRunState({ run_id: run.run_id, desired_state: "paused" }),
        ),
      );
      setActionMessage(
        `Pausing ${runningRuns.length} run${runningRuns.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Failed to pause run.",
      );
    }
  };

  const handleResume = async () => {
    if (!selected) return;
    const pausedRuns = activeRunsForExperiment.filter(
      (run) => run.status === "paused",
    );
    if (pausedRuns.length === 0) {
      setActionMessage("No paused runs to resume.");
      return;
    }
    setActionMessage(null);
    try {
      await Promise.all(
        pausedRuns.map((run) =>
          updateRunState({ run_id: run.run_id, desired_state: "running" }),
        ),
      );
      setActionMessage(
        `Resumed ${pausedRuns.length} run${pausedRuns.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Failed to resume run.",
      );
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    const cancellable = activeRunsForExperiment.filter(
      (run) => run.status !== "canceled" && run.status !== "complete",
    );
    if (cancellable.length === 0) {
      setActionMessage("No active runs to cancel.");
      return;
    }
    setActionMessage(null);
    try {
      await Promise.all(
        cancellable.map((run) =>
          updateRunState({ run_id: run.run_id, desired_state: "canceled" }),
        ),
      );
      setActionMessage(
        `Canceled ${cancellable.length} run${cancellable.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Failed to cancel run.",
      );
    }
  };

  const handleCollectEvidence = async () => {
    if (!selected) return;
    setEvidenceMessage(null);
    const parsed = Number(evidenceLimit);
    const evidence_limit =
      Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    try {
      const result = await collectEvidence({
        window_id: selected.window_id,
        evidence_limit,
      });
      setEvidenceMessage(`Collected ${result.collected} evidence.`);
    } catch (error) {
      setEvidenceMessage(
        error instanceof Error ? error.message : "Failed to collect evidence.",
      );
    }
  };

  if (experimentsLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <LabNavbar />
        <div className="px-6 py-12">
          <p className="text-sm">Loading experiments...</p>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <LabNavbar />
        <div className="px-6 py-12">
          <p className="text-sm">No experiments found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LabNavbar />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Experiment Detail
              </p>
              <h1
                className="text-xl font-bold tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-1-serif)" }}
              >
                {selected.experiment_tag ?? selected.experiment_id}
              </h1>
              <p className="mt-1 text-[11px] opacity-50">
                {selected.experiment_id} · window{" "}
                {selected.window_tag ?? selected.window_id}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: `${STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS]}20`,
                  color:
                    STATUS_COLORS[
                      selected.status as keyof typeof STATUS_COLORS
                    ],
                  borderColor: `${STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS]}40`,
                }}
              >
                {selected.status}
              </Badge>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-20 text-[10px]"
                  value={runSampleCount}
                  onChange={(event) => setRunSampleCount(event.target.value)}
                  placeholder="Samples"
                />
              </div>
              {state?.status === "running" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground"
                  onClick={handlePause}
                >
                  Pause
                </Button>
              ) : state?.status === "paused" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground"
                  onClick={handleResume}
                >
                  Resume
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-8 text-[10px] uppercase tracking-wider"
                  onClick={handleStart}
                >
                  Start
                </Button>
              )}
              {activeRunsForExperiment.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
          {actionMessage && (
            <div className="mb-2 text-[10px] uppercase tracking-wider opacity-60">
              {actionMessage}
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as typeof tab)}
          >
            <TabsList className="bg-card/80">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="runs">
                Runs ({state?.run_count ?? 0})
              </TabsTrigger>
              <TabsTrigger value="evidence">
                Evidence ({evidenceItemsData.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config">
              <ConfigPanel
                summary={summaryData}
                selected={selected}
                state={state}
              />
            </TabsContent>
            <TabsContent value="runs">
              <RunsPanel
                runSummary={runSummaryData}
                runProgress={runProgress}
                activeRuns={activeRunsForExperiment}
              />
            </TabsContent>
            <TabsContent value="evidence">
              <EvidencePanel
                selected={selected}
                summary={summaryData}
                state={state}
                evidenceItems={evidenceItemsData}
                evidenceLimit={evidenceLimit}
                onEvidenceLimitChange={setEvidenceLimit}
                onCollect={handleCollectEvidence}
                evidenceMessage={evidenceMessage}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="flex h-7 flex-shrink-0 items-center justify-between border-t border-border bg-card/80 px-4 text-[10px] text-muted-foreground">
        <span>
          {experimentRows.length} experiments · {evidenceItemsData.length}{" "}
          evidence items
        </span>
        <span>Convex live · Last sync: just now</span>
      </footer>
    </div>
  );
}

function ConfigPanel({
  summary,
  selected,
  state,
}: {
  summary:
    | {
        experiment_id: string;
        experiment_tag?: string;
        window_id: string;
        rubric_model_id: string;
        scoring_model_id: string;
        concept: string;
        task_type: string;
        status: string;
        config: {
          rubric_stage: { scale_size: number; model_id: string };
          scoring_stage: {
            model_id: string;
            method: string;
            randomizations: string[];
            evidence_view: string;
            abstain_enabled: boolean;
          };
        };
        counts: {
          samples: number;
          scores: number;
          abstained: number;
          critics: number;
        };
      }
    | undefined;
  selected: {
    evidence_window?: {
      start_date: string;
      end_date: string;
      country: string;
      concept: string;
      model_id: string;
    };
    window_id: string;
  };
  state:
    | {
        evidence_total?: number;
        evidence_neutralized?: number;
        evidence_selected_count?: number;
      }
    | undefined;
}) {
  if (!summary) {
    return (
      <Card className="border-border px-6 py-10 text-center text-xs opacity-40">
        Loading configuration...
      </Card>
    );
  }

  const randomizations =
    summary.config.scoring_stage.randomizations.length > 0
      ? summary.config.scoring_stage.randomizations
          .map((item) => RANDOMIZATION_LABELS[item] ?? item)
          .join(", ")
      : "None";

  const rows: [string, string][] = [
    ["Task Type", TASK_TYPE_LABELS[summary.task_type] ?? summary.task_type],
    ["Rubric Model", summary.config.rubric_stage.model_id],
    ["Scoring Model", summary.config.scoring_stage.model_id],
    ["Scale Size", `${summary.config.rubric_stage.scale_size}-point`],
    ["Evidence View", VIEW_LABELS[summary.config.scoring_stage.evidence_view]],
    [
      "Scoring Method",
      SCORING_METHOD_LABELS[summary.config.scoring_stage.method] ??
        summary.config.scoring_stage.method,
    ],
    [
      "Abstain Enabled",
      summary.config.scoring_stage.abstain_enabled ? "Yes" : "No",
    ],
    ["Randomizations", randomizations],
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card/80 p-4">
        <p
          className="mb-2 text-[10px] uppercase tracking-widest opacity-50"
          style={{ fontFamily: "var(--font-1-serif)" }}
        >
          Evidence Window
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span>
            {selected.evidence_window?.concept ?? "—"} ·{" "}
            {selected.evidence_window?.country ?? "—"}
          </span>
          <span className="opacity-60">
            {selected.evidence_window?.start_date ?? "—"} -{" "}
            {selected.evidence_window?.end_date ?? "—"}
          </span>
          <span className="opacity-60">
            {selected.evidence_window?.model_id ?? "—"}
          </span>
        </div>
        <div className="mt-2 text-[11px] opacity-50">
          Window ID: {selected.window_id}
        </div>
      </Card>

      <Card className="border-border bg-card/80">
        <Table>
          <TableBody>
            {rows.map(([label, value]) => (
              <TableRow key={label}>
                <TableCell className="w-52 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </TableCell>
                <TableCell className="text-xs text-foreground">
                  {value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="border-border bg-card/80 p-4 text-xs">
        <span className="uppercase tracking-widest opacity-50">
          Evidence Selection
        </span>
        <div className="mt-2 flex flex-wrap gap-3">
          <span>Total Evidence: {state?.evidence_total ?? 0}</span>
          <span>Neutralized: {state?.evidence_neutralized ?? 0}</span>
          <span>Selected: {state?.evidence_selected_count ?? 0}</span>
        </div>
      </Card>
    </div>
  );
}

function RunsPanel({
  runSummary,
  runProgress,
  activeRuns,
}: {
  runSummary:
    | {
        run_id: string;
        status: string;
        desired_state: string;
        current_stage?: string;
        stop_at_stage?: string;
        run_counts?: { sample_count: number } | null;
        stages: Array<{
          stage: string;
          status: string;
          total_requests: number;
          completed_requests: number;
          failed_requests: number;
        }>;
      }
    | undefined;
  runProgress: number;
  activeRuns: Array<{
    run_id: string;
    experiment_id: string;
    experiment_tag?: string;
    status: string;
    desired_state: string;
    current_stage?: string;
  }>;
}) {
  if (!runSummary && activeRuns.length === 0) {
    return (
      <Card className="border-border px-6 py-10 text-center text-xs opacity-40">
        No runs yet. Click Start to begin.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {runSummary && (
        <Card className="border-border bg-card/80">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <StatusDot status={runSummary.status} />
              <span className="text-xs font-medium text-foreground">
                {runSummary.run_id}
              </span>
              <span className="text-[10px] opacity-40">
                {runSummary.current_stage ?? "no stage"} · desired{" "}
                {runSummary.desired_state}
              </span>
              {runSummary.run_counts && (
                <span className="text-[10px] uppercase tracking-wider opacity-40">
                  samples {runSummary.run_counts.sample_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32">
                <Progress value={runProgress} />
              </div>
              <span
                className="text-[11px] font-medium"
                style={{ color: "#ff6b35" }}
              >
                {runProgress}%
              </span>
            </div>
          </div>

          <Table>
            <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runSummary.stages.map((stage) => (
                <TableRow key={stage.stage}>
                  <TableCell className="text-xs">{stage.stage}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={stage.status} />
                      <span className="text-[10px] uppercase tracking-wider opacity-60">
                        {stage.status}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs opacity-60">
                    {stage.completed_requests}/{stage.total_requests}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeRuns.length > 0 && (
        <Card className="border-border bg-card/80 p-4 text-xs">
          <p className="mb-2 text-[10px] uppercase tracking-widest opacity-50">
            Active Runs
          </p>
          <div className="space-y-1">
            {activeRuns.map((run) => (
              <div
                key={run.run_id}
                className="flex items-center justify-between"
              >
                <span>
                  {run.run_id} · {run.status}
                </span>
                <span className="opacity-60">{run.current_stage ?? "—"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function EvidencePanel({
  selected,
  summary,
  state,
  evidenceItems,
  evidenceLimit,
  onEvidenceLimitChange,
  onCollect,
  evidenceMessage,
}: {
  selected: {
    experiment_id: string;
    experiment_tag?: string;
    window_id: string;
    evidence_window?: {
      start_date: string;
      end_date: string;
      country: string;
      concept: string;
      model_id: string;
    };
  };
  summary:
    | {
        config: { scoring_stage: { evidence_view: string } };
      }
    | undefined;
  state:
    | {
        evidence_total?: number;
        evidence_neutralized?: number;
        evidence_selected_count?: number;
      }
    | undefined;
  evidenceItems:
    | Array<{
        evidence_id: string;
        position: number;
        title: string;
        url: string;
      }>
    | undefined;
  evidenceLimit: string;
  onEvidenceLimitChange: (value: string) => void;
  onCollect: () => void;
  evidenceMessage: string | null;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-border bg-card/80 p-4 text-xs">
        <p className="mb-2 text-[10px] uppercase tracking-widest opacity-50">
          Evidence Window
        </p>
        <div className="flex flex-wrap gap-3">
          <span>
            {selected.evidence_window?.concept ?? "—"} ·{" "}
            {selected.evidence_window?.country ?? "—"}
          </span>
          <span className="opacity-60">
            {selected.evidence_window?.start_date ?? "—"} -{" "}
            {selected.evidence_window?.end_date ?? "—"}
          </span>
          <span className="opacity-60">
            {selected.evidence_window?.model_id ?? "—"}
          </span>
          <span className="opacity-60">
            Evidence View:{" "}
            {summary
              ? VIEW_LABELS[summary.config.scoring_stage.evidence_view]
              : "—"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 opacity-60">
          <span>Total Evidence: {state?.evidence_total ?? 0}</span>
          <span>Neutralized: {state?.evidence_neutralized ?? 0}</span>
          <span>Selected: {state?.evidence_selected_count ?? 0}</span>
        </div>
      </Card>

      <div className="space-y-3">
        {(evidenceItems ?? []).length === 0 && (
          <Card className="border-border px-6 py-10 text-center text-xs opacity-40">
            No evidence selected for this experiment yet.
          </Card>
        )}
        {(evidenceItems ?? []).map((ev) => (
          <Card
            key={ev.evidence_id}
            className="border-border bg-card/80 p-4 transition hover:bg-muted/30"
          >
            <Link href={`/evidence/${selected.window_id}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {ev.position}. {ev.title}
                  </div>
                  <div className="mt-1 text-[11px] opacity-50">{ev.url}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider opacity-40">
                  {selected.experiment_tag ?? selected.experiment_id}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {NORMALIZATION_LEVELS.map((level) => {
                  const active =
                    level.key === summary?.config.scoring_stage.evidence_view;
                  return (
                    <Badge
                      key={level.key}
                      variant={active ? "default" : "secondary"}
                      className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider"
                      style={{
                        backgroundColor: active ? "#ff6b3530" : "#151a24",
                        color: active ? "#ff6b35" : "#7a8599",
                        borderColor: active ? "#ff6b3550" : "#1e2433",
                      }}
                    >
                      {VIEW_LABELS[level.key]}
                    </Badge>
                  );
                })}
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
