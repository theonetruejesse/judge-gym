"use client";

import Link from "next/link";
import { useState } from "react";
import {
  EXPERIMENTS,
  NORMALIZATION_LEVELS,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  getEvidenceForExperiment,
  type MockExperiment,
} from "@/lib/mock-data";

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#6b7280";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${value}%`,
          backgroundColor: value === 100 ? "#3b82f6" : "#ff6b35",
        }}
      />
    </div>
  );
}

export default function RouteOneExperimentPage({
  params,
}: {
  params: { id: string };
}) {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tab, setTab] = useState<"config" | "runs" | "evidence">("config");

  const selected =
    EXPERIMENTS.find((e) => e.id === params.id) ?? EXPERIMENTS[0];
  const evidence = getEvidenceForExperiment(selected.id);

  const filtered =
    statusFilter.length === 0
      ? EXPERIMENTS
      : EXPERIMENTS.filter((e) => statusFilter.includes(e.status));

  const toggleFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  const statuses = ["running", "complete", "paused", "pending", "canceled"];

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
    >
      <header
        className="flex h-11 flex-shrink-0 items-center justify-between border-b px-4"
        style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest opacity-50">
            judge-gym
          </span>
          <div className="h-3 w-px" style={{ backgroundColor: "#1e2433" }} />
          <span
            className="text-sm font-bold tracking-wide"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            MISSION CONTROL
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href="/1/experiments" className="hover:text-[#ff6b35]">
            Experiments
          </Link>
          <Link href="/1/editor" className="hover:text-[#ff6b35]">
            Edit
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className="flex w-64 flex-shrink-0 flex-col border-r overflow-hidden"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
        >
          <div className="border-b px-3 py-3" style={{ borderColor: "#1e2433" }}>
            <p
              className="mb-2 text-[10px] font-semibold uppercase tracking-widest opacity-40"
              style={{ fontFamily: "var(--font-1-serif)" }}
            >
              Filter
            </p>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleFilter(status)}
                  className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition-all"
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
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((exp) => (
              <Link
                key={exp.id}
                href={`/1/experiment/${exp.id}`}
                className="block w-full text-left px-3 py-2.5 border-b transition-colors"
                style={{
                  borderColor: "#1e2433",
                  backgroundColor: exp.id === selected.id ? "#151a24" : "transparent",
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusDot status={exp.status} />
                  <span
                    className="truncate text-xs font-medium"
                    style={{
                      color: exp.id === selected.id ? "#ff6b35" : "#c8ccd4",
                    }}
                  >
                    {exp.tag}
                  </span>
                </div>
                <div className="ml-4 text-[10px] opacity-40">
                  {TASK_TYPE_LABELS[exp.taskType]} &middot; {exp.window.country} &middot;{" "}
                  {exp.scaleSize}pt
                </div>
              </Link>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h1
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-1-serif)", color: "#e8eaed" }}
              >
                {selected.tag}
              </h1>
              <p className="mt-1 text-[11px] opacity-50">
                {selected.id} &middot; created{" "}
                {new Date(selected.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: `${
                    STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS]
                  }20`,
                  color: STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS],
                }}
              >
                {selected.status}
              </span>
              <button
                className="rounded px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: "#ff6b35", color: "#0b0e14" }}
              >
                Start
              </button>
              <button
                className="rounded border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ borderColor: "#1e2433", color: "#5a6173" }}
              >
                Stop
              </button>
              <button
                className="rounded border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ borderColor: "#1e2433", color: "#5a6173" }}
              >
                Add Samples
              </button>
              <button
                className="rounded border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ borderColor: "#1e2433", color: "#5a6173" }}
              >
                Clone
              </button>
            </div>
          </div>

          <div
            className="mb-4 flex gap-0 border-b"
            style={{ borderColor: "#1e2433" }}
          >
            {(
              [
                ["config", "Configuration"],
                ["runs", "Runs"],
                ["evidence", "Evidence"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="border-b-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{
                  fontFamily: "var(--font-1-serif)",
                  borderColor: tab === key ? "#ff6b35" : "transparent",
                  color: tab === key ? "#ff6b35" : "#5a6173",
                }}
              >
                {label}
                {key === "runs" && ` (${selected.runs.length})`}
                {key === "evidence" && ` (${evidence.length})`}
              </button>
            ))}
          </div>

          {tab === "config" && <ConfigPanel experiment={selected} />}
          {tab === "runs" && <RunsPanel experiment={selected} />}
          {tab === "evidence" && (
            <EvidencePanel experimentId={selected.id} evidence={evidence} />
          )}
        </main>
      </div>

      <footer
        className="flex h-7 flex-shrink-0 items-center justify-between border-t px-4 text-[10px]"
        style={{
          borderColor: "#1e2433",
          backgroundColor: "#0b0e14",
          color: "#3a4050",
        }}
      >
        <span>
          {filtered.length} of {EXPERIMENTS.length} shown &middot; {evidence.length} evidence
          items
        </span>
        <span>Mock data &middot; Last sync: just now</span>
      </footer>
    </div>
  );
}

