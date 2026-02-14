import Link from "next/link";

export default function RouteTwoLanding() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#f7f3ed", color: "#2a2620" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-[#6f675b]">
          Mission Control /2
        </p>
        <h1
          className="mt-4 text-4xl"
          style={{ fontFamily: "var(--font-2-heading)", color: "#4b3c2f" }}
        >
          Editorial Ledger
        </h1>
        <p className="mt-3 text-sm text-[#6f675b]">
          A longform, stacked layout with sectioned panels and a reading-room
          sensibility.
        </p>
        <Link
          href="/2/experiments"
          className="mt-8 inline-flex items-center gap-2 rounded border px-4 py-2 text-xs uppercase tracking-widest"
          style={{ borderColor: "#d8cfbf", color: "#4b3c2f" }}
        >
          Enter Experiments
        </Link>
      </div>
    </div>
  );
}
