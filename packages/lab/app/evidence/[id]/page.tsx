import Link from "next/link";
import {
  NORMALIZATION_LEVELS,
  VIEW_LABELS,
  getEvidenceById,
  getEvidenceContentById,
} from "@/lib/mock-data";

export default function RouteOneEvidenceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const evidence = getEvidenceById(params.id);
  const content = evidence ? getEvidenceContentById(evidence.id) : undefined;

  if (!evidence || !content) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Evidence not found.</p>
        <Link href="/" className="mt-4 inline-block text-xs">
          Back to Experiments
        </Link>
      </div>
    );
  }

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
            Evidence Detail
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            {evidence.title}
          </h1>
          <p className="text-[11px] opacity-50">{evidence.sourceUrl}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href={`/experiment/${evidence.experimentId}`}>Back</Link>
          <Link href="/">Experiments</Link>
        </div>
      </header>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.2fr_1fr]">
        <section
          className="rounded border p-5"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
        >
          <p
            className="text-[10px] uppercase tracking-widest opacity-50"
            style={{ fontFamily: "var(--font-1-serif)" }}
          >
            Raw Article
          </p>
          <div className="mt-4 whitespace-pre-line text-sm leading-relaxed">
            {content.raw}
          </div>
        </section>

        <section className="space-y-4">
          {NORMALIZATION_LEVELS.map((level) => {
            const contentMap = {
              l0_raw: content.raw,
              l1_cleaned: content.l1_cleaned,
              l2_neutralized: content.l2_neutralized,
              l3_abstracted: content.l3_abstracted,
            };
            const value = contentMap[level.key];
            const active = level.key === evidence.view;
            return (
              <div
                key={level.key}
                className="rounded border p-4"
                style={{
                  borderColor: "#1e2433",
                  backgroundColor: active ? "#151a24" : "#0b0e1499",
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider opacity-60">
                    {VIEW_LABELS[level.key]}
                  </p>
                  {active && (
                    <span
                      className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider"
                      style={{ backgroundColor: "#ff6b3530", color: "#ff6b35" }}
                    >
                      Selected
                    </span>
                  )}
                </div>
                <div className="mt-3 whitespace-pre-line text-sm leading-relaxed">
                  {value}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
