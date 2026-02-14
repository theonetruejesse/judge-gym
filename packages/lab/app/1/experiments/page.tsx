"use client";

import Link from "next/link";
import { useState } from "react";
import {
  EXPERIMENTS,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
} from "@/lib/mock-data";

const statuses = ["running", "complete", "paused", "pending", "canceled"];

export default function RouteOneExperimentsPage() {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
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
            href="/1/editor"
            className="rounded border px-3 py-2 text-[10px] uppercase tracking-wider"
            style={{ borderColor: "#1e2433", color: "#c8ccd4" }}
          >
            New Experiment
          </Link>
          <Link
            href="/"
            className="rounded border px-3 py-2 text-[10px] uppercase tracking-wider"
            style={{ borderColor: "#1e2433", color: "#7a8599" }}
          >
            All Layouts
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
            className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] border-b px-4 py-2 text-[10px] uppercase tracking-wider"
            style={{ borderColor: "#1e2433", color: "#5a6173" }}
          >
            <span>Tag</span>
            <span>Concept</span>
            <span>Status</span>
            <span>Task</span>
            <span>Scale</span>
          </div>
          {filtered.map((exp) => (
            <Link
              key={exp.id}
              href={`/1/experiment/${exp.id}`}
              className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] border-b px-4 py-3 text-xs transition hover:bg-[#151a24]"
              style={{ borderColor: "#1e2433" }}
            >
              <span className="font-medium" style={{ color: "#e8eaed" }}>
                {exp.tag}
              </span>
              <span className="opacity-70">{exp.concept}</span>
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: STATUS_COLORS[exp.status] }}
              >
                {exp.status}
              </span>
              <span className="opacity-70">{TASK_TYPE_LABELS[exp.taskType]}</span>
              <span className="opacity-70">{exp.scaleSize}-pt</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
