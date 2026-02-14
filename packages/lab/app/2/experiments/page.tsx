import Link from "next/link";
import { EXPERIMENTS, STATUS_COLORS, TASK_TYPE_LABELS } from "@/lib/mock-data";

export default function RouteTwoExperimentsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#f7f3ed", color: "#2a2620" }}
    >
      <header className="border-b border-[#e2d7c6] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#6f675b]">
              Mission Control Ledger
            </p>
            <h1
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-2-heading)" }}
            >
              Experiments Archive
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/2/editor"
              className="rounded border border-[#d8cfbf] px-3 py-2 text-xs uppercase tracking-widest text-[#4b3c2f]"
            >
              New Experiment
            </Link>
            <Link
              href="/"
              className="rounded border border-[#d8cfbf] px-3 py-2 text-xs uppercase tracking-widest text-[#6f675b]"
            >
              All Layouts
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="space-y-4">
          {EXPERIMENTS.map((exp) => (
            <Link
              key={exp.id}
              href={`/2/experiment/${exp.id}`}
              className="block rounded border border-[#e2d7c6] bg-[#fffaf3] p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:-translate-y-[1px]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2
                    className="text-xl"
                    style={{ fontFamily: "var(--font-2-heading)" }}
                  >
                    {exp.tag}
                  </h2>
                  <p className="mt-1 text-sm text-[#6f675b]">
                    Concept: {exp.concept}  -  {TASK_TYPE_LABELS[exp.taskType]}  - {" "}
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
              <div className="mt-4 grid gap-2 text-xs text-[#6f675b] md:grid-cols-3">
                <div>Window: {exp.window.country}</div>
                <div>Models: {exp.rubricModel}</div>
                <div>Created: {new Date(exp.createdAt).toLocaleDateString()}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
