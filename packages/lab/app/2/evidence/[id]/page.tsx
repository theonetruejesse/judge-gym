import Link from "next/link";
import {
  NORMALIZATION_LEVELS,
  VIEW_LABELS,
  getEvidenceById,
  getEvidenceContentById,
} from "@/lib/mock-data";

export default function RouteTwoEvidencePage({
  params,
}: {
  params: { id: string };
}) {
  const evidence = getEvidenceById(params.id);
  const content = evidence ? getEvidenceContentById(evidence.id) : undefined;

  if (!evidence || !content) {
    return (
      <div className="min-h-screen px-6 py-12">
        <p>Evidence not found.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#f7f3ed", color: "#2a2620" }}
    >
      <header className="border-b border-[#e2d7c6] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#6f675b]">
              Evidence Detail
            </p>
            <h1
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-2-heading)" }}
            >
              {evidence.title}
            </h1>
            <p className="mt-2 text-sm text-[#6f675b]">{evidence.sourceUrl}</p>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-[#6f675b]">
            <Link href={`/2/experiment/${evidence.experimentId}`}>Back</Link>
            <Link href="/2/experiments">Experiments</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded border border-[#e2d7c6] bg-[#fffaf3] p-6">
            <h2
              className="text-lg"
              style={{ fontFamily: "var(--font-2-heading)" }}
            >
              Raw Article
            </h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#4b3c2f]">
              {content.raw}
            </div>
          </section>

          <section className="space-y-4">
            {NORMALIZATION_LEVELS.map((level) => (
              <div
                key={level.key}
                className="rounded border border-[#e2d7c6] bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-widest text-[#6f675b]">
                    {VIEW_LABELS[level.key]}
                  </h3>
                  {level.key === evidence.view && (
                    <span className="rounded-full bg-[#4b3c2f] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#fffaf3]">
                      Selected
                    </span>
                  )}
                </div>
                <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#4b3c2f]">
                  {level.key === "l0_raw" && content.raw}
                  {level.key === "l1_cleaned" && content.l1_cleaned}
                  {level.key === "l2_neutralized" && content.l2_neutralized}
                  {level.key === "l3_abstracted" && content.l3_abstracted}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
