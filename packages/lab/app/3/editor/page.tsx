import Link from "next/link";

export default function RouteThreeEditorPage() {
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
            Editor
          </h1>
          <nav className="mt-6 grid gap-3 text-xs uppercase tracking-widest text-[#6c7b99]">
            <Link href="/3/experiments">Experiments</Link>
            <Link href="/">All Layouts</Link>
          </nav>
        </aside>

        <main className="px-8 py-6">
          <header>
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
              Experiment Draft
            </p>
            <h2
              className="mt-2 text-2xl"
              style={{ fontFamily: "var(--font-3-heading)" }}
            >
              Configure Mission Control
            </h2>
          </header>

          <form className="mt-6 grid gap-6 rounded border border-[#22304a] bg-[#0f1522] p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Tag
                <input
                  className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]"
                  placeholder="ecc-gpt41-neutralized-5pt"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Concept
                <input
                  className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]"
                  placeholder="climate_change"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Task Type
                <select className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]">
                  <option>ECC</option>
                  <option>Control</option>
                  <option>Benchmark</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Scale Size
                <select className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]">
                  <option>3</option>
                  <option>4</option>
                  <option>5</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Rubric Model
                <input
                  className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]"
                  placeholder="gpt-4.1"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Scoring Model
                <input
                  className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]"
                  placeholder="claude-sonnet-4.5"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Window Concept
                <input
                  className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]"
                  placeholder="climate_change"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Window Country
                <input
                  className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]"
                  placeholder="US"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#6c7b99]">
                Window Period
                <input
                  className="rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]"
                  placeholder="2025-01-01 -> 2025-06-30"
                />
              </label>
            </div>

            <label className="grid gap-2 text-xs text-[#6c7b99]">
              Notes
              <textarea
                className="min-h-[120px] rounded border border-[#22304a] bg-[#0b0f1a] px-3 py-2 text-sm text-[#d2e1ff]"
                placeholder="Add run notes, evidence sources, or prompt ordering."
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded border border-[#6df0ff] px-4 py-2 text-[10px] uppercase tracking-widest text-[#6df0ff]"
              >
                Save Experiment
              </button>
              <Link
                href="/3/experiments"
                className="rounded border border-[#22304a] px-4 py-2 text-[10px] uppercase tracking-widest text-[#6c7b99]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
