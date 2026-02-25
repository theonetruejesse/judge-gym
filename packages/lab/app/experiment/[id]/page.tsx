"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import {
  RANDOMIZATION_LABELS,
  SCORING_METHOD_LABELS,
  STATUS_COLORS,
  VIEW_LABELS,
} from "@/lib/ui-maps";
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
  rubric_config: {
    model: string;
    scale_size: number;
    concept: string;
  };
  scoring_config: {
    model: string;
    method: string;
    randomizations: string[];
    evidence_view: string;
    abstain_enabled: boolean;
  };
  status: string;
};

type ExperimentSummary = {
  experiment_id: string;
  experiment_tag?: string;
  rubric_config: {
    model: string;
    scale_size: number;
    concept: string;
  };
  scoring_config: {
    model: string;
    method: string;
    randomizations: string[];
    evidence_view: string;
    abstain_enabled: boolean;
  };
  evidence_selected_count: number;
  window_count: number;
  run_count: number;
  status: string;
  latest_run?: {
    run_id: string;
    status: string;
    current_stage: string;
    target_count: number;
    created_at: number;
  };
  counts: {
    samples: number;
    rubrics: number;
    rubric_critics: number;
    scores: number;
    score_critics: number;
  };
};

type EvidenceItem = {
  evidence_id: string;
  window_id: string;
  title: string;
  url: string;
  created_at: number;
  window_tag?: string;
};

