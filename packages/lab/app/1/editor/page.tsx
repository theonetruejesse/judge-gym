import Link from "next/link";

export default function RouteOneEditorPage() {
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
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Experiment Editor
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            Create or Edit Experiment
          </h1>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href="/1/experiments">Back</Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <form
          className="grid gap-6 rounded border p-6"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              Tag
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                placeholder="ecc-gpt41-neutralized-5pt"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Concept
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                placeholder="climate_change"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Task Type
              <select
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
              >
                <option>ECC</option>
                <option>Control</option>
                <option>Benchmark</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs">
              Scale Size
              <select
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
              >
                <option>3</option>
                <option>4</option>
                <option>5</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              Rubric Model
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                placeholder="gpt-4.1"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Scoring Model
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                placeholder="claude-sonnet-4.5"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-xs">
              Window Concept
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                placeholder="climate_change"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Window Country
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                placeholder="US"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Window Period
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                placeholder="2025-01-01 -> 2025-06-30"
              />
            </label>
          </div>

          <label className="grid gap-2 text-xs">
            Notes
            <textarea
              className="min-h-[120px] rounded border px-3 py-2 text-sm"
              style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
              placeholder="Add internal notes about sampling, prompts, or evidence windows."
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded px-4 py-2 text-[10px] uppercase tracking-wider"
              style={{ backgroundColor: "#ff6b35", color: "#0b0e14" }}
            >
              Save Experiment
            </button>
            <Link
              href="/1/experiments"
              className="rounded border px-4 py-2 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "#1e2433", color: "#5a6173" }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
