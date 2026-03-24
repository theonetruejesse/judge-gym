"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@judge-gym/engine-convex";
import { STATUS_COLORS, STATUS_COLORS_MUTED } from "@/lib/ui-maps";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LabNavbar from "@/components/lab_navbar";

const statuses = [
  "start",
  "queued",
  "running",
  "paused",
  "completed",
  "error",
  "canceled",
];
const statusOrder = new Map(statuses.map((status, index) => [status, index]));

type ExperimentListItem = {
  experiment_id: string;
  experiment_tag?: string;
  evidence_set_tag: string | null;
  evidence_set_quality_label: string;
  evidence_set_source_kind: string;
  rubric_config: {
    model: string;
    scale_size: number;
    concept: string;
  };
  scoring_config: {
    model: string;
    method: string;
    abstain_enabled: boolean;
    evidence_view: string;
    randomizations: string[];
  };
  total_count: number;
  evidence_selected_count: number;
  status: string;
  latest_run?: {
    run_id: string;
    status: string;
    current_stage: string;
    target_count: number;
    completed_count: number;
    current_stage_progress: {
      completed: number;
      failed: number;
      pending: number;
      total: number;
      status: string;
    };
    created_at: number;
    has_failures: boolean;
  };
};

type EvidenceUniverseItem = {
  universe_id: string;
  universe_tag: string;
  kind: string;
  title: string;
  status: string;
  acquisition_spec_count: number;
  acquisition_run_count: number;
  evidence_set_count: number;
  candidate_count: number;
  item_count: number;
  latest_run_status: string | null;
};

