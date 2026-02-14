import Link from "next/link";
import { EXPERIMENTS, STATUS_COLORS, TASK_TYPE_LABELS } from "@/lib/mock-data";

export default function RouteThreeExperimentsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0a0c10", color: "#d2e1ff" }}
    >
      <div className="grid min-h-screen grid-cols-[220px_1fr]">
        <aside className="border-r border-[#1c2436] px-5 py-6">
          <h1
            className="text-lg"
            style={{ fontFamily: "var(--font-3-heading)", color: "#6df0ff" }}
          >
            Command Grid
          </h1>
          <nav className="mt-6 grid gap-3 text-xs uppercase tracking-widest text-[#6c7b99]">
            <Link href="/3/experiments" className="text-[#6df0ff]">
              Experiments
            </Link>
            <Link href="/3/editor">New Experiment</Link>
            <Link href="/">All Layouts</Link>
          </nav>
          <div className="mt-8 text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
            Status Overview
          </div>
          <div className="mt-3 space-y-2 text-xs text-[#8aa0c7]">
            <div>Running: {EXPERIMENTS.filter((e) => e.status === "running").length}</div>
            <div>Complete: {EXPERIMENTS.filter((e) => e.status === "complete").length}</div>
            <div>Paused: {EXPERIMENTS.filter((e) => e.status === "paused").length}</div>
          </div>
        </aside>

        <main className="px-8 py-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
                Experiments
              </p>
              <h2
                className="mt-2 text-2xl"
                style={{ fontFamily: "var(--font-3-heading)" }}
              >
                Mission Control Queue
              </h2>
            </div>
            <Link
              href="/3/editor"
              className="rounded border border-[#22304a] px-3 py-2 text-xs uppercase tracking-widest text-[#6df0ff]"
            >
              New Experiment
            </Link>
          </header>

          <div className="mt-6 grid gap-4">
            {EXPERIMENTS.map((exp) => (
              <Link
                key={exp.id}
                href={`/3/experiment/${exp.id}`}
                className="grid gap-3 rounded border border-[#22304a] bg-[#0f1522] px-5 py-4 transition hover:border-[#6df0ff]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3
                      className="text-lg"
                      style={{ fontFamily: "var(--font-3-heading)" }}
                    >
                      {exp.tag}
                    </h3>
                    <p className="text-xs text-[#8aa0c7]">{exp.concept}</p>
                  </div>
                  <span
                    className="rounded border px-3 py-1 text-[10px] uppercase tracking-widest"
                    style={{
                      borderColor: STATUS_COLORS[exp.status],
                      color: STATUS_COLORS[exp.status],
                    }}
                  >
                    {exp.status}
                  </span>
                </div>
                <div className="grid gap-2 text-xs text-[#8aa0c7] md:grid-cols-3">
                  <div>Task: {TASK_TYPE_LABELS[exp.taskType]}</div>
                  <div>Scale: {exp.scaleSize}-pt</div>
                  <div>Window: {exp.window.country}</div>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
