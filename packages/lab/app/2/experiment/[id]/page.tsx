import Link from "next/link";
import {
  EXPERIMENTS,
  NORMALIZATION_LEVELS,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
  getEvidenceForExperiment,
} from "@/lib/mock-data";

export default function RouteTwoExperimentPage({
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
      style={{ backgroundColor: "#f7f3ed", color: "#2a2620" }}
    >
      <header className="border-b border-[#e2d7c6] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#6f675b]">
              Experiment Ledger
            </p>
            <h1
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-2-heading)" }}
            >
              {experiment.tag}
            </h1>
            <p className="mt-2 text-sm text-[#6f675b]">
              {experiment.id}  -  {TASK_TYPE_LABELS[experiment.taskType]}  -  created{" "}
              {new Date(experiment.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest"
              style={{
                backgroundColor: `${STATUS_COLORS[experiment.status]}22`,
                color: STATUS_COLORS[experiment.status],
              }}
            >
              {experiment.status}
            </span>
            <button className="rounded border border-[#d8cfbf] px-3 py-1 text-[10px] uppercase tracking-widest">
              Start
            </button>
            <button className="rounded border border-[#d8cfbf] px-3 py-1 text-[10px] uppercase tracking-widest">
              Stop
            </button>
            <button className="rounded border border-[#d8cfbf] px-3 py-1 text-[10px] uppercase tracking-widest">
              Add Samples
            </button>
            <button className="rounded border border-[#d8cfbf] px-3 py-1 text-[10px] uppercase tracking-widest">
              Clone
            </button>
            <Link
              href="/2/editor"
              className="rounded border border-[#d8cfbf] px-3 py-1 text-[10px] uppercase tracking-widest"
            >
              Edit
            </Link>
            <Link
              href="/2/experiments"
              className="rounded border border-[#d8cfbf] px-3 py-1 text-[10px] uppercase tracking-widest text-[#6f675b]"
            >
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <section className="rounded border border-[#e2d7c6] bg-[#fffaf3] p-6">
          <h2
            className="text-lg"
            style={{ fontFamily: "var(--font-2-heading)" }}
          >
            Evidence Window
          </h2>
          <p className="mt-2 text-sm text-[#6f675b]">
            {experiment.window.concept}  -  {experiment.window.country}  - {" "}
            {experiment.window.startDate}
            {" -> "}
            {experiment.window.endDate}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select className="rounded border border-[#d8cfbf] bg-white px-3 py-2 text-sm">
              <option>primary-window</option>
              <option>alternate-window</option>
            </select>
            <button className="rounded border border-[#d8cfbf] px-3 py-2 text-xs uppercase tracking-widest">
              Create New Window
            </button>
          </div>
        </section>

        <section className="mt-6 rounded border border-[#e2d7c6] bg-[#fffaf3] p-6">
          <h2
            className="text-lg"
            style={{ fontFamily: "var(--font-2-heading)" }}
          >
            Configuration
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-[#6f675b] md:grid-cols-2">
            <div>Rubric Model: {experiment.rubricModel}</div>
            <div>Scoring Model: {experiment.scoringModel}</div>
            <div>Scale Size: {experiment.scaleSize}-point</div>
            <div>Evidence View: {VIEW_LABELS[experiment.evidenceView]}</div>
            <div>Scoring Method: {experiment.scoringMethod}</div>
            <div>Prompt Ordering: {experiment.promptOrdering}</div>
            <div>Abstain Enabled: {experiment.abstainEnabled ? "Yes" : "No"}</div>
            <div>
              Randomizations:{" "}
              {experiment.randomizations.length
                ? experiment.randomizations.join(", ")
                : "None"}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded border border-[#e2d7c6] bg-[#fffaf3] p-6">
          <h2
            className="text-lg"
            style={{ fontFamily: "var(--font-2-heading)" }}
          >
            Runs
          </h2>
          {experiment.runs.length === 0 ? (
            <p className="mt-3 text-sm text-[#6f675b]">No runs yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {experiment.runs.map((run) => (
                <div key={run.id} className="border-t border-[#eadfce] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{run.id}</p>
                      <p className="text-xs text-[#6f675b]">
                        {run.completedSamples}/{run.totalSamples} samples
                      </p>
                    </div>
                    <span className="text-xs text-[#6f675b]">
                      {run.progress}% complete
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[#6f675b] md:grid-cols-3">
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

        <section className="mt-6 rounded border border-[#e2d7c6] bg-[#fffaf3] p-6">
          <h2
            className="text-lg"
            style={{ fontFamily: "var(--font-2-heading)" }}
          >
            Evidence
          </h2>
          <div className="mt-4 space-y-4">
            {evidence.map((ev) => (
              <Link
                key={ev.id}
                href={`/2/evidence/${ev.id}`}
                className="block rounded border border-[#eadfce] bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{ev.title}</p>
                  <p className="mt-1 text-xs text-[#6f675b]">{ev.sourceUrl}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {NORMALIZATION_LEVELS.map((level) => (
                    <span
                      key={level.key}
                      className="rounded-full border border-[#d8cfbf] px-2 py-1 text-[10px] uppercase tracking-widest"
                      style={{
                        backgroundColor:
                          level.key === ev.view ? "#4b3c2f" : "transparent",
                        color: level.key === ev.view ? "#fffaf3" : "#6f675b",
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
  );
}
