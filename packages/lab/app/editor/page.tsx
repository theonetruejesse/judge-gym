"use client";

import Link from "next/link";

export default function EditorLandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
    >
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
      >
        <div>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            judge-gym
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Editor
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href="/" className="hover:text-[#ff6b35]">
            Back to judge-gym
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:grid-cols-2">
        <section
          className="grid gap-4 rounded border p-6"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              Experiment
            </p>
            <p className="mt-1 text-xs opacity-60">
              Configure rubric + scoring settings and bind to an evidence window.
            </p>
          </div>
          <Link
            href="/editor/experiment"
            className="rounded px-4 py-2 text-center text-[10px] uppercase tracking-wider"
            style={{ backgroundColor: "#ff6b35", color: "#0b0e14" }}
          >
            New Experiment
          </Link>
        </section>

        <section
          className="grid gap-4 rounded border p-6"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              Evidence Window
            </p>
            <p className="mt-1 text-xs opacity-60">
              Define a scraping window and model for evidence collection.
            </p>
          </div>
          <Link
            href="/editor/window"
            className="rounded px-4 py-2 text-center text-[10px] uppercase tracking-wider"
            style={{ backgroundColor: "#ff6b35", color: "#0b0e14" }}
          >
            New Window
          </Link>
        </section>
      </div>
    </div>
  );
}