function ConfigPanel({ experiment }: { experiment: MockExperiment }) {
  const rows: [string, string][] = [
    ["Task Type", TASK_TYPE_LABELS[experiment.taskType]],
    ["Rubric Model", experiment.rubricModel],
    ["Scoring Model", experiment.scoringModel],
    ["Scale Size", `${experiment.scaleSize}-point`],
    ["Evidence View", VIEW_LABELS[experiment.evidenceView]],
    ["Scoring Method", experiment.scoringMethod],
    ["Prompt Ordering", experiment.promptOrdering],
    ["Abstain Enabled", experiment.abstainEnabled ? "Yes" : "No"],
    [
      "Randomizations",
      experiment.randomizations.length > 0
        ? experiment.randomizations.join(", ")
        : "None",
    ],
    ["Window Concept", experiment.window.concept],
    ["Window Country", experiment.window.country],
    [
      "Window Period",
      `${experiment.window.startDate} -> ${experiment.window.endDate}`,
    ],
  ];

  return (
    <div className="space-y-4">
      <div
        className="rounded border p-4"
        style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
      >
        <p
          className="mb-2 text-[10px] uppercase tracking-widest opacity-50"
          style={{ fontFamily: "var(--font-1-serif)" }}
        >
          Evidence Window
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
          >
            <option>
              {experiment.window.concept}
              {" -> "}
              {experiment.window.country}
              {" -> "}
              {experiment.window.startDate}
            </option>
            <option>alternate-window-us-2025</option>
          </select>
          <button
            className="rounded border px-3 py-1 text-[10px] uppercase tracking-wider"
            style={{ borderColor: "#1e2433", color: "#5a6173" }}
          >
            Create New Window
          </button>
        </div>
      </div>

      <div
        className="rounded border"
        style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
      >
        <table className="w-full">
          <tbody>
            {rows.map(([label, value]) => (
              <tr
                key={label}
                className="border-b last:border-b-0"
                style={{ borderColor: "#1e2433" }}
              >
                <td
                  className="w-48 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "#5a6173" }}
                >
                  {label}
                </td>
                <td
                  className="px-4 py-2.5 text-xs"
                  style={{ color: "#e8eaed" }}
                >
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunsPanel({ experiment }: { experiment: MockExperiment }) {
  if (experiment.runs.length === 0) {
    return (
      <div
        className="rounded border px-6 py-10 text-center text-xs opacity-40"
        style={{ borderColor: "#1e2433" }}
      >
        No runs yet. Click Start to begin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {experiment.runs.map((run) => (
        <div
          key={run.id}
          className="rounded border"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "#1e2433" }}
          >
            <div className="flex items-center gap-3">
              <StatusDot status={run.status} />
              <span className="text-xs font-medium" style={{ color: "#e8eaed" }}>
                {run.id}
              </span>
              <span className="text-[10px] opacity-40">
                {run.completedSamples}/{run.totalSamples} samples
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32">
                <ProgressBar value={run.progress} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: "#ff6b35" }}>
                {run.progress}%
              </span>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "#1e2433" }}>
                <th
                  className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "#3a4050" }}
                >
                  Stage
                </th>
                <th
                  className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "#3a4050" }}
                >
                  Status
                </th>
                <th
                  className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "#3a4050" }}
                >
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {run.stages.map((stage) => (
                <tr
                  key={stage.name}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "#1e2433" }}
                >
                  <td className="px-4 py-2 text-xs" style={{ color: "#c8ccd4" }}>
                    {stage.name}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={stage.status} />
                      <span className="text-[10px] uppercase tracking-wider opacity-60">
                        {stage.status}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs opacity-60">
                    {stage.progress}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function EvidencePanel({
  experimentId,
  evidence,
}: {
  experimentId: string;
  evidence: ReturnType<typeof getEvidenceForExperiment>;
}) {
  if (evidence.length === 0) {
    return (
      <div
        className="rounded border px-6 py-10 text-center text-xs opacity-40"
        style={{ borderColor: "#1e2433" }}
      >
        No evidence collected for this experiment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {evidence.map((ev) => (
        <Link
          key={ev.id}
          href={`/1/evidence/${ev.id}`}
          className="block rounded border p-4 transition hover:bg-[#151a24]"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold" style={{ color: "#e8eaed" }}>
                {ev.title}
              </div>
              <div className="mt-1 text-[11px] opacity-50">{ev.sourceUrl}</div>
            </div>
            <span className="text-[10px] uppercase tracking-wider opacity-40">
              {new Date(ev.collectedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {NORMALIZATION_LEVELS.map((level) => {
              const active = level.key === ev.view;
              return (
                <span
                  key={level.key}
                  className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider"
                  style={{
                    backgroundColor: active ? "#ff6b3530" : "#151a24",
                    color: active ? "#ff6b35" : "#7a8599",
                    border: `1px solid ${active ? "#ff6b3550" : "#1e2433"}`,
                  }}
                >
                  {VIEW_LABELS[level.key]}
                </span>
              );
            })}
          </div>
        </Link>
      ))}
      <div className="text-[10px] opacity-40">
        {evidence.length} evidence items for {experimentId}
      </div>
    </div>
  );
}
