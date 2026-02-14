"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Outfit, Fira_Code } from "next/font/google";
import {
  EXPERIMENTS,
  getEvidenceForExperiment,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  type MockExperiment,
} from "@/lib/mock-data";

const label = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const code = Fira_Code({ subsets: ["latin"], weight: ["400", "500"] });

// ─── Config fields to compare ───────────────────────────────────────────────

type FieldDef = {
  key: string;
  label: string;
  getValue: (e: MockExperiment) => string;
};

const FIELDS: FieldDef[] = [
  { key: "status", label: "Status", getValue: (e) => e.status },
  { key: "taskType", label: "Task Type", getValue: (e) => TASK_TYPE_LABELS[e.taskType] },
  { key: "rubricModel", label: "Rubric Model", getValue: (e) => e.rubricModel },
  { key: "scoringModel", label: "Scoring Model", getValue: (e) => e.scoringModel },
  { key: "scaleSize", label: "Scale Size", getValue: (e) => `${e.scaleSize}-point` },
  { key: "evidenceView", label: "Evidence View", getValue: (e) => VIEW_LABELS[e.evidenceView] },
  { key: "scoringMethod", label: "Scoring Method", getValue: (e) => e.scoringMethod },
  { key: "promptOrdering", label: "Prompt Ordering", getValue: (e) => e.promptOrdering },
  { key: "abstainEnabled", label: "Abstain", getValue: (e) => (e.abstainEnabled ? "yes" : "no") },
  {
    key: "randomizations",
    label: "Randomizations",
    getValue: (e) => (e.randomizations.length > 0 ? e.randomizations.join(", ") : "none"),
  },
  { key: "concept", label: "Concept", getValue: (e) => e.window.concept },
  { key: "country", label: "Country", getValue: (e) => e.window.country },
  { key: "period", label: "Window", getValue: (e) => `${e.window.startDate} \u2192 ${e.window.endDate}` },
  {
    key: "runs",
    label: "Runs",
    getValue: (e) => {
      if (e.runs.length === 0) return "none";
      return e.runs.map((r) => `${r.id} (${r.status}, ${r.progress}%)`).join("; ");
    },
  },
  {
    key: "evidence",
    label: "Evidence Count",
    getValue: (e) => `${getEvidenceForExperiment(e.id).length}`,
  },
];

// ─── Main page ──────────────────────────────────────────────────────────────

