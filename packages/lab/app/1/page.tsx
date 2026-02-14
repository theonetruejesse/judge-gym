"use client";

import { useState } from "react";
import Link from "next/link";
import { Bitter, JetBrains_Mono } from "next/font/google";
import {
  EXPERIMENTS,
  EVIDENCE,
  getEvidenceForExperiment,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  type MockExperiment,
} from "@/lib/mock-data";

const serif = Bitter({ subsets: ["latin"], weight: ["400", "600", "700"] });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
});

// ─── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#6b7280";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// ─── Progress bar ───────────────────────────────────────────────────────────

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

// ─── Main page ──────────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const [selectedId, setSelectedId] = useState<string>("exp_001");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tab, setTab] = useState<"config" | "runs" | "evidence">("config");

  const filtered =
    statusFilter.length === 0
      ? EXPERIMENTS
      : EXPERIMENTS.filter((e) => statusFilter.includes(e.status));

  const selected = EXPERIMENTS.find((e) => e.id === selectedId) ?? EXPERIMENTS[0];
  const evidence = getEvidenceForExperiment(selected.id);

  const toggleFilter = (s: string) => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const statuses = ["running", "complete", "paused", "pending", "canceled"];
  const summary = {
    total: EXPERIMENTS.length,
    running: EXPERIMENTS.filter((e) => e.status === "running").length,
    complete: EXPERIMENTS.filter((e) => e.status === "complete").length,
  };

  return (
    <div
      className={`${mono.className} fixed inset-0 flex flex-col overflow-hidden`}
      style={{
        backgroundColor: "#0f1219",
        color: "#c8ccd4",
        fontSize: "13px",
      }}
    >
      {/* ─── Top bar ─────────────────────────────────────────────────── */}
      <header
        className="flex h-11 flex-shrink-0 items-center justify-between border-b px-4"
        style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
          >
            &larr; Lab
          </Link>
          <div
            className="h-3 w-px"
            style={{ backgroundColor: "#1e2433" }}
          />
          <span
            className={`${serif.className} text-sm font-bold tracking-wide`}
            style={{ color: "#ff6b35" }}
          >
            MISSION CONTROL
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] opacity-60">
          <span>{summary.total} experiments</span>
          <span>{summary.running} active</span>
          <span>{summary.complete} done</span>
        </div>
      </header>

      {/* ─── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Left sidebar ──────────────────────────────────────────── */}
        <aside
          className="flex w-64 flex-shrink-0 flex-col border-r overflow-hidden"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
        >
          {/* Filters */}
          <div className="border-b px-3 py-3" style={{ borderColor: "#1e2433" }}>
            <p
              className={`${serif.className} mb-2 text-[10px] font-semibold uppercase tracking-widest opacity-40`}
            >
              Filter
            </p>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleFilter(s)}
                  className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: statusFilter.includes(s)
                      ? STATUS_COLORS[s as keyof typeof STATUS_COLORS] + "30"
                      : "#151a24",
                    color: statusFilter.includes(s)
                      ? STATUS_COLORS[s as keyof typeof STATUS_COLORS]
                      : "#5a6173",
                    border: `1px solid ${
                      statusFilter.includes(s)
                        ? STATUS_COLORS[s as keyof typeof STATUS_COLORS] + "50"
                        : "#1e2433"
                    }`,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Experiment list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setSelectedId(exp.id)}
                className="block w-full text-left px-3 py-2.5 border-b transition-colors"
                style={{
                  borderColor: "#1e2433",
                  backgroundColor:
                    exp.id === selectedId ? "#151a24" : "transparent",
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusDot status={exp.status} />
                  <span
                    className="truncate text-xs font-medium"
                    style={{
                      color: exp.id === selectedId ? "#ff6b35" : "#c8ccd4",
                    }}
                  >
                    {exp.tag}
                  </span>
                </div>
                <div className="ml-4 text-[10px] opacity-40">
                  {TASK_TYPE_LABELS[exp.taskType]} &middot;{" "}
                  {exp.window.country} &middot;{" "}
                  {exp.scaleSize}pt
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* ─── Main content ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-5">
          {/* Experiment header */}
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h1
                className={`${serif.className} text-xl font-bold tracking-tight`}
                style={{ color: "#e8eaed" }}
              >
                {selected.tag}
              </h1>
              <p className="mt-1 text-[11px] opacity-50">
                {selected.id} &middot; created{" "}
                {new Date(selected.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor:
                    STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS] + "20",
                  color:
                    STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS],
                }}
              >
                {selected.status}
              </span>
              <button
                className="rounded px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: "#ff6b35",
                  color: "#0b0e14",
                }}
                onClick={() => {}}
              >
                Run
              </button>
              <button
                className="rounded border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  borderColor: "#1e2433",
                  color: "#5a6173",
                }}
                onClick={() => {}}
              >
                Export
              </button>
            </div>
          </div>

          {/* Tab bar */}
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
                className={`${serif.className} border-b-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors`}
                style={{
                  borderColor:
                    tab === key ? "#ff6b35" : "transparent",
                  color: tab === key ? "#ff6b35" : "#5a6173",
                }}
              >
                {label}
                {key === "runs" && ` (${selected.runs.length})`}
                {key === "evidence" && ` (${evidence.length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "config" && <ConfigPanel experiment={selected} />}
          {tab === "runs" && <RunsPanel experiment={selected} />}
          {tab === "evidence" && <EvidencePanel evidence={evidence} />}
        </main>
      </div>

      {/* ─── Status bar ──────────────────────────────────────────────── */}
      <footer
        className="flex h-7 flex-shrink-0 items-center justify-between border-t px-4 text-[10px]"
        style={{
          borderColor: "#1e2433",
          backgroundColor: "#0b0e14",
          color: "#3a4050",
        }}
      >
        <span>
          {filtered.length} of {EXPERIMENTS.length} shown &middot;{" "}
          {EVIDENCE.length} evidence items
        </span>
        <span>Mock data &middot; Last sync: just now</span>
      </footer>
    </div>
  );
}

// ─── Config Panel ───────────────────────────────────────────────────────────

function ConfigPanel({ experiment: e }: { experiment: MockExperiment }) {
  const rows: [string, string][] = [
    ["Task Type", TASK_TYPE_LABELS[e.taskType]],
    ["Rubric Model", e.rubricModel],
    ["Scoring Model", e.scoringModel],
    ["Scale Size", `${e.scaleSize}-point`],
    ["Evidence View", VIEW_LABELS[e.evidenceView]],
    ["Scoring Method", e.scoringMethod],
    ["Prompt Ordering", e.promptOrdering],
    ["Abstain Enabled", e.abstainEnabled ? "Yes" : "No"],
    ["Randomizations", e.randomizations.length > 0 ? e.randomizations.join(", ") : "None"],
    ["Window Concept", e.window.concept],
    ["Window Country", e.window.country],
    ["Window Period", `${e.window.startDate} → ${e.window.endDate}`],
  ];

  return (
    <div
      className="rounded border"
      style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
    >
      <table className="w-full">
        <tbody>
          {rows.map(([label, value], i) => (
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
              <td className="px-4 py-2.5 text-xs" style={{ color: "#e8eaed" }}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Runs Panel ─────────────────────────────────────────────────────────────

function RunsPanel({ experiment }: { experiment: MockExperiment }) {
  if (experiment.runs.length === 0) {
    return (
      <div className="rounded border px-6 py-10 text-center text-xs opacity-40" style={{ borderColor: "#1e2433" }}>
        No runs yet. Click Run to start one.
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
          {/* Run header */}
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

          {/* Stages table */}
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "#1e2433" }}>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#3a4050" }}>
                  Stage
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#3a4050" }}>
                  Status
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#3a4050" }}>
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

// ─── Evidence Panel ─────────────────────────────────────────────────────────

function EvidencePanel({
  evidence,
}: {
  evidence: ReturnType<typeof getEvidenceForExperiment>;
}) {
  if (evidence.length === 0) {
    return (
      <div className="rounded border px-6 py-10 text-center text-xs opacity-40" style={{ borderColor: "#1e2433" }}>
        No evidence collected for this experiment.
      </div>
    );
  }

  return (
    <div
      className="rounded border"
      style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b" style={{ borderColor: "#1e2433" }}>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#3a4050" }}>
              Title
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#3a4050" }}>
              View
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#3a4050" }}>
              Source
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#3a4050" }}>
              Collected
            </th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((ev) => (
            <tr
              key={ev.id}
              className="border-b last:border-b-0 group"
              style={{ borderColor: "#1e2433" }}
            >
              <td className="px-4 py-3">
                <div className="text-xs font-medium" style={{ color: "#e8eaed" }}>
                  {ev.title}
                </div>
                <div className="mt-1 text-[11px] leading-relaxed opacity-40 line-clamp-2">
                  {ev.snippet}
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: "#151a24", color: "#7a8599" }}
                >
                  {VIEW_LABELS[ev.view]}
                </span>
              </td>
              <td className="px-4 py-3 text-[11px] opacity-50 max-w-[200px] truncate">
                {ev.sourceUrl}
              </td>
              <td className="px-4 py-3 text-[11px] opacity-40 whitespace-nowrap">
                {new Date(ev.collectedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
