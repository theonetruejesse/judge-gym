import Link from "next/link";
import {
  EXPERIMENTS,
  NORMALIZATION_LEVELS,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  getEvidenceForExperiment,
} from "@/lib/mock-data";

export default function RouteFourExperimentPage({
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
      style={{ backgroundColor: "#f3efe8", color: "#2a2320" }}
    >
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <aside className="border-r border-[#d6c9bd] px-5 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#7a6f66]">
            Dossier Index
          </p>
          <h1
            className="mt-3 text-xl"
            style={{ fontFamily: "var(--font-4-heading)" }}
          >
            {experiment.tag}
          </h1>
          <nav className="mt-6 grid gap-3 text-xs uppercase tracking-widest text-[#7a6f66]">
            <span>Overview</span>
            <span>Actions</span>
            <span>Runs</span>
            <span>Evidence</span>
            <Link href="/4/experiments" className="mt-4 text-[#3b2f28]">
              Back to Archive
            </Link>
            <Link href="/4/editor">Edit Experiment</Link>
          </nav>
        </aside>

        <main className="px-8 py-8">
          <header>
            <p className="text-xs uppercase tracking-[0.3em] text-[#7a6f66]">
              Experiment Dossier
            </p>
            <h2
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-4-heading)" }}
            >
              {experiment.tag}
            </h2>
            <p className="mt-2 text-sm text-[#7a6f66]">
              {experiment.id}  -  {TASK_TYPE_LABELS[experiment.taskType]}  -  created{" "}
              {new Date(experiment.createdAt).toLocaleDateString()}
            </p>
          </header>

          <section className="mt-8 rounded border border-[#d6c9bd] bg-[#fbf6ef] p-6">
            <h3
              className="text-xl"
              style={{ fontFamily: "var(--font-4-heading)" }}
            >
              Overview
            </h3>
            <div className="mt-4 grid gap-2 text-sm text-[#7a6f66] md:grid-cols-2">
              <div>Rubric Model: {experiment.rubricModel}</div>
              <div>Scoring Model: {experiment.scoringModel}</div>
              <div>Scale Size: {experiment.scaleSize}-pt</div>
              <div>Evidence View: {VIEW_LABELS[experiment.evidenceView]}</div>
              <div>Scoring Method: {experiment.scoringMethod}</div>
              <div>Prompt Ordering: {experiment.promptOrdering}</div>
            </div>
            <div className="mt-4 text-xs text-[#7a6f66]">
              Randomizations:{" "}
              {experiment.randomizations.length
                ? experiment.randomizations.join(", ")
                : "None"}
            </div>
          </section>

          <section className="mt-6 rounded border border-[#d6c9bd] bg-[#fbf6ef] p-6">
            <h3
              className="text-xl"
              style={{ fontFamily: "var(--font-4-heading)" }}
            >
              Actions + Window
            </h3>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="rounded border border-[#d6c9bd] px-3 py-2 text-xs uppercase tracking-widest">
                Start
              </button>
              <button className="rounded border border-[#d6c9bd] px-3 py-2 text-xs uppercase tracking-widest">
                Stop
              </button>
              <button className="rounded border border-[#d6c9bd] px-3 py-2 text-xs uppercase tracking-widest">
                Add Samples
              </button>
              <button className="rounded border border-[#d6c9bd] px-3 py-2 text-xs uppercase tracking-widest">
                Clone
              </button>
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
            <div className="mt-4 text-sm text-[#7a6f66]">
              Window: {experiment.window.concept}  -  {experiment.window.country}  - {" "}
              {experiment.window.startDate}
              {" -> "}
              {experiment.window.endDate}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <select className="rounded border border-[#d6c9bd] bg-white px-3 py-2 text-sm">
                <option>primary-window</option>
                <option>alternate-window</option>
              </select>
              <button className="rounded border border-[#d6c9bd] px-3 py-2 text-xs uppercase tracking-widest">
                Create New Window
              </button>
            </div>
          </section>

          <section className="mt-6 rounded border border-[#d6c9bd] bg-[#fbf6ef] p-6">
            <h3
              className="text-xl"
              style={{ fontFamily: "var(--font-4-heading)" }}
            >
              Runs
            </h3>
            {experiment.runs.length === 0 ? (
              <p className="mt-3 text-sm text-[#7a6f66]">No runs recorded.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {experiment.runs.map((run) => (
                  <div key={run.id} className="border-t border-[#e5dbd1] pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{run.id}</p>
                        <p className="text-xs text-[#7a6f66]">
                          {run.completedSamples}/{run.totalSamples} samples
                        </p>
                      </div>
                      <span className="text-xs text-[#7a6f66]">
                        {run.progress}% complete
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[#7a6f66] md:grid-cols-3">
                      {run.stages.map((stage) => (
                        <div key={stage.name}>
                          {stage.name}: {stage.status} ({stage.progress}%)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 rounded border border-[#d6c9bd] bg-[#fbf6ef] p-6">
            <h3
              className="text-xl"
              style={{ fontFamily: "var(--font-4-heading)" }}
            >
              Evidence
            </h3>
            <div className="mt-4 space-y-4">
              {evidence.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/4/evidence/${ev.id}`}
                  className="block rounded border border-[#e5dbd1] bg-white px-4 py-3"
                >
                  <p className="text-sm font-medium">{ev.title}</p>
                  <p className="mt-1 text-xs text-[#7a6f66]">{ev.sourceUrl}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {NORMALIZATION_LEVELS.map((level) => (
                      <span
                        key={level.key}
                        className="rounded-full border border-[#d6c9bd] px-2 py-1 text-[10px] uppercase tracking-widest"
                        style={{
                          backgroundColor:
                            level.key === ev.view ? "#3b2f28" : "transparent",
                          color: level.key === ev.view ? "#fbf6ef" : "#7a6f66",
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
        </main>
      </div>
    </div>
  );
}
