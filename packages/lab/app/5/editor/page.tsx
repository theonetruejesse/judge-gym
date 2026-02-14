import Link from "next/link";

export default function RouteFiveEditorPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#111111", color: "#f4f1e8" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.5em] text-[#8b857b]">
            Experiment Editor
          </p>
          <h1
            className="mt-2 text-5xl"
            style={{ fontFamily: "var(--font-5-heading)", color: "#f4b942" }}
          >
            Build Control Board Entry
          </h1>
          <p className="mt-2 text-sm text-[#b7b1a6]">
            Draft a new Mission Control experiment configuration.
          </p>
        </header>

        <form className="mt-8 grid gap-6 rounded border border-[#2b2b2b] bg-[#171717] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Tag
              <input
                className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]"
                placeholder="ecc-gpt41-neutralized-5pt"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Concept
              <input
                className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]"
                placeholder="climate_change"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Task Type
              <select className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]">
                <option>ECC</option>
                <option>Control</option>
                <option>Benchmark</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Scale Size
              <select className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]">
                <option>3</option>
                <option>4</option>
                <option>5</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Rubric Model
              <input
                className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]"
                placeholder="gpt-4.1"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Scoring Model
              <input
                className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]"
                placeholder="claude-sonnet-4.5"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Window Concept
              <input
                className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]"
                placeholder="climate_change"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Window Country
              <input
                className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]"
                placeholder="US"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#8b857b]">
              Window Period
              <input
                className="rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]"
                placeholder="2025-01-01 -> 2025-06-30"
              />
            </label>
          </div>

          <label className="grid gap-2 text-xs text-[#8b857b]">
            Notes
            <textarea
              className="min-h-[120px] rounded border border-[#2b2b2b] bg-[#101010] px-3 py-2 text-sm text-[#f4f1e8]"
              placeholder="Add run notes and evidence sourcing details."
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded bg-[#f4b942] px-4 py-2 text-[10px] uppercase tracking-widest text-[#111111]"
            >
              Save Experiment
            </button>
            <Link
              href="/5/experiments"
              className="rounded border border-[#2b2b2b] px-4 py-2 text-[10px] uppercase tracking-widest text-[#8b857b]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
