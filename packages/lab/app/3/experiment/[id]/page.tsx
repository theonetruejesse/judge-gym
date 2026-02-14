import Link from "next/link";
import {
  EXPERIMENTS,
  NORMALIZATION_LEVELS,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  getEvidenceForExperiment,
} from "@/lib/mock-data";

export default function RouteThreeExperimentPage({
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
      style={{ backgroundColor: "#0a0c10", color: "#d2e1ff" }}
    >
      <div className="grid min-h-screen grid-cols-[220px_1fr_280px] grid-rows-[auto_1fr_auto]">
        <header className="col-span-3 flex items-center justify-between border-b border-[#1c2436] px-6 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
              Mission Control
            </p>
            <h1
              className="text-lg"
              style={{ fontFamily: "var(--font-3-heading)", color: "#6df0ff" }}
            >
              {experiment.tag}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-[#6c7b99]">
            <Link href="/3/experiments">Experiments</Link>
            <Link href="/3/editor">Edit</Link>
          </div>
        </header>

        <aside className="border-r border-[#1c2436] px-5 py-6">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
            Control Rail
          </div>
          <nav className="mt-4 grid gap-2 text-xs uppercase tracking-widest text-[#6c7b99]">
            <Link href="/3/experiments">Overview</Link>
            <Link href="/3/editor">New Experiment</Link>
            <Link href="/">All Layouts</Link>
          </nav>
          <div className="mt-6 rounded border border-[#22304a] bg-[#0f1522] p-3 text-xs">
            <div className="text-[#6df0ff]">Status</div>
            <div className="mt-2 text-[#8aa0c7]">{experiment.status}</div>
            <div className="mt-3 text-[#6df0ff]">Task</div>
            <div className="mt-2 text-[#8aa0c7]">
              {TASK_TYPE_LABELS[experiment.taskType]}
            </div>
          </div>
        </aside>

        <main className="px-6 py-6">
          <div className="rounded border border-[#22304a] bg-[#0f1522] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#6c7b99]">
                  Evidence Feed
                </p>
                <p className="text-sm text-[#8aa0c7]">
                  {evidence.length} items  -  window {experiment.window.country}
                </p>
              </div>
              <span
                className="rounded border px-3 py-1 text-[10px] uppercase tracking-widest"
                style={{ borderColor: STATUS_COLORS[experiment.status], color: STATUS_COLORS[experiment.status] }}
              >
                {experiment.status}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {evidence.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/3/evidence/${ev.id}`}
                  className="block rounded border border-[#22304a] bg-[#0b0f1a] px-4 py-3"
                >
                  <div className="text-sm" style={{ color: "#e5efff" }}>
                    {ev.title}
                  </div>
                  <div className="mt-1 text-[11px] text-[#6c7b99]">
                    {ev.sourceUrl}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {NORMALIZATION_LEVELS.map((level) => (
                      <span
                        key={level.key}
                        className="rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest"
                        style={{
                          borderColor:
                            level.key === ev.view ? "#6df0ff" : "#22304a",
                          color: level.key === ev.view ? "#6df0ff" : "#6c7b99",
                        }}
                      >
                        {VIEW_LABELS[level.key]}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <aside className="border-l border-[#1c2436] px-5 py-6">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
            Inspector
          </div>
          <div className="mt-4 grid gap-3">
            <button className="rounded border border-[#22304a] px-3 py-2 text-xs uppercase tracking-widest text-[#6df0ff]">
              Start
            </button>
            <button className="rounded border border-[#22304a] px-3 py-2 text-xs uppercase tracking-widest text-[#6c7b99]">
              Stop
            </button>
            <button className="rounded border border-[#22304a] px-3 py-2 text-xs uppercase tracking-widest text-[#6c7b99]">
              Add Samples
            </button>
            <button className="rounded border border-[#22304a] px-3 py-2 text-xs uppercase tracking-widest text-[#6c7b99]">
              Clone
            </button>
          </div>

          <div className="mt-6 rounded border border-[#22304a] bg-[#0f1522] p-4 text-xs text-[#8aa0c7]">
            <div className="text-[#6df0ff]">Evidence Window</div>
            <div className="mt-2">
              {experiment.window.concept}  -  {experiment.window.country}
            </div>
            <div className="mt-2">
              {experiment.window.startDate}
              {" -> "}
              {experiment.window.endDate}
            </div>
            <select className="mt-3 w-full rounded border border-[#22304a] bg-[#0b0f1a] px-2 py-1 text-xs">
              <option>primary-window</option>
              <option>alternate-window</option>
            </select>
            <button className="mt-3 w-full rounded border border-[#22304a] px-2 py-1 text-[10px] uppercase tracking-widest text-[#6c7b99]">
              Create New Window
            </button>
          </div>

          <div className="mt-6 rounded border border-[#22304a] bg-[#0f1522] p-4 text-xs text-[#8aa0c7]">
            <div className="text-[#6df0ff]">Config Snapshot</div>
            <div className="mt-2">Rubric: {experiment.rubricModel}</div>
            <div className="mt-1">Scoring: {experiment.scoringModel}</div>
            <div className="mt-1">Scale: {experiment.scaleSize}-pt</div>
            <div className="mt-1">Evidence View: {VIEW_LABELS[experiment.evidenceView]}</div>
          </div>
        </aside>

        <section className="col-span-2 border-t border-[#1c2436] px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
              Run Strip
            </p>
            <span className="text-xs text-[#6c7b99]">
              {experiment.runs.length} runs
            </span>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {experiment.runs.map((run) => (
              <div
                key={run.id}
                className="min-w-[220px] rounded border border-[#22304a] bg-[#0f1522] p-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6df0ff]">{run.id}</span>
                  <span className="text-[#6c7b99]">{run.progress}%</span>
                </div>
                <div className="mt-2 text-[10px] text-[#8aa0c7]">
                  {run.completedSamples}/{run.totalSamples} samples
                </div>
                <div className="mt-2 text-[10px] text-[#6c7b99]">
                  Stage count: {run.stages.length}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
