import Link from "next/link";
import {
  EXPERIMENTS,
  NORMALIZATION_LEVELS,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  getEvidenceForExperiment,
} from "@/lib/mock-data";

export default function RouteFiveExperimentPage({
  params,
}: {
  params: { id: string };
}) {
  const experiment =
    EXPERIMENTS.find((item) => item.id === params.id) ?? EXPERIMENTS[0];
  const evidence = getEvidenceForExperiment(experiment.id);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#111111", color: "#f4f1e8" }}
    >
      <header className="border-b border-[#2b2b2b] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-[#8b857b]">
              Control Board
            </p>
            <h1
              className="mt-2 text-4xl"
              style={{ fontFamily: "var(--font-5-heading)", color: "#f4b942" }}
            >
              {experiment.tag}
            </h1>
            <p className="mt-2 text-xs text-[#8b857b]">
              {experiment.id}  -  {TASK_TYPE_LABELS[experiment.taskType]}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest">
            <Link href="/5/experiments" className="text-[#f4b942]">
              Experiments
            </Link>
            <Link href="/5/editor" className="text-[#8b857b]">
              Edit
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-4 px-6 py-6 lg:grid-cols-[240px_1fr_360px]">
        <aside className="space-y-4">
          <div className="rounded border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs uppercase tracking-[0.4em] text-[#8b857b]">
              Actions
            </div>
            <div className="mt-4 grid gap-2">
              <button className="rounded border border-[#2b2b2b] px-3 py-2 text-xs uppercase tracking-widest text-[#f4b942]">
                Start
              </button>
              <button className="rounded border border-[#2b2b2b] px-3 py-2 text-xs uppercase tracking-widest text-[#8b857b]">
                Stop
              </button>
              <button className="rounded border border-[#2b2b2b] px-3 py-2 text-xs uppercase tracking-widest text-[#8b857b]">
                Add Samples
              </button>
              <button className="rounded border border-[#2b2b2b] px-3 py-2 text-xs uppercase tracking-widest text-[#8b857b]">
                Clone
              </button>
            </div>
          </div>

          <div className="rounded border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs uppercase tracking-[0.4em] text-[#8b857b]">
              Evidence Window
            </div>
            <p className="mt-3 text-xs text-[#b7b1a6]">
              {experiment.window.concept}  -  {experiment.window.country}
            </p>
            <p className="mt-1 text-xs text-[#8b857b]">
              {experiment.window.startDate}
              {" -> "}
              {experiment.window.endDate}
            </p>
            <select className="mt-3 w-full rounded border border-[#2b2b2b] bg-[#101010] px-2 py-1 text-xs text-[#f4f1e8]">
              <option>primary-window</option>
              <option>alternate-window</option>
            </select>
            <button className="mt-3 w-full rounded border border-[#2b2b2b] px-2 py-1 text-[10px] uppercase tracking-widest text-[#8b857b]">
              Create New Window
            </button>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="rounded border border-[#2b2b2b] bg-[#171717] p-5">
            <div className="flex items-center justify-between">
              <h2
                className="text-3xl"
                style={{ fontFamily: "var(--font-5-heading)" }}
              >
                Config Snapshot
              </h2>
              <span
                className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest"
                style={{
                  backgroundColor: `${STATUS_COLORS[experiment.status]}22`,
                  color: STATUS_COLORS[experiment.status],
                }}
              >
                {experiment.status}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-[#b7b1a6] md:grid-cols-2">
              <div>Rubric: {experiment.rubricModel}</div>
              <div>Scoring: {experiment.scoringModel}</div>
              <div>Scale: {experiment.scaleSize}-pt</div>
              <div>Evidence View: {VIEW_LABELS[experiment.evidenceView]}</div>
              <div>Scoring Method: {experiment.scoringMethod}</div>
              <div>Prompt Ordering: {experiment.promptOrdering}</div>
            </div>
          </div>

          <div className="rounded border border-[#2b2b2b] bg-[#171717] p-5">
            <h3
              className="text-2xl"
              style={{ fontFamily: "var(--font-5-heading)" }}
            >
              Runs
            </h3>
            {experiment.runs.length === 0 ? (
              <p className="mt-3 text-xs text-[#8b857b]">No runs yet.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {experiment.runs.map((run) => (
                  <div
                    key={run.id}
                    className="rounded border border-[#2b2b2b] bg-[#101010] p-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#f4b942]">{run.id}</span>
                      <span className="text-[#8b857b]">{run.progress}%</span>
                    </div>
                    <div className="mt-2 text-[10px] text-[#8b857b]">
                      {run.completedSamples}/{run.totalSamples} samples
                    </div>
                    <div className="mt-2 text-[10px] text-[#b7b1a6]">
                      Stages: {run.stages.length}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <section className="rounded border border-[#2b2b2b] bg-[#171717] p-5">
          <div className="flex items-center justify-between">
            <h2
              className="text-3xl"
              style={{ fontFamily: "var(--font-5-heading)" }}
            >
              Evidence
            </h2>
            <span className="text-xs text-[#8b857b]">{evidence.length} items</span>
          </div>
          <div className="mt-4 space-y-3">
            {evidence.map((ev) => (
              <Link
                key={ev.id}
                href={`/5/evidence/${ev.id}`}
                className="block rounded border border-[#2b2b2b] bg-[#101010] px-4 py-3"
              >
                <div className="text-sm" style={{ color: "#f4f1e8" }}>
                  {ev.title}
                </div>
                <div className="mt-1 text-xs text-[#8b857b]">{ev.sourceUrl}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {NORMALIZATION_LEVELS.map((level) => (
                    <span
                      key={level.key}
                      className="rounded border border-[#2b2b2b] px-2 py-1 text-[10px] uppercase tracking-widest"
                      style={{
                        backgroundColor:
                          level.key === ev.view ? "#f4b942" : "transparent",
                        color: level.key === ev.view ? "#111111" : "#8b857b",
                      }}
                    >
                      {VIEW_LABELS[level.key]}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
