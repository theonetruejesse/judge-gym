"use client";

import Link from "next/link";

const DESIGNS = [
  {
    id: 1,
    name: "Mission Control",
    description:
      "Dense monitoring panel. Sidebar experiment list, detail view with config, runs, and evidence tables.",
    aesthetic: "Industrial dark",
    color: "#ff6b35",
  },
  {
    id: 2,
    name: "The Codex",
    description:
      "Step-by-step wizard. Browse experiments sequentially: select, inspect config, review runs, read evidence.",
    aesthetic: "Warm editorial",
    color: "#b45309",
  },
  {
    id: 3,
    name: "The Ledger",
    description:
      "Spreadsheet grid. Every experiment in one table, every config field is a column. Sort, filter, scan.",
    aesthetic: "Clean systematic",
    color: "#2563eb",
  },
  {
    id: 4,
    name: "The Diff",
    description:
      "Comparison-first. Select multiple experiments, see configs side-by-side, differences highlighted.",
    aesthetic: "High contrast",
    color: "#a855f7",
  },
  {
    id: 5,
    name: "The Console",
    description:
      "Terminal interface. Type commands to list, inspect, and compare experiments. Keyboard-driven.",
    aesthetic: "Phosphor terminal",
    color: "#22c55e",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-16 md:px-12 lg:px-24">
      <div className="mx-auto max-w-4xl">
        <header className="mb-16">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            judge-gym
          </p>
          <h1 className="mb-4 text-5xl leading-tight tracking-tight">
            Lab Prototypes
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            Five structurally distinct UX approaches for configuring, monitoring,
            and inspecting LLM-as-Judge experiments. Each represents a different
            mental model.
          </p>
        </header>

        <div className="grid gap-4">
          {DESIGNS.map((d, i) => (
            <Link
              key={d.id}
              href={`/${d.id}`}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur transition-all duration-300 hover:border-border hover:bg-card/90 hover:shadow-lg"
              style={{
                animationDelay: `${i * 80}ms`,
              }}
            >
              <div className="flex items-start gap-6 p-6">
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: d.color }}
                >
                  {d.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">
                      {d.name}
                    </h2>
                    <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {d.aesthetic}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {d.description}
                  </p>
                </div>
                <div className="flex-shrink-0 self-center text-muted-foreground transition-transform duration-300 group-hover:translate-x-1">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M7 4l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <footer className="mt-16 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
          All prototypes use mock data. Buttons are non-functional placeholders.
        </footer>
      </div>
    </main>
  );
}
