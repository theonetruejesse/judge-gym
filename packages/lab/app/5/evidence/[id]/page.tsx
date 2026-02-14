import Link from "next/link";
import {
  NORMALIZATION_LEVELS,
  VIEW_LABELS,
  getEvidenceById,
  getEvidenceContentById,
} from "@/lib/mock-data";

export default function RouteFiveEvidencePage({
  params,
}: {
  params: { id: string };
}) {
  const evidence = getEvidenceById(params.id);
  const content = evidence ? getEvidenceContentById(evidence.id) : undefined;

  if (!evidence || !content) {
    return (
      <div className="min-h-screen px-6 py-12">Evidence not found.</div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#111111", color: "#f4f1e8" }}
    >
      <header className="border-b border-[#2b2b2b] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-[#8b857b]">
              Evidence Detail
            </p>
            <h1
              className="mt-2 text-4xl"
              style={{ fontFamily: "var(--font-5-heading)", color: "#f4b942" }}
            >
              {evidence.title}
            </h1>
            <p className="mt-2 text-xs text-[#8b857b]">{evidence.sourceUrl}</p>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest">
            <Link href={`/5/experiment/${evidence.experimentId}`} className="text-[#f4b942]">
              Back
            </Link>
            <Link href="/5/experiments" className="text-[#8b857b]">
              Experiments
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <section className="rounded border border-[#2b2b2b] bg-[#171717] p-6">
          <h2
            className="text-3xl"
            style={{ fontFamily: "var(--font-5-heading)" }}
          >
            Raw Article
          </h2>
          <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#f4f1e8]">
            {content.raw}
          </div>
        </section>

        <div className="mt-6 grid gap-4">
          {NORMALIZATION_LEVELS.map((level) => (
            <section
              key={level.key}
              className="rounded border border-[#2b2b2b] bg-[#171717] p-5"
            >
              <div className="flex items-center justify-between">
                <h3
                  className="text-2xl"
                  style={{ fontFamily: "var(--font-5-heading)" }}
                >
                  {VIEW_LABELS[level.key]}
                </h3>
                {level.key === evidence.view && (
                  <span className="rounded border border-[#f4b942] px-2 py-1 text-[10px] uppercase tracking-widest text-[#f4b942]">
                    Selected
                  </span>
                )}
              </div>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#b7b1a6]">
                {level.key === "l0_raw" && content.raw}
                {level.key === "l1_cleaned" && content.l1_cleaned}
                {level.key === "l2_neutralized" && content.l2_neutralized}
                {level.key === "l3_abstracted" && content.l3_abstracted}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
