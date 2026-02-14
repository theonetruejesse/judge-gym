import Link from "next/link";

export default function RouteFourLanding() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#f3efe8", color: "#2a2320" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-[#7a6f66]">
          Mission Control /4
        </p>
        <h1
          className="mt-4 text-4xl"
          style={{ fontFamily: "var(--font-4-heading)", color: "#3b2f28" }}
        >
          Dossier Reading Room
        </h1>
        <p className="mt-3 text-sm text-[#7a6f66]">
          A research dossier layout with a table of contents and longform reading pane.
        </p>
        <Link
          href="/4/experiments"
          className="mt-8 inline-flex items-center gap-2 rounded border px-4 py-2 text-xs uppercase tracking-widest"
          style={{ borderColor: "#d6c9bd", color: "#3b2f28" }}
        >
          Enter Experiments
        </Link>
      </div>
    </div>
  );
}
