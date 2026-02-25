"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
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
  evidence_selected_count: number;
  window_count: number;
  status: string;
  latest_run?: {
    run_id: string;
    status: string;
    current_stage: string;
    target_count: number;
    created_at: number;
  };
};

type EvidenceWindowItem = {
  window_id: string;
  start_date: string;
  end_date: string;
  country: string;
  query: string;
  model: string;
  window_tag?: string;
  evidence_count: number;
  evidence_status:
    | "scraping"
    | "cleaning"
    | "neutralizing"
    | "abstracting"
    | "ready";
};

export default function EvidenceHomePage() {
  const router = useRouter();
  const startExperiment = useMutation(api.packages.lab.startExperiment);

  const experiments = useQuery(
    api.packages.lab.listExperiments,
    {},
  ) as ExperimentListItem[] | undefined;
  const windows = useQuery(
    api.packages.lab.listEvidenceWindows,
    {},
  ) as EvidenceWindowItem[] | undefined;

  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const experimentsLoading = experiments === undefined;
  const experimentRows = experiments ?? [];
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

  const windowsLoading = windows === undefined;
  const windowRows = windows ?? [];

  const toggleFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  const buildWindowCloneHref = (window: EvidenceWindowItem) => {
    const params = new URLSearchParams({
      query: window.query,
      country: window.country,
      start_date: window.start_date,
      end_date: window.end_date,
      model: window.model,
    });
    return `/editor/window?${params.toString()}`;
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
      await startExperiment({ experiment_id: experimentId, target_count });
    } catch (error) {
      console.error("Failed to start experiment", error);
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
                STATUS_COLORS_MUTED[status as keyof typeof STATUS_COLORS_MUTED] ??
                "#6b7280";
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
                  <TableHead>Rubric</TableHead>
                  <TableHead>Scoring</TableHead>
                  <TableHead>Concept</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead className="text-right">Evidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experimentsLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-xs opacity-50">
                      Loading experiments...
                    </TableCell>
                  </TableRow>
                )}
                {!experimentsLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-xs opacity-50">
                      No experiments found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((exp) => (
                  <TableRow
                    key={exp.experiment_id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/experiment/${exp.experiment_id}`)
                    }
                  >
                    <TableCell className="text-center">
                      <span
                        className="inline-flex items-center justify-center"
                        title={exp.status}
                      >
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
                      {exp.rubric_config.model}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {exp.scoring_config.model}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {exp.rubric_config.concept}
                    </TableCell>
                    <TableCell className="text-right opacity-70">
                      {exp.latest_run?.target_count ?? "—"}
                    </TableCell>
                    <TableCell className="text-right opacity-70">
                      {exp.evidence_selected_count ?? 0}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {exp.status !== "running" &&
                          exp.status !== "paused" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px] uppercase tracking-wider"
                              onClick={() => handleStart(exp.experiment_id)}
                            >
                              Start
                            </Button>
                          )}
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
              <p className="text-xs opacity-60">
                {windowRows.length} windows
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="text-[10px] uppercase tracking-wider"
            >
              <Link href="/editor/window">New Window</Link>
            </Button>
          </div>

          <div className="overflow-hidden rounded border border-border bg-card/80">
            <Table>
              <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Evidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {windowsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs opacity-50">
                      Loading evidence windows...
                    </TableCell>
                  </TableRow>
                )}
                {!windowsLoading && windowRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs opacity-50">
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
                    <TableCell className="opacity-70">
                      {window.country}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {window.model}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {`${window.start_date} -> ${window.end_date}`}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {window.evidence_status ?? "—"}
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
                        <Link href={buildWindowCloneHref(window)}>Clone</Link>
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
