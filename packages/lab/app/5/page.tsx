import Link from "next/link";

export default function RouteFiveLanding() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#111111", color: "#f4f1e8" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.5em] text-[#8b857b]">
          Mission Control /5
        </p>
        <h1
          className="mt-4 text-5xl"
          style={{ fontFamily: "var(--font-5-heading)", color: "#f4b942" }}
        >
          Control Board
        </h1>
        <p className="mt-3 text-sm text-[#b7b1a6]">
          Status columns, bold controls, and a tri-panel operational view.
        </p>
        <Link
          href="/5/experiments"
          className="mt-8 inline-flex items-center gap-2 rounded border px-4 py-2 text-xs uppercase tracking-widest"
          style={{ borderColor: "#2b2b2b", color: "#f4b942" }}
        >
          Enter Experiments
        </Link>
      </div>
    </div>
  );
}
