import Link from "next/link";
import {
  NORMALIZATION_LEVELS,
  VIEW_LABELS,
  getEvidenceById,
  getEvidenceContentById,
} from "@/lib/mock-data";

export default function RouteFourEvidencePage({
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
      style={{ backgroundColor: "#f3efe8", color: "#2a2320" }}
    >
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <aside className="border-r border-[#d6c9bd] px-5 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#7a6f66]">
            Evidence Dossier
          </p>
          <h1
            className="mt-3 text-xl"
            style={{ fontFamily: "var(--font-4-heading)" }}
          >
            {evidence.title}
          </h1>
          <nav className="mt-6 grid gap-3 text-xs uppercase tracking-widest text-[#7a6f66]">
            <Link href={`/4/experiment/${evidence.experimentId}`}>Back</Link>
            <Link href="/4/experiments">Experiments</Link>
          </nav>
        </aside>

        <main className="px-8 py-8">
          <header>
            <p className="text-xs uppercase tracking-[0.3em] text-[#7a6f66]">
              Evidence Detail
            </p>
            <h2
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-4-heading)" }}
            >
              {evidence.title}
            </h2>
            <p className="mt-2 text-sm text-[#7a6f66]">{evidence.sourceUrl}</p>
          </header>

          <section className="mt-8 rounded border border-[#d6c9bd] bg-[#fbf6ef] p-6">
            <h3
              className="text-xl"
              style={{ fontFamily: "var(--font-4-heading)" }}
            >
              Raw Article
            </h3>
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#3b2f28]">
              {content.raw}
            </div>
          </section>

          <section className="mt-6 space-y-3">
            {NORMALIZATION_LEVELS.map((level) => (
              <details
                key={level.key}
                open={level.key === evidence.view}
                className="rounded border border-[#d6c9bd] bg-[#fbf6ef] p-4"
              >
                <summary className="cursor-pointer text-xs uppercase tracking-widest text-[#7a6f66]">
                  {VIEW_LABELS[level.key]}
                </summary>
                <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#3b2f28]">
                  {level.key === "l0_raw" && content.raw}
                  {level.key === "l1_cleaned" && content.l1_cleaned}
                  {level.key === "l2_neutralized" && content.l2_neutralized}
                  {level.key === "l3_abstracted" && content.l3_abstracted}
                </div>
              </details>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
