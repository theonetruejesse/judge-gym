"use client";

import { useState } from "react";
import Link from "next/link";
import { Playfair_Display, Crimson_Pro } from "next/font/google";
import {
  EXPERIMENTS,
  getEvidenceForExperiment,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  type MockExperiment,
  type MockEvidence,
} from "@/lib/mock-data";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});
const body = Crimson_Pro({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
  { key: "select", label: "Select", number: "I" },
  { key: "config", label: "Configuration", number: "II" },
  { key: "runs", label: "Runs", number: "III" },
  { key: "evidence", label: "Evidence", number: "IV" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

// ─── Main page ──────────────────────────────────────────────────────────────

export default function TheCodexPage() {
  const [step, setStep] = useState<StepKey>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId
    ? EXPERIMENTS.find((e) => e.id === selectedId) ?? null
    : null;
  const evidence = selected ? getEvidenceForExperiment(selected.id) : [];

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const canGoBack = currentStepIndex > 0;
  const canGoForward =
    currentStepIndex < STEPS.length - 1 && (step === "select" ? !!selected : true);

  const goNext = () => {
    if (canGoForward) setStep(STEPS[currentStepIndex + 1].key);
  };
  const goBack = () => {
    if (canGoBack) setStep(STEPS[currentStepIndex - 1].key);
  };

  return (
    <div
      className={`${body.className} fixed inset-0 overflow-y-auto`}
      style={{
        backgroundColor: "#faf6f0",
        color: "#2c2824",
        fontSize: "16px",
      }}
    >
      {/* Subtle texture */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <div className="relative mx-auto max-w-2xl px-6 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <Link
            href="/"
            className="mb-6 inline-block text-xs tracking-[0.3em] uppercase opacity-30 hover:opacity-60 transition-opacity"
            style={{ fontFamily: body.style.fontFamily }}
          >
            &larr; Back to Lab
          </Link>
          <h1
            className={`${display.className} text-4xl tracking-tight`}
            style={{ color: "#1a1714" }}
          >
            The Codex
          </h1>
          <p
            className="mt-2 text-sm tracking-wide opacity-40"
            style={{ letterSpacing: "0.15em" }}
          >
            STEP-BY-STEP EXPERIMENT INSPECTION
          </p>
        </header>

        {/* Step indicator */}
        <nav className="mb-12 flex items-center justify-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <button
                onClick={() => {
                  if (s.key === "select" || selected) setStep(s.key);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded transition-all"
                style={{
                  opacity: step === s.key ? 1 : 0.35,
                }}
              >
                <span
                  className={`${display.className} text-sm`}
                  style={{
                    color: step === s.key ? "#92400e" : "#2c2824",
                  }}
                >
                  {s.number}
                </span>
                <span
                  className="text-xs tracking-wider uppercase"
                  style={{
                    color: step === s.key ? "#92400e" : "#2c2824",
                    fontWeight: step === s.key ? 600 : 400,
                  }}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className="mx-1 h-px w-8"
                  style={{ backgroundColor: "#d4c8b8" }}
                />
              )}
            </div>
          ))}
        </nav>

        {/* Divider */}
        <div
          className="mb-10 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, #c4b8a4, transparent)",
          }}
        />

        {/* Step content */}
        <div className="min-h-[400px]">
          {step === "select" && (
            <SelectStep
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
          )}
          {step === "config" && selected && (
            <ConfigStep experiment={selected} />
          )}
          {step === "runs" && selected && <RunsStep experiment={selected} />}
          {step === "evidence" && selected && (
            <EvidenceStep evidence={evidence} />
          )}
        </div>

        {/* Navigation */}
        <div
          className="mt-12 flex items-center justify-between border-t pt-8"
          style={{ borderColor: "#e0d6c8" }}
        >
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="flex items-center gap-2 text-sm transition-opacity"
            style={{
              opacity: canGoBack ? 0.7 : 0.2,
              cursor: canGoBack ? "pointer" : "default",
            }}
          >
            <span>&larr;</span>
            <span>Previous</span>
          </button>

          <span className="text-xs opacity-30">
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>

          <button
            onClick={goNext}
            disabled={!canGoForward}
            className="flex items-center gap-2 text-sm font-semibold transition-opacity"
            style={{
              opacity: canGoForward ? 1 : 0.2,
              color: canGoForward ? "#92400e" : "#2c2824",
              cursor: canGoForward ? "pointer" : "default",
            }}
          >
            <span>Next</span>
            <span>&rarr;</span>
          </button>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-[11px] opacity-20">
          Mock data &middot; Buttons are non-functional placeholders
        </footer>
      </div>
    </div>
  );
}