type RunSummary = {
  run_id: string;
  status: string;
  current_stage: string;
  target_count: number;
  stages: Array<{
    stage: string;
    status: string;
    total: number;
    completed: number;
    failed: number;
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

export default function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [tab, setTab] = useState<"config" | "runs" | "evidence">("config");
  const [runSampleCount, setRunSampleCount] = useState<string>("1");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
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
    api.packages.lab.listExperiments,
    {},
  ) as ExperimentListItem[] | undefined;
  const experimentsLoading = experiments === undefined;
  const experimentRows = experiments ?? [];

  const selected =
    experimentRows.find((e) => e.experiment_id === resolvedParams?.id) ??
    experimentRows[0];

  const summary = useQuery(
    api.packages.lab.getExperimentSummary,
    selected ? { experiment_id: selected.experiment_id } : "skip",
  ) as ExperimentSummary | undefined;

  const evidenceItems = useQuery(
    api.packages.lab.listExperimentEvidence,
    selected ? { experiment_id: selected.experiment_id } : "skip",
  ) as EvidenceItem[] | undefined;

  const runSummary = useQuery(
    api.packages.lab.getRunSummary,
    summary?.latest_run?.run_id
      ? { run_id: summary.latest_run.run_id }
      : "skip",
  ) as RunSummary | undefined;

  const startExperiment = useMutation(api.packages.lab.startExperiment);

  useEffect(() => {
    if (!summary?.latest_run?.target_count) return;
    setRunSampleCount(String(summary.latest_run.target_count));
  }, [summary?.latest_run?.target_count]);

  const runProgress = useMemo(() => {
    if (!runSummary?.stages) return 0;
    const totals = runSummary.stages.reduce(
      (acc, stage) => {
        acc.total += stage.total;
        acc.done += stage.completed + stage.failed;
        return acc;
      },
      { total: 0, done: 0 },
    );
    if (totals.total === 0) return 0;
    return Math.round((totals.done / totals.total) * 100);
  }, [runSummary?.stages]);

  const handleStart = async () => {
    if (!selected) return;
    setActionMessage(null);
    const sampleCount = Number(runSampleCount);
    if (!Number.isFinite(sampleCount) || sampleCount < 1) {
      setActionMessage("Provide a valid sample count.");
      return;
    }
    try {
      await startExperiment({
        experiment_id: selected.experiment_id,
        target_count: sampleCount,
      });
      setActionMessage("Run started.");
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Failed to start run.",
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

  const summaryData = summary;
  const evidenceItemsData = evidenceItems ?? [];

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
                {selected.experiment_id} · {summaryData?.window_count ?? 0} windows
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: `${STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS]}20`,
                  color:
                    STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS],
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
              <Button
                size="sm"
                className="h-8 text-[10px] uppercase tracking-wider"
                onClick={handleStart}
              >
                Start
              </Button>
            </div>
          </div>
          {actionMessage && (
            <div className="mb-2 text-[10px] uppercase tracking-wider opacity-60">
              {actionMessage}
            </div>
          )}

          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <TabsList className="bg-card/80">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="runs">
                Runs ({summaryData?.run_count ?? 0})
              </TabsTrigger>
              <TabsTrigger value="evidence">
                Evidence ({evidenceItemsData.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config">
              <ConfigPanel summary={summaryData} />
            </TabsContent>
            <TabsContent value="runs">
              <RunsPanel runSummary={runSummary} runProgress={runProgress} />
            </TabsContent>
            <TabsContent value="evidence">
              <EvidencePanel evidenceItems={evidenceItemsData} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="flex h-7 flex-shrink-0 items-center justify-between border-t border-border bg-card/80 px-4 text-[10px] text-muted-foreground">
        <span>
          {experimentRows.length} experiments · {evidenceItemsData.length} evidence items
        </span>
        <span>Convex live · Last sync: just now</span>
      </footer>
    </div>
  );
}

function ConfigPanel({ summary }: { summary: ExperimentSummary | undefined }) {
  if (!summary) {
    return (
      <Card className="border-border px-6 py-10 text-center text-xs opacity-40">
        Loading configuration...
      </Card>
    );
  }

  const randomizations =
    summary.scoring_config.randomizations.length > 0
      ? summary.scoring_config.randomizations
          .map((item) => RANDOMIZATION_LABELS[item] ?? item)
          .join(", ")
      : "None";

  const rows: [string, string][] = [
    ["Rubric Model", summary.rubric_config.model],
    ["Scoring Model", summary.scoring_config.model],
    ["Concept", summary.rubric_config.concept],
    ["Scale Size", `${summary.rubric_config.scale_size}-point`],
    ["Evidence View", VIEW_LABELS[summary.scoring_config.evidence_view]],
    [
      "Scoring Method",
      SCORING_METHOD_LABELS[summary.scoring_config.method] ??
        summary.scoring_config.method,
    ],
    [
      "Abstain Enabled",
      summary.scoring_config.abstain_enabled ? "Yes" : "No",
    ],
    ["Randomizations", randomizations],
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card/80 p-4 text-xs">
        <span className="uppercase tracking-widest opacity-50">
          Evidence Selection
        </span>
        <div className="mt-2 flex flex-wrap gap-3">
          <span>Windows: {summary.window_count}</span>
          <span>Selected Evidence: {summary.evidence_selected_count}</span>
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
        <span className="uppercase tracking-widest opacity-50">Counts</span>
        <div className="mt-2 flex flex-wrap gap-3">
          <span>Samples: {summary.counts.samples}</span>
          <span>Rubrics: {summary.counts.rubrics}</span>
          <span>Rubric Critics: {summary.counts.rubric_critics}</span>
          <span>Scores: {summary.counts.scores}</span>
          <span>Score Critics: {summary.counts.score_critics}</span>
        </div>
      </Card>
    </div>
  );
}

function RunsPanel({
  runSummary,
  runProgress,
}: {
  runSummary: RunSummary | undefined;
  runProgress: number;
}) {
  if (!runSummary) {
    return (
      <Card className="border-border px-6 py-10 text-center text-xs opacity-40">
        No runs yet. Click Start to begin.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card/80">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <StatusDot status={runSummary.status} />
            <span className="text-xs font-medium text-foreground">
              {runSummary.run_id}
            </span>
            <span className="text-[10px] opacity-40">
              {runSummary.current_stage ?? "no stage"}
            </span>
            <span className="text-[10px] uppercase tracking-wider opacity-40">
              samples {runSummary.target_count}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32">
              <Progress value={runProgress} />
            </div>
            <span className="text-[11px] font-medium" style={{ color: "#ff6b35" }}>
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
                  {stage.completed}/{stage.total}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function EvidencePanel({ evidenceItems }: { evidenceItems: EvidenceItem[] }) {
  if (evidenceItems.length === 0) {
    return (
      <Card className="border-border px-6 py-10 text-center text-xs opacity-40">
        No evidence selected for this experiment yet.
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/80">
      <Table>
        <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Window</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evidenceItems.map((item) => (
            <TableRow key={item.evidence_id}>
              <TableCell className="text-xs">
                <div className="text-foreground">{item.title}</div>
                <div className="text-[10px] opacity-50">{item.url}</div>
              </TableCell>
              <TableCell className="text-xs opacity-70">
                {item.window_tag ?? item.window_id}
              </TableCell>
              <TableCell className="text-right text-xs opacity-60">
                {new Date(item.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
