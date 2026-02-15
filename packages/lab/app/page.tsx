"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-card/80 px-6 py-4">
        <div>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            judge-gym
          </h1>
        </div>
      </header>

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
                  <TableHead>Concept</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Window</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experimentsLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-xs opacity-50">
                      Loading experiments...
                    </TableCell>
                  </TableRow>
                )}
                {!experimentsLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-xs opacity-50">
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
                      {exp.evidence_window?.concept ?? "—"}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {TASK_TYPE_LABELS[exp.task_type] ?? exp.task_type}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {exp.evidence_window
                        ? `${exp.evidence_window.country} · ${exp.evidence_window.start_date}`
                        : exp.window_tag ?? exp.window_id}
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
                  <TableHead>Concept</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead className="text-right">Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {windowsLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-xs opacity-50">
                      Loading evidence windows...
                    </TableCell>
                  </TableRow>
                )}
                {!windowsLoading && windowRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-xs opacity-50">
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
                      {window.concept}
                    </TableCell>
                    <TableCell className="opacity-70">{window.country}</TableCell>
                    <TableCell className="opacity-70">{window.model_id}</TableCell>
                    <TableCell className="opacity-70">
                      {window.window_tag ??
                        `${window.start_date} -> ${window.end_date}`}
                    </TableCell>
                    <TableCell className="text-right opacity-70">
                      {window.evidence_count ?? 0}
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