// ─── Step: Select ───────────────────────────────────────────────────────────

function SelectStep({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2
        className={`${display.className} mb-2 text-2xl`}
        style={{ color: "#1a1714" }}
      >
        Choose an experiment
      </h2>
      <p className="mb-8 text-sm opacity-50 leading-relaxed">
        Select the experiment you wish to inspect. Each card shows the tag,
        concept, and current status.
      </p>

      <div className="space-y-3">
        {EXPERIMENTS.map((exp) => (
          <button
            key={exp.id}
            onClick={() => onSelect(exp.id)}
            className="w-full rounded-lg border p-4 text-left transition-all"
            style={{
              borderColor:
                exp.id === selectedId ? "#92400e" : "#e0d6c8",
              backgroundColor:
                exp.id === selectedId ? "#fdf4e8" : "transparent",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`${display.className} text-base`}
                    style={{
                      color:
                        exp.id === selectedId ? "#92400e" : "#1a1714",
                    }}
                  >
                    {exp.tag}
                  </span>
                </div>
                <p className="mt-1 text-xs opacity-40">
                  {exp.window.concept} &middot; {exp.window.country} &middot;{" "}
                  {exp.window.startDate} &rarr; {exp.window.endDate}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor:
                    STATUS_COLORS[exp.status as keyof typeof STATUS_COLORS] + "18",
                  color:
                    STATUS_COLORS[exp.status as keyof typeof STATUS_COLORS],
                }}
              >
                {exp.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step: Configuration ────────────────────────────────────────────────────

function ConfigStep({ experiment: e }: { experiment: MockExperiment }) {
  const sections = [
    {
      title: "Models",
      fields: [
        ["Rubric Model", e.rubricModel],
        ["Scoring Model", e.scoringModel],
      ],
    },
    {
      title: "Design Space",
      fields: [
        ["Task Type", TASK_TYPE_LABELS[e.taskType]],
        ["Scale Size", `${e.scaleSize}-point`],
        ["Evidence View", VIEW_LABELS[e.evidenceView]],
        ["Scoring Method", e.scoringMethod],
        ["Prompt Ordering", e.promptOrdering],
        ["Abstain Enabled", e.abstainEnabled ? "Yes" : "No"],
        [
          "Randomizations",
          e.randomizations.length > 0
            ? e.randomizations.join(", ")
            : "None",
        ],
      ],
    },
    {
      title: "Window",
      fields: [
        ["Concept", e.window.concept],
        ["Country", e.window.country],
        ["Period", `${e.window.startDate} to ${e.window.endDate}`],
      ],
    },
  ];

  return (
    <div>
      <h2
        className={`${display.className} mb-2 text-2xl`}
        style={{ color: "#1a1714" }}
      >
        Configuration
      </h2>
      <p className="mb-8 text-sm opacity-50">
        Full configuration for{" "}
        <strong style={{ color: "#92400e" }}>{e.tag}</strong>.
      </p>

      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h3
              className={`${display.className} mb-3 text-lg`}
              style={{ color: "#5a4e40" }}
            >
              {section.title}
            </h3>
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: "#e0d6c8" }}
            >
              {section.fields.map(([label, value], i) => (
                <div
                  key={label}
                  className="flex border-b last:border-b-0"
                  style={{ borderColor: "#ede6da" }}
                >
                  <div
                    className="w-44 flex-shrink-0 px-4 py-3 text-xs font-medium uppercase tracking-wider"
                    style={{
                      color: "#8a7e6e",
                      backgroundColor: "#f5efe6",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    className="flex-1 px-4 py-3 text-sm"
                    style={{ color: "#1a1714" }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          className="rounded-lg px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors"
          style={{ backgroundColor: "#92400e" }}
          onClick={() => {}}
        >
          Generate Config
        </button>
        <button
          className="rounded-lg border px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors"
          style={{ borderColor: "#d4c8b8", color: "#8a7e6e" }}
          onClick={() => {}}
        >
          Export
        </button>
      </div>
    </div>
  );
}

// ─── Step: Runs ─────────────────────────────────────────────────────────────

function RunsStep({ experiment }: { experiment: MockExperiment }) {
  if (experiment.runs.length === 0) {
    return (
      <div>
        <h2
          className={`${display.className} mb-2 text-2xl`}
          style={{ color: "#1a1714" }}
        >
          Runs
        </h2>
        <div
          className="mt-8 rounded-lg border px-8 py-12 text-center"
          style={{ borderColor: "#e0d6c8" }}
        >
          <p className="text-sm opacity-40">
            No runs have been executed for this experiment.
          </p>
          <button
            className="mt-4 rounded-lg px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white"
            style={{ backgroundColor: "#92400e" }}
            onClick={() => {}}
          >
            Launch Run
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2
        className={`${display.className} mb-2 text-2xl`}
        style={{ color: "#1a1714" }}
      >
        Runs
      </h2>
      <p className="mb-8 text-sm opacity-50">
        {experiment.runs.length} run{experiment.runs.length !== 1 ? "s" : ""}{" "}
        recorded for this experiment.
      </p>

      <div className="space-y-6">
        {experiment.runs.map((run) => (
          <div
            key={run.id}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "#e0d6c8" }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ backgroundColor: "#f5efe6" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`${display.className} text-sm`}
                  style={{ color: "#1a1714" }}
                >
                  {run.id}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    backgroundColor:
                      STATUS_COLORS[run.status as keyof typeof STATUS_COLORS] + "18",
                    color:
                      STATUS_COLORS[run.status as keyof typeof STATUS_COLORS],
                  }}
                >
                  {run.status}
                </span>
              </div>
              <span className="text-xs opacity-40">
                {run.completedSamples}/{run.totalSamples} samples &middot;{" "}
                {run.progress}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1" style={{ backgroundColor: "#ede6da" }}>
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${run.progress}%`,
                  backgroundColor: "#92400e",
                }}
              />
            </div>

            {/* Stages */}
            <div className="px-4 py-3">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="pb-2 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: "#8a7e6e" }}>
                      Stage
                    </th>
                    <th className="pb-2 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: "#8a7e6e" }}>
                      Status
                    </th>
                    <th className="pb-2 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: "#8a7e6e" }}>
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {run.stages.map((stage) => (
                    <tr
                      key={stage.name}
                      className="border-t"
                      style={{ borderColor: "#ede6da" }}
                    >
                      <td className="py-2 text-sm" style={{ color: "#2c2824" }}>
                        {stage.name}
                      </td>
                      <td className="py-2 text-xs capitalize opacity-60">
                        {stage.status}
                      </td>
                      <td className="py-2 text-right text-xs opacity-50">
                        {stage.progress}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step: Evidence ─────────────────────────────────────────────────────────

function EvidenceStep({ evidence }: { evidence: MockEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <div>
        <h2
          className={`${display.className} mb-2 text-2xl`}
          style={{ color: "#1a1714" }}
        >
          Evidence
        </h2>
        <div
          className="mt-8 rounded-lg border px-8 py-12 text-center"
          style={{ borderColor: "#e0d6c8" }}
        >
          <p className="text-sm opacity-40">
            No evidence has been collected for this experiment window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2
        className={`${display.className} mb-2 text-2xl`}
        style={{ color: "#1a1714" }}
      >
        Evidence
      </h2>
      <p className="mb-8 text-sm opacity-50">
        {evidence.length} piece{evidence.length !== 1 ? "s" : ""} of evidence
        collected.
      </p>

      <div className="space-y-4">
        {evidence.map((ev) => (
          <article
            key={ev.id}
            className="rounded-lg border p-5"
            style={{ borderColor: "#e0d6c8" }}
          >
            <div className="mb-2 flex items-start justify-between">
              <h3
                className={`${display.className} text-base`}
                style={{ color: "#1a1714" }}
              >
                {ev.title}
              </h3>
              <span
                className="ml-3 flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
                style={{ borderColor: "#d4c8b8", color: "#8a7e6e" }}
              >
                {VIEW_LABELS[ev.view]}
              </span>
            </div>
            <p
              className="mb-3 text-sm leading-relaxed"
              style={{ color: "#5a4e40" }}
            >
              {ev.snippet}
            </p>
            <div className="flex items-center gap-4 text-[11px] opacity-35">
              <span>{ev.sourceUrl}</span>
              <span>&middot;</span>
              <span>{new Date(ev.collectedAt).toLocaleDateString()}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
