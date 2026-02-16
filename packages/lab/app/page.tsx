"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import { STATUS_COLORS, STATUS_COLORS_MUTED, TASK_TYPE_LABELS } from "@/lib/ui";
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

const statuses = ["pending", "running", "paused", "complete", "canceled"];
const statusOrder = new Map(statuses.map((status, index) => [status, index]));
const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

type ExperimentListItem = {
  experiment_id: string;
  experiment_tag?: string;
  task_type: string;
  status: string;
  active_run_id?: string;
  evidence_batch_id?: string;
  window_id: string;
  window_tag?: string;
  run_counts?: {
    sample_count: number;
    evidence_cap: number;
  };
  evidence_bound_count?: number;
  evidence_window?: {
    start_date: string;
    end_date: string;
    country: string;
    concept: string;
    model_id: string;
  };
};

type EvidenceWindowItem = {
  window_id: string;
  start_date: string;
  end_date: string;
  country: string;
  concept: string;
  model_id: string;
  window_tag?: string;
  evidence_count: number;
};

export default function RouteOneExperimentsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const startExperiment = useMutation(api.lab.startExperiment);
  const updateRunState = useMutation(api.lab.updateRunState);

  const experiments = useQuery(
    api.lab.listExperiments,
    hasConvex ? {} : "skip",
  ) as ExperimentListItem[] | undefined;

  const windows = useQuery(
    api.lab.listEvidenceWindows,
    hasConvex ? {} : "skip",
  ) as EvidenceWindowItem[] | undefined;

  const experimentsLoading = hasConvex && experiments === undefined;
  const windowsLoading = hasConvex && windows === undefined;

  const experimentRows = experiments ?? [];
  const windowRows = windows ?? [];

  const filteredBase =
    statusFilter.length === 0
      ? experimentRows
      : experimentRows.filter((e) => statusFilter.includes(e.status));
  const filtered = filteredBase
    .slice()
    .sort(
      (a, b) =>
        (statusOrder.get(a.status) ?? statuses.length) -
        (statusOrder.get(b.status) ?? statuses.length),
    );

  const toggleFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  const promptForRunCounts = () => {
    const sampleInput = window.prompt("Sample count", "10");
    if (sampleInput === null) return null;
    const sample_count = Number(sampleInput);
    if (!Number.isFinite(sample_count) || sample_count < 1) {
      window.alert("Sample count must be a positive number.");
      return null;
    }
    const evidenceInput = window.prompt("Evidence cap", "10");
    if (evidenceInput === null) return null;
    const evidence_cap = Number(evidenceInput);
    if (!Number.isFinite(evidence_cap) || evidence_cap < 1) {
      window.alert("Evidence cap must be a positive number.");
      return null;
    }
    return { sample_count, evidence_cap };
  };

  const handleStart = async (experimentId: string) => {
    try {
      const run_counts = promptForRunCounts();
      if (!run_counts) return;
      await startExperiment({ experiment_id: experimentId, run_counts });
    } catch (error) {
      console.error("Failed to start experiment", error);
    }
  };

  const handleRunState = async (
    runId: string,
    desired_state: "running" | "paused",
  ) => {
    try {
      await updateRunState({ run_id: runId, desired_state });
    } catch (error) {
      console.error("Failed to update run state", error);
    }
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
            <Button asChild variant="outline" className="text-[10px] uppercase tracking-wider">
              <Link href="/editor/experiment">New Experiment</Link>
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest opacity-50">
              Status Filters
            </span>
            {statuses.map((status) => {
              const active = statusFilter.includes(status);
              const activeColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
              const mutedColor =
                STATUS_COLORS_MUTED[status as keyof typeof STATUS_COLORS_MUTED];
              return (
                <Button
                  key={status}
                  type="button"
                  variant="outline"
                  onClick={() => toggleFilter(status)}
                  className="h-8 px-2 text-[10px] uppercase tracking-wider"
                  style={{
                    backgroundColor: active ? `${activeColor}30` : `${mutedColor}10`,
                    color: active ? activeColor : mutedColor,
                    borderColor: active ? `${activeColor}50` : `${mutedColor}30`,
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
                  <TableHead>Task</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead className="text-right">Evidence Cap</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experimentsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs opacity-50">
                      Loading experiments...
                    </TableCell>
                  </TableRow>
                )}
                {!experimentsLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs opacity-50">
                      No experiments found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((exp) => (
                  <TableRow
                    key={exp.experiment_id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/experiment/${exp.experiment_id}`)}
                  >
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center" title={exp.status}>
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[
                                exp.status as keyof typeof STATUS_COLORS
                              ] ?? "#6b7280",
                          }}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {exp.experiment_tag ?? exp.experiment_id}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {TASK_TYPE_LABELS[exp.task_type] ?? exp.task_type}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {exp.window_tag ?? "—"}
                    </TableCell>
                    <TableCell className="text-right opacity-70">
                      {exp.run_counts?.sample_count ?? "—"}
                    </TableCell>
                    <TableCell className="text-right opacity-70">
                      {exp.run_counts?.evidence_cap ?? "—"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {exp.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px] uppercase tracking-wider"
                            onClick={() => handleStart(exp.experiment_id)}
                          >
                            Start
                          </Button>
                        )}
                        {exp.status === "running" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px] uppercase tracking-wider"
                            onClick={() =>
                              exp.active_run_id &&
                              handleRunState(exp.active_run_id, "paused")
                            }
                            disabled={!exp.active_run_id}
                          >
                            Pause
                          </Button>
                        )}
                        {exp.status === "paused" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px] uppercase tracking-wider"
                            onClick={() =>
                              exp.active_run_id &&
                              handleRunState(exp.active_run_id, "running")
                            }
                            disabled={!exp.active_run_id}
                          >
                            Resume
                          </Button>
                        )}
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[10px] uppercase tracking-wider"
                        >
                          <Link href={`/editor/experiment?clone_id=${exp.experiment_id}`}>
                            Clone
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Windows
              </p>
              <p className="text-xs opacity-60">{windowRows.length} windows</p>
            </div>
            <Button asChild variant="outline" className="text-[10px] uppercase tracking-wider">
              <Link href="/editor/window">New Window</Link>
            </Button>
          </div>

          <div className="overflow-hidden rounded border border-border bg-card/80">
            <Table>
              <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <TableRow>
                  <TableHead>Window</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead className="text-right">Evidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {windowsLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-xs opacity-50">
                      Loading evidence windows...
                    </TableCell>
                  </TableRow>
                )}
                {!windowsLoading && windowRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-xs opacity-50">
                      No evidence windows found.
                    </TableCell>
                  </TableRow>
                )}
                {windowRows.map((window) => (
                  <TableRow
                    key={window.window_id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/evidence/${window.window_id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {window.window_tag ?? "—"}
                    </TableCell>
                    <TableCell className="opacity-70">{window.country}</TableCell>
                    <TableCell className="opacity-70">{window.model_id}</TableCell>
                    <TableCell className="opacity-70">
                      {`${window.start_date} -> ${window.end_date}`}
                    </TableCell>
                    <TableCell className="text-right opacity-70">
                      {window.evidence_count ?? 0}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] uppercase tracking-wider"
                      >
                        <Link href={`/editor/window?clone_id=${window.window_id}`}>
                          Clone
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
