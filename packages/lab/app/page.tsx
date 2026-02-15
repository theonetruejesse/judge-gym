"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import { STATUS_COLORS, STATUS_COLORS_MUTED, TASK_TYPE_LABELS } from "@/lib/ui";

const statuses = ["pending", "running", "paused", "complete", "canceled"];
const statusOrder = new Map(statuses.map((status, index) => [status, index]));
const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

type ExperimentListItem = {
  experiment_id: string;
  experiment_tag: string;
  task_type: string;
  status: string;
  active_run_id?: string;
  evidence_batch_id?: string;
  window_id: string;
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
  evidence_count: number;
};

export default function RouteOneExperimentsPage() {
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
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
    >
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
      >
        <div>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            judge-gym
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-8">
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
            <Link
              href="/editor/experiment"
              className="rounded border px-3 py-2 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "#1e2433", color: "#c8ccd4" }}
            >
              New Experiment
            </Link>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest opacity-50">
              Status Filters
            </span>
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => toggleFilter(status)}
                className="rounded px-2 py-1 text-[10px] uppercase tracking-wider"
                style={{
                  backgroundColor: statusFilter.includes(status)
                    ? `${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}30`
                    : `${STATUS_COLORS_MUTED[status as keyof typeof STATUS_COLORS_MUTED]}10`,
                  color: statusFilter.includes(status)
                    ? STATUS_COLORS[status as keyof typeof STATUS_COLORS]
                    : STATUS_COLORS_MUTED[
                        status as keyof typeof STATUS_COLORS_MUTED
                      ],
                  border: `1px solid ${
                    statusFilter.includes(status)
                      ? `${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}50`
                      : `${STATUS_COLORS_MUTED[status as keyof typeof STATUS_COLORS_MUTED]}30`
                  }`,
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <div
            className="overflow-hidden rounded border"
            style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
          >
            <div
              className="grid grid-cols-[88px_1.45fr_1fr_1fr_1.2fr] gap-x-4 border-b px-4 py-2 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "#1e2433", color: "#5a6173" }}
            >
              <span className="text-center">Status</span>
              <span>Tag</span>
              <span>Concept</span>
              <span>Task</span>
              <span>Window</span>
            </div>
            {experimentsLoading && (
              <div className="px-4 py-6 text-xs opacity-50">
                Loading experiments...
              </div>
            )}
            {!experimentsLoading && filtered.length === 0 && (
              <div className="px-4 py-6 text-xs opacity-50">
                No experiments found.
              </div>
            )}
            {filtered.map((exp) => (
              <Link
                key={exp.experiment_id}
                href={`/experiment/${exp.experiment_id}`}
                className="grid grid-cols-[88px_1.45fr_1fr_1fr_1.2fr] gap-x-4 border-b px-4 py-3 text-xs transition hover:bg-[#151a24]"
                style={{ borderColor: "#1e2433" }}
              >
                <span className="flex items-center justify-center" title={exp.status}>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        STATUS_COLORS[exp.status as keyof typeof STATUS_COLORS] ??
                        "#6b7280",
                    }}
                  />
                </span>
                <span className="font-medium" style={{ color: "#e8eaed" }}>
                  {exp.experiment_tag}
                </span>
                <span className="opacity-70">
                  {exp.evidence_window?.concept ?? "—"}
                </span>
                <span className="opacity-70">
                  {TASK_TYPE_LABELS[exp.task_type] ?? exp.task_type}
                </span>
                <span className="opacity-70">
                  {exp.evidence_window
                    ? `${exp.evidence_window.country} · ${exp.evidence_window.start_date}`
                    : exp.window_id}
                </span>
              </Link>
            ))}
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
            <Link
              href="/editor/window"
              className="rounded border px-3 py-2 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "#1e2433", color: "#c8ccd4" }}
            >
              New Window
            </Link>
          </div>

          <div
            className="overflow-hidden rounded border"
            style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
          >
            <div
              className="grid grid-cols-[1.6fr_0.8fr_1.1fr_1.2fr_0.6fr] border-b px-4 py-2 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "#1e2433", color: "#5a6173" }}
            >
              <span>Concept</span>
              <span>Country</span>
              <span>Model</span>
              <span>Window</span>
              <span className="text-right">Evidence</span>
            </div>
            {windowsLoading && (
              <div className="px-4 py-6 text-xs opacity-50">
                Loading evidence windows...
              </div>
            )}
            {!windowsLoading && windowRows.length === 0 && (
              <div className="px-4 py-6 text-xs opacity-50">
                No evidence windows found.
              </div>
            )}
            {windowRows.map((window) => (
              <Link
                key={window.window_id}
                href={`/evidence/${window.window_id}`}
                className="grid grid-cols-[1.6fr_0.8fr_1.1fr_1.2fr_0.6fr] border-b px-4 py-3 text-xs transition hover:bg-[#151a24]"
                style={{ borderColor: "#1e2433" }}
              >
                <span className="font-medium" style={{ color: "#e8eaed" }}>
                  {window.concept}
                </span>
                <span className="opacity-70">{window.country}</span>
                <span className="opacity-70">{window.model_id}</span>
                <span className="opacity-70">
                  {window.start_date} → {window.end_date}
                </span>
                <span className="text-right opacity-70">
                  {window.evidence_count ?? 0}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
