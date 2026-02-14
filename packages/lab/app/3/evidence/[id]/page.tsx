import Link from "next/link";
import {
  NORMALIZATION_LEVELS,
  VIEW_LABELS,
  getEvidenceById,
  getEvidenceContentById,
} from "@/lib/mock-data";

export default function RouteThreeEvidencePage({
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
      style={{ backgroundColor: "#0a0c10", color: "#d2e1ff" }}
    >
      <div className="grid min-h-screen grid-cols-[220px_1fr_280px]">
        <aside className="border-r border-[#1c2436] px-5 py-6">
          <h1
            className="text-lg"
            style={{ fontFamily: "var(--font-3-heading)", color: "#6df0ff" }}
          >
            Evidence
          </h1>
          <nav className="mt-6 grid gap-3 text-xs uppercase tracking-widest text-[#6c7b99]">
            <Link href={`/3/experiment/${evidence.experimentId}`}>Back</Link>
            <Link href="/3/experiments">Experiments</Link>
          </nav>
        </aside>

        <main className="px-6 py-6">
          <div className="rounded border border-[#22304a] bg-[#0f1522] p-6">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
              Raw Article
            </p>
            <h2
              className="mt-2 text-xl"
              style={{ fontFamily: "var(--font-3-heading)" }}
            >
              {evidence.title}
            </h2>
            <p className="mt-1 text-xs text-[#6c7b99]">{evidence.sourceUrl}</p>
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#d2e1ff]">
              {content.raw}
            </div>
          </div>
        </main>

        <aside className="border-l border-[#1c2436] px-5 py-6">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[#3c4a66]">
            Normalization
          </div>
          <div className="mt-4 space-y-3">
            {NORMALIZATION_LEVELS.map((level) => (
              <div
                key={level.key}
                className="rounded border border-[#22304a] bg-[#0f1522] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-[#6c7b99]">
                    {VIEW_LABELS[level.key]}
                  </span>
                  {level.key === evidence.view && (
                    <span className="rounded border border-[#6df0ff] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#6df0ff]">
                      Selected
                    </span>
                  )}
                </div>
                <div className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#8aa0c7]">
                  {level.key === "l0_raw" && content.raw}
                  {level.key === "l1_cleaned" && content.l1_cleaned}
                  {level.key === "l2_neutralized" && content.l2_neutralized}
                  {level.key === "l3_abstracted" && content.l3_abstracted}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
