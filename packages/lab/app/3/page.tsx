import Link from "next/link";

export default function RouteThreeLanding() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0a0c10", color: "#d2e1ff" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.4em] text-[#6c7b99]">
          Mission Control /3
        </p>
        <h1
          className="mt-4 text-4xl"
          style={{ fontFamily: "var(--font-3-heading)", color: "#6df0ff" }}
        >
          Command Grid
        </h1>
        <p className="mt-3 text-sm text-[#8aa0c7]">
          A three-pane tactical dashboard with a run strip and inspector rail.
        </p>
        <Link
          href="/3/experiments"
          className="mt-8 inline-flex items-center gap-2 rounded border px-4 py-2 text-xs uppercase tracking-widest"
          style={{ borderColor: "#22304a", color: "#6df0ff" }}
        >
          Enter Experiments
        </Link>
      </div>
    </div>
  );
}
