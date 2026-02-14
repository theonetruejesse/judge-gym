import Link from "next/link";

export default function RouteOneLanding() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.4em] opacity-50">
          Mission Control /1
        </p>
        <h1
          className="mt-4 text-3xl font-bold"
          style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
        >
          Industrial Sidebar + Tabs
        </h1>
        <p className="mt-3 text-sm opacity-70">
          The canonical Mission Control layout: persistent sidebar, tabbed detail
          panel, and status bar.
        </p>
        <Link
          href="/1/experiments"
          className="mt-8 inline-flex items-center gap-2 rounded border px-4 py-2 text-xs uppercase tracking-widest"
          style={{ borderColor: "#1e2433", color: "#c8ccd4" }}
        >
          Enter Experiments
        </Link>
      </div>
    </div>
  );
}
