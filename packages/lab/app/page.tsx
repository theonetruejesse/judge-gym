"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import { STATUS_COLORS, TASK_TYPE_LABELS } from "@/lib/ui";

const statuses = ["running", "complete", "paused", "pending", "canceled"];
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

export default function RouteOneExperimentsPage() {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  if (!hasConvex) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Missing `NEXT_PUBLIC_CONVEX_URL`.</p>
        <p className="mt-2 text-xs opacity-60">
          Set the Convex URL to load experiments in Mission Control.
        </p>
      </div>
    );
  }

  const experiments = useQuery(
    api.lab.listExperiments,
    {},
  ) as ExperimentListItem[] | undefined;
  const filtered =
    statusFilter.length === 0
      ? experiments ?? []
      : (experiments ?? []).filter((e) => statusFilter.includes(e.status));

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
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            judge-gym
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            Experiments
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="rounded border px-3 py-2 text-[10px] uppercase tracking-wider"
            style={{ borderColor: "#1e2433", color: "#c8ccd4" }}
          >
            New Experiment
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
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
                  : "#151a24",
                color: statusFilter.includes(status)
                  ? STATUS_COLORS[status as keyof typeof STATUS_COLORS]
                  : "#5a6173",
                border: `1px solid ${
                  statusFilter.includes(status)
                    ? `${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}50`
                    : "#1e2433"
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
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] border-b px-4 py-2 text-[10px] uppercase tracking-wider"
            style={{ borderColor: "#1e2433", color: "#5a6173" }}
          >
            <span>Tag</span>
            <span>Concept</span>
            <span>Status</span>
            <span>Task</span>
            <span>Window</span>
          </div>
          {!experiments && (
            <div className="px-4 py-6 text-xs opacity-50">Loading experiments...</div>
          )}
          {experiments && filtered.length === 0 && (
            <div className="px-4 py-6 text-xs opacity-50">
              No experiments found. Create one in the editor.
            </div>
          )}
          {filtered.map((exp) => (
            <Link
              key={exp.experiment_id}
              href={`/experiment/${exp.experiment_id}`}
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] border-b px-4 py-3 text-xs transition hover:bg-[#151a24]"
              style={{ borderColor: "#1e2433" }}
            >
              <span className="font-medium" style={{ color: "#e8eaed" }}>
                {exp.experiment_tag}
              </span>
              <span className="opacity-70">
                {exp.evidence_window?.concept ?? "—"}
              </span>
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: STATUS_COLORS[exp.status] ?? "#6b7280" }}
              >
                {exp.status}
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
      </div>
    </div>
  );
}
