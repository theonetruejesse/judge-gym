import Link from "next/link";
import { EXPERIMENTS, STATUS_COLORS } from "@/lib/mock-data";

const statuses = ["running", "complete", "paused", "pending", "canceled"] as const;

export default function RouteFiveExperimentsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#111111", color: "#f4f1e8" }}
    >
      <header className="border-b border-[#2b2b2b] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-[#8b857b]">
              Control Board
            </p>
            <h1
              className="mt-2 text-4xl"
              style={{ fontFamily: "var(--font-5-heading)", color: "#f4b942" }}
            >
              Experiment Status Columns
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/5/editor"
              className="rounded border border-[#2b2b2b] px-3 py-2 text-xs uppercase tracking-widest text-[#f4b942]"
            >
              New Experiment
            </Link>
            <Link
              href="/"
              className="rounded border border-[#2b2b2b] px-3 py-2 text-xs uppercase tracking-widest text-[#8b857b]"
            >
              All Layouts
            </Link>
          </div>
        </div>
      </header>

      <div className="px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-5">
          {statuses.map((status) => {
            const items = EXPERIMENTS.filter((exp) => exp.status === status);
            return (
              <div
                key={status}
                className="rounded border border-[#2b2b2b] bg-[#171717] p-3"
              >
                <div className="flex items-center justify-between">
                  <h2
                    className="text-xl"
                    style={{ fontFamily: "var(--font-5-heading)" }}
                  >
                    {status}
                  </h2>
                  <span
                    className="text-xs"
                    style={{ color: STATUS_COLORS[status] }}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {items.map((exp) => (
                    <Link
                      key={exp.id}
                      href={`/5/experiment/${exp.id}`}
                      className="block rounded border border-[#2b2b2b] bg-[#101010] p-3"
                    >
                      <div className="text-sm" style={{ color: "#f4f1e8" }}>
                        {exp.tag}
                      </div>
                      <div className="mt-1 text-xs text-[#8b857b]">
                        {exp.window.country}  -  {exp.scaleSize}-pt
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
