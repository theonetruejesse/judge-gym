"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import {
  EXPERIMENTS,
  EVIDENCE,
  getEvidenceForExperiment,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  type MockExperiment,
  type MockEvidence,
} from "@/lib/mock-data";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"] });

// ─── Column definitions ─────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

const COLUMNS = [
  { key: "tag", label: "Experiment", width: "minmax(200px, 2fr)" },
  { key: "taskType", label: "Type", width: "90px" },
  { key: "status", label: "Status", width: "100px" },
  { key: "rubricModel", label: "Rubric", width: "140px" },
  { key: "scoringModel", label: "Scorer", width: "140px" },
  { key: "scaleSize", label: "Scale", width: "70px" },
  { key: "evidenceView", label: "View", width: "120px" },
  { key: "scoringMethod", label: "Method", width: "120px" },
  { key: "promptOrdering", label: "Ordering", width: "120px" },
  { key: "abstainEnabled", label: "Abstain", width: "80px" },
  { key: "country", label: "Country", width: "80px" },
  { key: "concept", label: "Concept", width: "130px" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCellValue(exp: MockExperiment, key: ColumnKey): string {
  switch (key) {
    case "tag":
      return exp.tag;
    case "taskType":
      return exp.taskType;
    case "status":
      return exp.status;
    case "rubricModel":
      return exp.rubricModel;
    case "scoringModel":
      return exp.scoringModel;
    case "scaleSize":
      return `${exp.scaleSize}`;
    case "evidenceView":
      return exp.evidenceView;
    case "scoringMethod":
      return exp.scoringMethod;
    case "promptOrdering":
      return exp.promptOrdering;
    case "abstainEnabled":
      return exp.abstainEnabled ? "Yes" : "No";
    case "country":
      return exp.window.country;
    case "concept":
      return exp.window.concept;
  }
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function TheLedgerPage() {
  const [sortCol, setSortCol] = useState<ColumnKey>("tag");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterText, setFilterText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<"experiments" | "evidence">("experiments");

  const toggleSort = (col: ColumnKey) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let list = [...EXPERIMENTS];
    if (filterText) {
      const q = filterText.toLowerCase();
      list = list.filter(
        (e) =>
          e.tag.toLowerCase().includes(q) ||
          e.concept.toLowerCase().includes(q) ||
          e.status.toLowerCase().includes(q) ||
          e.rubricModel.toLowerCase().includes(q) ||
          e.scoringModel.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const av = getCellValue(a, sortCol);
      const bv = getCellValue(b, sortCol);
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filterText, sortCol, sortDir]);

  const gridTemplate = COLUMNS.map((c) => c.width).join(" ");

  return (
    <div
      className={`${sans.className} fixed inset-0 flex flex-col overflow-hidden`}
      style={{ backgroundColor: "#f8fafc", color: "#0f172a", fontSize: "13px" }}
    >
      {/* ─── Toolbar ─────────────────────────────────────────────── */}
      <header
        className="flex h-12 flex-shrink-0 items-center justify-between border-b px-4"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#ffffff" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-[11px] opacity-40 hover:opacity-70 transition-opacity"
          >
            &larr; Lab
          </Link>
          <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />
          <h1 className="text-sm font-semibold tracking-tight" style={{ color: "#0f172a" }}>
            The Ledger
          </h1>
          <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />

          {/* View toggle */}
          <div className="flex rounded-md border" style={{ borderColor: "#e2e8f0" }}>
            {(["experiments", "evidence"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1 text-[11px] font-medium capitalize transition-colors"
                style={{
                  backgroundColor: view === v ? "#2563eb" : "transparent",
                  color: view === v ? "#ffffff" : "#64748b",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="rounded-md border px-3 py-1 text-xs outline-none transition-colors focus:border-blue-400"
            style={{
              borderColor: "#e2e8f0",
              backgroundColor: "#f8fafc",
              width: "180px",
            }}
          />
          <button
            className="rounded-md border px-3 py-1 text-[11px] font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: "#e2e8f0", color: "#64748b" }}
            onClick={() => {}}
          >
            Export
          </button>
          <button
            className="rounded-md px-3 py-1 text-[11px] font-medium text-white"
            style={{ backgroundColor: "#2563eb" }}
            onClick={() => {}}
          >
            + New
          </button>
        </div>
      </header>

      {/* ─── Content ─────────────────────────────────────────────── */}
      {view === "experiments" ? (
        <div className="flex-1 overflow-auto">
          {/* Column headers */}
          <div
            className="sticky top-0 z-10 grid border-b"
            style={{
              gridTemplateColumns: gridTemplate,
              borderColor: "#e2e8f0",
              backgroundColor: "#f1f5f9",
            }}
          >
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="flex items-center gap-1 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-gray-200/50"
                style={{ color: sortCol === col.key ? "#2563eb" : "#64748b" }}
              >
                {col.label}
                {sortCol === col.key && (
                  <span className="text-[9px]">
                    {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((exp) => (
            <div key={exp.id}>
              <div
                className="grid cursor-pointer border-b transition-colors hover:bg-blue-50/50"
                style={{
                  gridTemplateColumns: gridTemplate,
                  borderColor: "#f1f5f9",
                  backgroundColor:
                    expandedId === exp.id ? "#eff6ff" : "transparent",
                }}
                onClick={() =>
                  setExpandedId((prev) =>
                    prev === exp.id ? null : exp.id,
                  )
                }
              >
                {COLUMNS.map((col) => (
                  <div
                    key={col.key}
                    className={`${
                      col.key === "tag" ? "font-medium" : ""
                    } flex items-center px-3 py-2.5 text-xs truncate`}
                    style={{
                      color:
                        col.key === "tag" ? "#0f172a" : "#475569",
                    }}
                  >
                    {col.key === "status" ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[
                                exp.status as keyof typeof STATUS_COLORS
                              ],
                          }}
                        />
                        <span className="capitalize">{exp.status}</span>
                      </span>
                    ) : col.key === "taskType" ? (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: "#e2e8f0",
                          color: "#475569",
                        }}
                      >
                        {TASK_TYPE_LABELS[exp.taskType]}
                      </span>
                    ) : col.key === "evidenceView" ? (
                      VIEW_LABELS[exp.evidenceView]
                    ) : col.key === "abstainEnabled" ? (
                      exp.abstainEnabled ? "Yes" : "No"
                    ) : col.key === "scaleSize" ? (
                      `${exp.scaleSize}pt`
                    ) : col.key === "country" ? (
                      exp.window.country
                    ) : col.key === "concept" ? (
                      exp.window.concept
                    ) : (
                      <span className={mono.className}>
                        {getCellValue(exp, col.key)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Expanded detail row */}
              {expandedId === exp.id && (
                <ExpandedRow experiment={exp} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <EvidenceGrid filterText={filterText} />
      )}

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer
        className="flex h-8 flex-shrink-0 items-center justify-between border-t px-4 text-[10px]"
        style={{
          borderColor: "#e2e8f0",
          backgroundColor: "#ffffff",
          color: "#94a3b8",
        }}
      >
        <span>
          {filtered.length} of {EXPERIMENTS.length} rows &middot; {COLUMNS.length}{" "}
          fields
        </span>
        <span>Mock data</span>
      </footer>
    </div>
  );
}

// ─── Expanded Row ───────────────────────────────────────────────────────────

function ExpandedRow({ experiment: e }: { experiment: MockExperiment }) {
  const evidence = getEvidenceForExperiment(e.id);
  return (
    <div
      className="border-b px-6 py-4"
      style={{
        borderColor: "#e2e8f0",
        backgroundColor: "#f8fafc",
      }}
    >
      <div className="grid grid-cols-3 gap-8">
        {/* Details */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
            Details
          </h4>
          <div className="space-y-1 text-xs">
            <Row label="Randomizations" value={e.randomizations.join(", ") || "None"} />
            <Row label="Window" value={`${e.window.startDate} → ${e.window.endDate}`} />
            <Row label="Created" value={new Date(e.createdAt).toLocaleDateString()} />
          </div>
        </div>

        {/* Runs */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
            Runs ({e.runs.length})
          </h4>
          {e.runs.length === 0 ? (
            <p className="text-xs opacity-40">No runs</p>
          ) : (
            <div className="space-y-2">
              {e.runs.map((run) => (
                <div key={run.id} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className={mono.className}>{run.id}</span>
                    <span
                      className="text-[10px] font-medium capitalize"
                      style={{
                        color: STATUS_COLORS[run.status as keyof typeof STATUS_COLORS],
                      }}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full" style={{ backgroundColor: "#e2e8f0" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${run.progress}%`,
                        backgroundColor: "#2563eb",
                      }}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] opacity-40">
                    {run.completedSamples}/{run.totalSamples} samples
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence preview */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
            Evidence ({evidence.length})
          </h4>
          {evidence.length === 0 ? (
            <p className="text-xs opacity-40">No evidence</p>
          ) : (
            <div className="space-y-1.5">
              {evidence.slice(0, 3).map((ev) => (
                <div key={ev.id} className="text-xs">
                  <span style={{ color: "#0f172a" }}>{ev.title}</span>
                  <span className="ml-2 text-[10px] opacity-30">
                    {VIEW_LABELS[ev.view]}
                  </span>
                </div>
              ))}
              {evidence.length > 3 && (
                <p className="text-[10px] opacity-30">
                  +{evidence.length - 3} more
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          className="rounded border px-2.5 py-1 text-[10px] font-medium transition-colors hover:bg-gray-100"
          style={{ borderColor: "#e2e8f0", color: "#64748b" }}
          onClick={() => {}}
        >
          Run
        </button>
        <button
          className="rounded border px-2.5 py-1 text-[10px] font-medium transition-colors hover:bg-gray-100"
          style={{ borderColor: "#e2e8f0", color: "#64748b" }}
          onClick={() => {}}
        >
          Export
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="flex-shrink-0 w-28 text-[10px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>
        {label}
      </span>
      <span style={{ color: "#475569" }}>{value}</span>
    </div>
  );
}

// ─── Evidence Grid ──────────────────────────────────────────────────────────

function EvidenceGrid({ filterText }: { filterText: string }) {
  const filtered = useMemo(() => {
    if (!filterText) return EVIDENCE;
    const q = filterText.toLowerCase();
    return EVIDENCE.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.concept.toLowerCase().includes(q) ||
        e.view.toLowerCase().includes(q),
    );
  }, [filterText]);

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0" style={{ backgroundColor: "#f1f5f9" }}>
          <tr className="border-b" style={{ borderColor: "#e2e8f0" }}>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
              Title
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
              Concept
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
              View
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
              Source
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
              Collected
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((ev) => (
            <tr
              key={ev.id}
              className="border-b transition-colors hover:bg-blue-50/30"
              style={{ borderColor: "#f1f5f9" }}
            >
              <td className="px-4 py-3">
                <div className="text-xs font-medium" style={{ color: "#0f172a" }}>
                  {ev.title}
                </div>
                <div className="mt-0.5 text-[11px] leading-relaxed line-clamp-1" style={{ color: "#94a3b8" }}>
                  {ev.snippet}
                </div>
              </td>
              <td className="px-4 py-3 text-xs capitalize" style={{ color: "#475569" }}>
                {ev.concept.replace(/_/g, " ")}
              </td>
              <td className="px-4 py-3">
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: "#e2e8f0", color: "#475569" }}
                >
                  {VIEW_LABELS[ev.view]}
                </span>
              </td>
              <td className="px-4 py-3 text-[11px] max-w-[200px] truncate" style={{ color: "#94a3b8" }}>
                {ev.sourceUrl}
              </td>
              <td className="px-4 py-3 text-[11px] whitespace-nowrap" style={{ color: "#94a3b8" }}>
                {new Date(ev.collectedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