export default function TheDiffPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "exp_001",
    "exp_003",
  ]);
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const selectedExperiments = useMemo(
    () =>
      selectedIds
        .map((id) => EXPERIMENTS.find((e) => e.id === id))
        .filter(Boolean) as MockExperiment[],
    [selectedIds],
  );

  const toggleExperiment = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, id];
    });
  };

  // Compute which fields have differences
  const diffFields = useMemo(() => {
    if (selectedExperiments.length < 2) return new Set<string>();
    const diffs = new Set<string>();
    for (const field of FIELDS) {
      const values = selectedExperiments.map((e) => field.getValue(e));
      if (new Set(values).size > 1) diffs.add(field.key);
    }
    return diffs;
  }, [selectedExperiments]);

  const visibleFields = showOnlyDiffs
    ? FIELDS.filter((f) => diffFields.has(f.key))
    : FIELDS;

  const diffCount = diffFields.size;
  const sameCount = FIELDS.length - diffCount;

  return (
    <div
      className={`${label.className} fixed inset-0 flex flex-col overflow-hidden`}
      style={{
        backgroundColor: "#09090b",
        color: "#fafafa",
        fontSize: "13px",
      }}
    >
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header
        className="flex h-12 flex-shrink-0 items-center justify-between border-b px-5"
        style={{ borderColor: "#1c1c22", backgroundColor: "#0c0c0f" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-[11px] opacity-30 hover:opacity-60 transition-opacity"
          >
            &larr; Lab
          </Link>
          <div className="h-4 w-px" style={{ backgroundColor: "#1c1c22" }} />
          <h1 className="text-sm font-medium tracking-tight">The Diff</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] opacity-30">
            {diffCount} diff{diffCount !== 1 ? "s" : ""} &middot; {sameCount}{" "}
            same
          </span>
          <button
            onClick={() => setShowOnlyDiffs((v) => !v)}
            className="rounded border px-2.5 py-1 text-[10px] font-medium transition-colors"
            style={{
              borderColor: showOnlyDiffs ? "#a855f7" : "#27272a",
              color: showOnlyDiffs ? "#a855f7" : "#71717a",
              backgroundColor: showOnlyDiffs ? "#a855f720" : "transparent",
            }}
          >
            {showOnlyDiffs ? "Showing diffs only" : "Show diffs only"}
          </button>
          <button
            className="rounded border px-2.5 py-1 text-[10px] font-medium transition-colors"
            style={{ borderColor: "#27272a", color: "#71717a" }}
            onClick={() => {}}
          >
            Export
          </button>
        </div>
      </header>

      {/* ─── Experiment selector bar ─────────────────────────────── */}
      <div
        className="flex items-center gap-3 border-b px-5 py-3"
        style={{ borderColor: "#1c1c22", backgroundColor: "#0c0c0f" }}
      >
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#52525b" }}>
          Comparing:
        </span>
        {selectedExperiments.map((exp) => (
          <button
            key={exp.id}
            onClick={() => toggleExperiment(exp.id)}
            className="group flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors"
            style={{ borderColor: "#27272a" }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  STATUS_COLORS[exp.status as keyof typeof STATUS_COLORS],
              }}
            />
            <span className="text-xs">{exp.tag}</span>
            <span className="text-[10px] opacity-30 group-hover:opacity-70 transition-opacity">
              &times;
            </span>
          </button>
        ))}
        {selectedIds.length < 4 && (
          <div className="relative">
            <button
              onClick={() => setSelectorOpen((v) => !v)}
              className="rounded-md border border-dashed px-3 py-1.5 text-xs transition-colors hover:border-solid"
              style={{ borderColor: "#27272a", color: "#52525b" }}
            >
              + Add
            </button>
            {selectorOpen && (
              <div
                className="absolute top-full left-0 z-20 mt-1 w-72 rounded-md border shadow-xl"
                style={{
                  borderColor: "#27272a",
                  backgroundColor: "#18181b",
                }}
              >
                {EXPERIMENTS.filter((e) => !selectedIds.includes(e.id)).map(
                  (exp) => (
                    <button
                      key={exp.id}
                      onClick={() => {
                        toggleExperiment(exp.id);
                        setSelectorOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[exp.status as keyof typeof STATUS_COLORS],
                        }}
                      />
                      <span>{exp.tag}</span>
                      <span className="ml-auto text-[10px] opacity-30">
                        {exp.window.concept}
                      </span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Comparison table ────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {selectedExperiments.length < 2 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm opacity-30">
              Select at least two experiments to compare.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: "#0c0c0f" }}>
                <th
                  className="border-b border-r px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    borderColor: "#1c1c22",
                    color: "#52525b",
                    width: "160px",
                    minWidth: "160px",
                  }}
                >
                  Field
                </th>
                {selectedExperiments.map((exp) => (
                  <th
                    key={exp.id}
                    className="border-b px-4 py-3 text-left"
                    style={{ borderColor: "#1c1c22" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[
                              exp.status as keyof typeof STATUS_COLORS
                            ],
                        }}
                      />
                      <span className="text-xs font-medium">{exp.tag}</span>
                    </div>
                  </th>
                ))}
                <th
                  className="border-b px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    borderColor: "#1c1c22",
                    color: "#52525b",
                    width: "50px",
                  }}
                >
                  Diff
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleFields.map((field) => {
                const isDiff = diffFields.has(field.key);
                const values = selectedExperiments.map((e) =>
                  field.getValue(e),
                );

                return (
                  <tr
                    key={field.key}
                    className="transition-colors"
                    style={{
                      backgroundColor: isDiff ? "#a855f708" : "transparent",
                    }}
                  >
                    <td
                      className="border-b border-r px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"
                      style={{
                        borderColor: "#1c1c22",
                        color: "#52525b",
                      }}
                    >
                      {field.label}
                    </td>
                    {values.map((val, i) => (
                      <td
                        key={selectedExperiments[i].id}
                        className={`${code.className} border-b px-4 py-2.5 text-xs`}
                        style={{
                          borderColor: "#1c1c22",
                          color: isDiff ? "#e4e4e7" : "#71717a",
                        }}
                      >
                        {field.key === "status" ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  STATUS_COLORS[
                                    val as keyof typeof STATUS_COLORS
                                  ] ?? "#6b7280",
                              }}
                            />
                            {val}
                          </span>
                        ) : (
                          val
                        )}
                      </td>
                    ))}
                    <td
                      className="border-b px-3 py-2.5 text-center"
                      style={{ borderColor: "#1c1c22" }}
                    >
                      {isDiff ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: "#a855f7" }}
                        />
                      ) : (
                        <span className="text-[10px] opacity-15">&mdash;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer
        className="flex h-8 flex-shrink-0 items-center justify-between border-t px-5 text-[10px]"
        style={{
          borderColor: "#1c1c22",
          backgroundColor: "#0c0c0f",
          color: "#3f3f46",
        }}
      >
        <span>
          {selectedExperiments.length} experiments selected &middot;{" "}
          {visibleFields.length} fields shown
        </span>
        <span>Max 4 experiments &middot; Mock data</span>
      </footer>
    </div>
  );
}
