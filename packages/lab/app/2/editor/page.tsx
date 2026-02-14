import Link from "next/link";

export default function RouteTwoEditorPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#f7f3ed", color: "#2a2620" }}
    >
      <header className="border-b border-[#e2d7c6] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#6f675b]">
              Experiment Editor
            </p>
            <h1
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-2-heading)" }}
            >
              Draft a New Experiment
            </h1>
          </div>
          <Link
            href="/2/experiments"
            className="text-xs uppercase tracking-widest text-[#6f675b]"
          >
            Back to Experiments
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <form className="grid gap-6 rounded border border-[#e2d7c6] bg-[#fffaf3] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Tag
              <input
                className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm"
                placeholder="ecc-gpt41-neutralized-5pt"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Concept
              <input
                className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm"
                placeholder="climate_change"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Task Type
              <select className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm">
                <option>ECC</option>
                <option>Control</option>
                <option>Benchmark</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Scale Size
              <select className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm">
                <option>3</option>
                <option>4</option>
                <option>5</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Rubric Model
              <input
                className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm"
                placeholder="gpt-4.1"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Scoring Model
              <input
                className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm"
                placeholder="claude-sonnet-4.5"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Window Concept
              <input
                className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm"
                placeholder="climate_change"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Window Country
              <input
                className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm"
                placeholder="US"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#6f675b]">
              Window Period
              <input
                className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm"
                placeholder="2025-01-01 -> 2025-06-30"
              />
            </label>
          </div>

          <label className="grid gap-2 text-xs text-[#6f675b]">
            Notes
            <textarea
              className="min-h-[120px] rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm"
              placeholder="Add experiment notes and constraints."
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded bg-[#4b3c2f] px-4 py-2 text-[10px] uppercase tracking-widest text-[#fffaf3]"
            >
              Save Experiment
            </button>
            <Link
              href="/2/experiments"
              className="rounded border border-[#d8cfbf] px-4 py-2 text-[10px] uppercase tracking-widest text-[#6f675b]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
