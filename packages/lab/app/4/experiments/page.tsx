import Link from "next/link";
import { EXPERIMENTS, STATUS_COLORS, TASK_TYPE_LABELS } from "@/lib/mock-data";

export default function RouteFourExperimentsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#f3efe8", color: "#2a2320" }}
    >
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <aside className="border-r border-[#d6c9bd] px-5 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#7a6f66]">
            Dossier Index
          </p>
          <h1
            className="mt-3 text-xl"
            style={{ fontFamily: "var(--font-4-heading)" }}
          >
            Experiments
          </h1>
          <nav className="mt-6 grid gap-3 text-xs uppercase tracking-widest text-[#7a6f66]">
            <Link href="/4/experiments" className="text-[#3b2f28]">
              Archive
            </Link>
            <Link href="/4/editor">New Experiment</Link>
            <Link href="/">All Layouts</Link>
          </nav>
          <div className="mt-8 text-[10px] uppercase tracking-[0.3em] text-[#b0a599]">
            Totals
          </div>
          <div className="mt-3 space-y-2 text-xs text-[#7a6f66]">
            <div>Total: {EXPERIMENTS.length}</div>
            <div>Running: {EXPERIMENTS.filter((e) => e.status === "running").length}</div>
            <div>Complete: {EXPERIMENTS.filter((e) => e.status === "complete").length}</div>
          </div>
        </aside>

        <main className="px-8 py-6">
          <header>
            <p className="text-xs uppercase tracking-[0.3em] text-[#7a6f66]">
              Archive Ledger
            </p>
            <h2
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-4-heading)" }}
            >
              Experiment Dossiers
            </h2>
          </header>

          <div className="mt-6 grid gap-4">
            {EXPERIMENTS.map((exp) => (
              <Link
                key={exp.id}
                href={`/4/experiment/${exp.id}`}
                className="rounded border border-[#d6c9bd] bg-[#fbf6ef] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3
                      className="text-xl"
                      style={{ fontFamily: "var(--font-4-heading)" }}
                    >
                      {exp.tag}
                    </h3>
                    <p className="mt-1 text-sm text-[#7a6f66]">
                      {TASK_TYPE_LABELS[exp.taskType]}  -  {exp.concept}  - {" "}
                      {exp.scaleSize}-pt
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest"
                    style={{
                      backgroundColor: `${STATUS_COLORS[exp.status]}22`,
                      color: STATUS_COLORS[exp.status],
                    }}
                  >
                    {exp.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-[#7a6f66] md:grid-cols-3">
                  <div>Window: {exp.window.country}</div>
                  <div>Rubric: {exp.rubricModel}</div>
                  <div>Created: {new Date(exp.createdAt).toLocaleDateString()}</div>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