export default function EvidenceHomePage() {
  const router = useRouter();
  const startExperimentRun = useMutation(api.packages.lab.startExperimentRun);

  const experiments = useQuery(api.packages.lab.listExperiments, {}) as
    | ExperimentListItem[]
    | undefined;
  const universes = useQuery(api.packages.evidence.listEvidenceUniverses, {}) as
    | EvidenceUniverseItem[]
    | undefined;

  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const experimentsLoading = experiments === undefined;
  const experimentRows = experiments ?? [];
  const filteredBase =
    statusFilter.length === 0
      ? experimentRows
      : experimentRows.filter((experiment) => statusFilter.includes(experiment.status));
  const filtered = filteredBase
    .slice()
    .sort(
      (left, right) =>
        (statusOrder.get(left.status) ?? statuses.length) -
        (statusOrder.get(right.status) ?? statuses.length),
    );

  const universesLoading = universes === undefined;
  const universeRows = universes ?? [];

  const toggleFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((value) => value !== status)
        : [...prev, status],
    );
  };

  const promptForTargetCount = () => {
    const sampleInput = window.prompt("Sample count", "10");
    if (sampleInput === null) return null;
    const target_count = Number(sampleInput);
    if (!Number.isFinite(target_count) || target_count < 1) {
      window.alert("Sample count must be a positive number.");
      return null;
    }
    return target_count;
  };

  const handleStart = async (experimentId: string) => {
    try {
      const target_count = promptForTargetCount();
      if (!target_count) return;
      await startExperimentRun({ experiment_id: experimentId, target_count });
    } catch (error) {
      console.error("Failed to start experiment", error);
    }
  };

  const renderRunSummary = (run?: ExperimentListItem["latest_run"]) => {
    if (!run) {
      return <span className="text-xs opacity-40">No run</span>;
    }

    const stageProgress = run.current_stage_progress;
    return (
      <div className="space-y-0.5">
        <div className="text-[10px] uppercase tracking-wider opacity-60">
          {run.current_stage}
        </div>
        <div className="text-xs opacity-75">
          {stageProgress.completed}/{stageProgress.total} {stageProgress.status}
        </div>
        <div className="text-[10px] opacity-45">
          pending {stageProgress.pending}
          {stageProgress.failed > 0 ? ` · failed ${stageProgress.failed}` : ""}
          {run.completed_count > 0
            ? ` · samples ${run.completed_count}/${run.target_count}`
            : ""}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-6">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Experiments
              </p>
              <p className="text-xs opacity-60">
                {filtered.length} active rows
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="text-[10px] uppercase tracking-wider"
            >
              <Link href="/editor/experiment">New Experiment</Link>
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest opacity-50">
              Status Filters
            </span>
            {statuses.map((status) => {
              const active = statusFilter.includes(status);
              const activeColor =
                STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#6b7280";
              const mutedColor =
                STATUS_COLORS_MUTED[
                  status as keyof typeof STATUS_COLORS_MUTED
                ] ?? "#6b7280";
              return (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(status)}
                  className="h-8 px-2 text-[10px] uppercase tracking-wider"
                  style={{
                    backgroundColor: active
                      ? `${activeColor}30`
                      : `${mutedColor}10`,
                    color: active ? activeColor : mutedColor,
                    borderColor: active
                      ? `${activeColor}50`
                      : `${mutedColor}30`,
                  }}
                >
                  {status}
                </Button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded border border-border bg-card/80">
            <Table>
              <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <TableRow>
                  <TableHead className="w-20 text-center">Status</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Latest Run</TableHead>
                  <TableHead>Rubric</TableHead>
                  <TableHead>Scoring</TableHead>
                  <TableHead>Concept</TableHead>
                  <TableHead>Evidence Set</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Evidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experimentsLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-xs opacity-50">
                      Loading experiments...
                    </TableCell>
                  </TableRow>
                )}
                {!experimentsLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-xs opacity-50">
                      No experiments found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((row) => {
                  const statusColor =
                    STATUS_COLORS[row.status as keyof typeof STATUS_COLORS] ??
                    "#6b7280";
                  return (
                    <TableRow
                      key={row.experiment_id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => router.push(`/experiment/${row.experiment_id}`)}
                    >
                      <TableCell className="text-center">
                        <span
                          className="inline-block rounded px-2 py-1 text-[10px] uppercase tracking-wider"
                          style={{
                            backgroundColor: `${statusColor}20`,
                            color: statusColor,
                          }}
                        >
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.experiment_tag ?? row.experiment_id}
                      </TableCell>
                      <TableCell>{renderRunSummary(row.latest_run)}</TableCell>
                      <TableCell className="text-xs">
                        {row.rubric_config.model} · {row.rubric_config.scale_size}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.scoring_config.model} · {row.scoring_config.method}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.rubric_config.concept}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="space-y-0.5">
                          <div>{row.evidence_set_tag ?? "—"}</div>
                          <div className="text-[10px] opacity-45">
                            {row.evidence_set_source_kind} · {row.evidence_set_quality_label}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {row.total_count}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {row.evidence_selected_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStart(row.experiment_id);
                            }}
                            className="h-8 px-2 text-[10px] uppercase tracking-wider"
                          >
                            Start
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Universes
              </p>
              <p className="text-xs opacity-60">{universeRows.length} universes</p>
            </div>
            <Button
              asChild
              variant="outline"
              className="text-[10px] uppercase tracking-wider"
            >
              <Link href="/editor/evidence">New Media Cloud Query</Link>
            </Button>
          </div>

          <div className="overflow-hidden rounded border border-border bg-card/80">
            <Table>
              <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <TableRow>
                  <TableHead>Universe</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Candidates</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Sets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {universesLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs opacity-50">
                      Loading evidence universes...
                    </TableCell>
                  </TableRow>
                )}
                {!universesLoading && universeRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs opacity-50">
                      No evidence universes found.
                    </TableCell>
                  </TableRow>
                )}
                {universeRows.map((universe) => {
                  const status = universe.latest_run_status ?? universe.status;
                  const statusColor =
                    STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#6b7280";
                  const mutedColor =
                    STATUS_COLORS_MUTED[status as keyof typeof STATUS_COLORS_MUTED]
                    ?? "#6b7280";
                  return (
                    <TableRow
                      key={universe.universe_id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => router.push(`/evidence/${universe.universe_id}`)}
                    >
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium">{universe.title}</div>
                          <div className="text-[10px] opacity-45">
                            {universe.universe_tag}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{universe.kind}</TableCell>
                      <TableCell className="text-right text-xs">
                        {universe.candidate_count}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {universe.item_count}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {universe.evidence_set_count}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span
                          className="rounded px-2 py-1 text-[10px] uppercase tracking-wider"
                          style={{
                            backgroundColor: `${mutedColor}20`,
                            color: statusColor,
                          }}
                        >
                          {status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/evidence/${universe.universe_id}`);
                          }}
                          className="h-8 px-2 text-[10px] uppercase tracking-wider"
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
