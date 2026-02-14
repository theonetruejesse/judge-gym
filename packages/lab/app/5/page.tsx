"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { VT323 } from "next/font/google";
import {
  EXPERIMENTS,
  EVIDENCE,
  getEvidenceForExperiment,
  getExperimentById,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  type MockExperiment,
} from "@/lib/mock-data";

const terminal = VT323({ subsets: ["latin"], weight: ["400"] });

// ─── Command output types ───────────────────────────────────────────────────

type OutputLine = {
  type: "input" | "output" | "error" | "heading" | "table" | "blank";
  text: string;
};

// ─── ASCII table helpers ────────────────────────────────────────────────────

function padRight(str: string, len: number) {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function asciiTable(headers: string[], rows: string[][], colWidths: number[]): string[] {
  const sep = "+" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const formatRow = (cells: string[]) =>
    "|" +
    cells.map((c, i) => " " + padRight(c, colWidths[i]) + " ").join("|") +
    "|";
  const lines = [sep, formatRow(headers), sep];
  for (const row of rows) {
    lines.push(formatRow(row));
  }
  lines.push(sep);
  return lines;
}

// ─── Command executor ───────────────────────────────────────────────────────

function executeCommand(input: string): OutputLine[] {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const arg1 = parts[1];
  const arg2 = parts[2];

  if (!cmd) return [];

  switch (cmd) {
    case "help":
      return [
        { type: "heading", text: "Available commands:" },
        { type: "output", text: "  ls                    List all experiments" },
        { type: "output", text: "  show <tag>            Show experiment details" },
        { type: "output", text: "  runs <tag>            Show runs for an experiment" },
        { type: "output", text: "  evidence <tag>        Show evidence for an experiment" },
        { type: "output", text: "  compare <tag> <tag>   Compare two experiments" },
        { type: "output", text: "  stats                 Show summary statistics" },
        { type: "output", text: "  clear                 Clear the screen" },
        { type: "output", text: "  help                  Show this help message" },
      ];

    case "ls":
    case "list": {
      const headers = ["TAG", "TYPE", "STATUS", "RUBRIC", "SCORER", "SCALE"];
      const widths = [30, 10, 10, 18, 18, 5];
      const rows = EXPERIMENTS.map((e) => [
        e.tag,
        TASK_TYPE_LABELS[e.taskType],
        e.status.toUpperCase(),
        e.rubricModel,
        e.scoringModel,
        `${e.scaleSize}pt`,
      ]);
      const table = asciiTable(headers, rows, widths);
      return [
        ...table.map((line) => ({ type: "table" as const, text: line })),
        { type: "blank", text: "" },
        { type: "output", text: `${EXPERIMENTS.length} experiments found.` },
      ];
    }

    case "show": {
      if (!arg1)
        return [{ type: "error", text: "Usage: show <tag>" }];
      const exp = EXPERIMENTS.find(
        (e) => e.tag === arg1 || e.id === arg1,
      );
      if (!exp)
        return [{ type: "error", text: `Experiment not found: ${arg1}` }];

      return [
        { type: "heading", text: `Experiment: ${exp.tag}` },
        { type: "output", text: `  ID:              ${exp.id}` },
        { type: "output", text: `  Status:          ${exp.status.toUpperCase()}` },
        { type: "output", text: `  Task Type:       ${TASK_TYPE_LABELS[exp.taskType]}` },
        { type: "output", text: `  Rubric Model:    ${exp.rubricModel}` },
        { type: "output", text: `  Scoring Model:   ${exp.scoringModel}` },
        { type: "output", text: `  Scale Size:      ${exp.scaleSize}-point` },
        { type: "output", text: `  Evidence View:   ${VIEW_LABELS[exp.evidenceView]}` },
        { type: "output", text: `  Scoring Method:  ${exp.scoringMethod}` },
        { type: "output", text: `  Prompt Ordering: ${exp.promptOrdering}` },
        { type: "output", text: `  Abstain:         ${exp.abstainEnabled ? "yes" : "no"}` },
        {
          type: "output",
          text: `  Randomizations:  ${exp.randomizations.length > 0 ? exp.randomizations.join(", ") : "none"}`,
        },
        { type: "output", text: `  Concept:         ${exp.window.concept}` },
        { type: "output", text: `  Country:         ${exp.window.country}` },
        {
          type: "output",
          text: `  Window:          ${exp.window.startDate} -> ${exp.window.endDate}`,
        },
        { type: "output", text: `  Runs:            ${exp.runs.length}` },
        {
          type: "output",
          text: `  Evidence:        ${getEvidenceForExperiment(exp.id).length} items`,
        },
        { type: "output", text: `  Created:         ${exp.createdAt}` },
      ];
    }

    case "runs": {
      if (!arg1) return [{ type: "error", text: "Usage: runs <tag>" }];
      const exp = EXPERIMENTS.find(
        (e) => e.tag === arg1 || e.id === arg1,
      );
      if (!exp)
        return [{ type: "error", text: `Experiment not found: ${arg1}` }];

      if (exp.runs.length === 0)
        return [{ type: "output", text: "No runs for this experiment." }];

      const lines: OutputLine[] = [
        { type: "heading", text: `Runs for ${exp.tag}:` },
      ];
      for (const run of exp.runs) {
        lines.push({ type: "blank", text: "" });
        lines.push({ type: "output", text: `  Run: ${run.id}` });
        lines.push({
          type: "output",
          text: `  Status: ${run.status.toUpperCase()}  Progress: ${run.progress}%  Samples: ${run.completedSamples}/${run.totalSamples}`,
        });
        if (run.stages.length > 0) {
          lines.push({ type: "output", text: "  Stages:" });
          for (const stage of run.stages) {
            const bar =
              "[" +
              "#".repeat(Math.floor(stage.progress / 5)) +
              ".".repeat(20 - Math.floor(stage.progress / 5)) +
              "]";
            lines.push({
              type: "output",
              text: `    ${padRight(stage.name, 22)} ${padRight(stage.status.toUpperCase(), 10)} ${bar} ${stage.progress}%`,
            });
          }
        }
      }
      return lines;
    }

    case "evidence":
    case "ev": {
      if (!arg1)
        return [{ type: "error", text: "Usage: evidence <tag>" }];
      const exp = EXPERIMENTS.find(
        (e) => e.tag === arg1 || e.id === arg1,
      );
      if (!exp)
        return [{ type: "error", text: `Experiment not found: ${arg1}` }];

      const ev = getEvidenceForExperiment(exp.id);
      if (ev.length === 0)
        return [
          { type: "output", text: "No evidence collected for this experiment." },
        ];

      const lines: OutputLine[] = [
        { type: "heading", text: `Evidence for ${exp.tag} (${ev.length} items):` },
        { type: "blank", text: "" },
      ];
      for (const item of ev) {
        lines.push({
          type: "output",
          text: `  [${VIEW_LABELS[item.view]}] ${item.title}`,
        });
        lines.push({
          type: "output",
          text: `    ${item.snippet.slice(0, 90)}...`,
        });
        lines.push({
          type: "output",
          text: `    Source: ${item.sourceUrl}`,
        });
        lines.push({ type: "blank", text: "" });
      }
      return lines;
    }

    case "compare":
    case "diff": {
      if (!arg1 || !arg2)
        return [{ type: "error", text: "Usage: compare <tag1> <tag2>" }];
      const e1 = EXPERIMENTS.find(
        (e) => e.tag === arg1 || e.id === arg1,
      );
      const e2 = EXPERIMENTS.find(
        (e) => e.tag === arg2 || e.id === arg2,
      );
      if (!e1)
        return [{ type: "error", text: `Experiment not found: ${arg1}` }];
      if (!e2)
        return [{ type: "error", text: `Experiment not found: ${arg2}` }];

      const fields: [string, string, string][] = [
        ["Status", e1.status, e2.status],
        ["Task Type", TASK_TYPE_LABELS[e1.taskType], TASK_TYPE_LABELS[e2.taskType]],
        ["Rubric", e1.rubricModel, e2.rubricModel],
        ["Scorer", e1.scoringModel, e2.scoringModel],
        ["Scale", `${e1.scaleSize}pt`, `${e2.scaleSize}pt`],
        ["View", VIEW_LABELS[e1.evidenceView], VIEW_LABELS[e2.evidenceView]],
        ["Method", e1.scoringMethod, e2.scoringMethod],
        ["Ordering", e1.promptOrdering, e2.promptOrdering],
        ["Abstain", e1.abstainEnabled ? "yes" : "no", e2.abstainEnabled ? "yes" : "no"],
        ["Concept", e1.window.concept, e2.window.concept],
        ["Country", e1.window.country, e2.window.country],
      ];

      const headers = ["FIELD", e1.tag.slice(0, 24), e2.tag.slice(0, 24), "DIFF"];
      const widths = [14, 24, 24, 4];
      const rows = fields.map(([label, v1, v2]) => [
        label,
        v1,
        v2,
        v1 !== v2 ? " <>" : "  =",
      ]);
      const table = asciiTable(headers, rows, widths);
      const diffCount = fields.filter(([, v1, v2]) => v1 !== v2).length;

      return [
        ...table.map((line) => ({ type: "table" as const, text: line })),
        { type: "blank", text: "" },
        {
          type: "output",
          text: `${diffCount} of ${fields.length} fields differ.`,
        },
      ];
    }

    case "stats": {
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      for (const e of EXPERIMENTS) {
        byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
        byType[e.taskType] = (byType[e.taskType] ?? 0) + 1;
      }
      return [
        { type: "heading", text: "Summary Statistics" },
        { type: "output", text: `  Total experiments: ${EXPERIMENTS.length}` },
        { type: "output", text: `  Total evidence:    ${EVIDENCE.length}` },
        { type: "blank", text: "" },
        { type: "output", text: "  By status:" },
        ...Object.entries(byStatus).map(([k, v]) => ({
          type: "output" as const,
          text: `    ${padRight(k.toUpperCase(), 12)} ${v}`,
        })),
        { type: "blank", text: "" },
        { type: "output", text: "  By type:" },
        ...Object.entries(byType).map(([k, v]) => ({
          type: "output" as const,
          text: `    ${padRight(TASK_TYPE_LABELS[k as keyof typeof TASK_TYPE_LABELS] ?? k, 12)} ${v}`,
        })),
      ];
    }

    case "clear":
      return []; // handled specially

    default:
      return [
        {
          type: "error",
          text: `Unknown command: ${cmd}. Type 'help' for available commands.`,
        },
      ];
  }
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function TheConsolePage() {
  const [history, setHistory] = useState<OutputLine[]>([
    { type: "heading", text: "judge-gym console v0.1.0" },
    { type: "output", text: "Type 'help' for available commands. Tab-complete experiment tags." },
    { type: "blank", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input on click anywhere
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Tab completion
  const allTags = EXPERIMENTS.map((e) => e.tag);
  const allCommands = ["help", "ls", "list", "show", "runs", "evidence", "ev", "compare", "diff", "stats", "clear"];

  const handleTab = () => {
    const parts = input.trim().split(/\s+/);
    const current = parts[parts.length - 1]?.toLowerCase() ?? "";
    if (!current) return;

    // Complete commands if it's the first word
    if (parts.length === 1) {
      const matches = allCommands.filter((c) => c.startsWith(current));
      if (matches.length === 1) {
        setInput(matches[0] + " ");
        setSuggestions([]);
      } else if (matches.length > 1) {
        setSuggestions(matches);
      }
      return;
    }

    // Complete experiment tags
    const matches = allTags.filter((t) => t.startsWith(current));
    if (matches.length === 1) {
      parts[parts.length - 1] = matches[0];
      setInput(parts.join(" ") + " ");
      setSuggestions([]);
    } else if (matches.length > 1) {
      setSuggestions(matches);
    }
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setSuggestions([]);
    setCmdHistory((prev) => [trimmed, ...prev]);
    setHistoryIdx(-1);

    if (trimmed === "clear") {
      setHistory([]);
      setInput("");
      return;
    }

    const inputLine: OutputLine = { type: "input", text: `> ${trimmed}` };
    const output = executeCommand(trimmed);

    setHistory((prev) => [...prev, inputLine, ...output, { type: "blank", text: "" }]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      handleTab();
    } else if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
        setHistoryIdx(newIdx);
        setInput(cmdHistory[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setInput(cmdHistory[newIdx]);
      } else {
        setHistoryIdx(-1);
        setInput("");
      }
    } else {
      setSuggestions([]);
    }
  };

  return (
    <div
      className={`${terminal.className} fixed inset-0 flex flex-col`}
      style={{
        backgroundColor: "#0a0a0a",
        color: "#33ff33",
        fontSize: "16px",
        letterSpacing: "0.5px",
      }}
      onClick={focusInput}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
        }}
      />

      {/* CRT vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Top bar */}
      <div
        className="relative z-20 flex h-8 flex-shrink-0 items-center justify-between border-b px-4"
        style={{
          borderColor: "#1a3a1a",
          backgroundColor: "#050505",
        }}
      >
        <Link
          href="/"
          className="text-xs hover:underline"
          style={{ color: "#1a5c1a" }}
        >
          [ESC] back
        </Link>
        <span style={{ color: "#1a5c1a", fontSize: "14px" }}>
          judge-gym :: the console
        </span>
        <span style={{ color: "#1a5c1a", fontSize: "14px" }}>
          {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        className="relative z-20 flex-1 overflow-y-auto px-4 py-3"
        style={{ lineHeight: "1.6" }}
      >
        {history.map((line, i) => (
          <div key={i} style={getLineStyle(line.type)}>
            {line.text || "\u00A0"}
          </div>
        ))}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-1" style={{ color: "#1a8c1a" }}>
            {suggestions.join("  ")}
          </div>
        )}
      </div>

      {/* Input line */}
      <div
        className="relative z-20 flex items-center border-t px-4 py-2"
        style={{
          borderColor: "#1a3a1a",
          backgroundColor: "#050505",
        }}
      >
        <span style={{ color: "#33ff33" }}>&gt;&nbsp;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 border-none bg-transparent outline-none"
          style={{
            color: "#33ff33",
            caretColor: "#33ff33",
            fontFamily: "inherit",
            fontSize: "inherit",
            letterSpacing: "inherit",
          }}
          spellCheck={false}
        />
        <span
          className="animate-pulse"
          style={{
            color: "#33ff33",
            fontSize: "18px",
          }}
        >
          _
        </span>
      </div>
    </div>
  );
}

// ─── Line styling ───────────────────────────────────────────────────────────

function getLineStyle(
  type: OutputLine["type"],
): React.CSSProperties {
  switch (type) {
    case "input":
      return { color: "#ffb000" };
    case "error":
      return { color: "#ff4444" };
    case "heading":
      return { color: "#55ff55", fontWeight: "bold" };
    case "table":
      return { color: "#22cc22", whiteSpace: "pre" };
    case "blank":
      return {};
    default:
      return { color: "#33ff33", whiteSpace: "pre" };
  }
}
