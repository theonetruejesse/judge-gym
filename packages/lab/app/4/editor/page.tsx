import Link from "next/link";

export default function RouteFourEditorPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#f3efe8", color: "#2a2320" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-[#7a6f66]">
            Experiment Editor
          </p>
          <h1
            className="mt-3 text-3xl"
            style={{ fontFamily: "var(--font-4-heading)" }}
          >
            Compose a New Dossier
          </h1>
          <p className="mt-2 text-sm text-[#7a6f66]">
            Configure the mission control experiment details below.
          </p>
        </header>

        <form className="mt-8 grid gap-6 rounded border border-[#d6c9bd] bg-[#fbf6ef] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Tag
              <input
                className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm"
                placeholder="ecc-gpt41-neutralized-5pt"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Concept
              <input
                className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm"
                placeholder="climate_change"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Task Type
              <select className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm">
                <option>ECC</option>
                <option>Control</option>
                <option>Benchmark</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Scale Size
              <select className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm">
                <option>3</option>
                <option>4</option>
                <option>5</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Rubric Model
              <input
                className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm"
                placeholder="gpt-4.1"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Scoring Model
              <input
                className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm"
                placeholder="claude-sonnet-4.5"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Window Concept
              <input
                className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm"
                placeholder="climate_change"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Window Country
              <input
                className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm"
                placeholder="US"
              />
            </label>
            <label className="grid gap-2 text-xs text-[#7a6f66]">
              Window Period
              <input
                className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm"
                placeholder="2025-01-01 -> 2025-06-30"
              />
            </label>
          </div>

          <label className="grid gap-2 text-xs text-[#7a6f66]">
            Notes
            <textarea
              className="min-h-[120px] rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm"
              placeholder="Add notes, prompts, or evidence sourcing details."
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded bg-[#3b2f28] px-4 py-2 text-[10px] uppercase tracking-widest text-[#fbf6ef]"
            >
              Save Experiment
            </button>
            <Link
              href="/4/experiments"
              className="rounded border border-[#d6c9bd] px-4 py-2 text-[10px] uppercase tracking-widest text-[#7a6f66]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
