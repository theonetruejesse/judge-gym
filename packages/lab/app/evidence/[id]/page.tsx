"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import { NORMALIZATION_LEVELS, VIEW_LABELS } from "@/lib/ui";

const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

type EvidenceContent = {
  evidence_id: string;
  window_id: string;
  title: string;
  url: string;
  raw_content: string;
  cleaned_content?: string;
  neutralized_content?: string;
  abstracted_content?: string;
};

export default function RouteOneEvidenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null,
  );

  useEffect(() => {
    const maybePromise = params as unknown as {
      then?: (onfulfilled: (value: { id: string }) => void) => void;
    };
    if (typeof maybePromise.then === "function") {
      maybePromise.then(setResolvedParams);
    } else {
      setResolvedParams(params as unknown as { id: string });
    }
  }, [params]);

  if (!hasConvex) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Missing `NEXT_PUBLIC_CONVEX_URL`.</p>
        <p className="mt-2 text-xs opacity-60">
          Set the Convex URL to load evidence content.
        </p>
      </div>
    );
  }

  const evidence = useQuery(
    api.lab.getEvidenceContent,
    resolvedParams ? { evidence_id: resolvedParams.id } : "skip",
  ) as EvidenceContent | null | undefined;

  if (!resolvedParams) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Loading evidence...</p>
      </div>
    );
  }

  if (evidence === null) {
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

  if (!evidence) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Loading evidence...</p>
      </div>
    );
  }

  const contentMap: Record<string, string | undefined> = {
    l0_raw: evidence.raw_content,
    l1_cleaned: evidence.cleaned_content,
    l2_neutralized: evidence.neutralized_content,
    l3_abstracted: evidence.abstracted_content,
  };

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
          <p className="text-[11px] opacity-50">{evidence.url}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href="/" className="hover:text-[#ff6b35]">
            Experiments
          </Link>
          <Link href="/editor" className="hover:text-[#ff6b35]">
            Editor
          </Link>
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
            {evidence.raw_content}
          </div>
        </section>

        <section className="space-y-4">
          {NORMALIZATION_LEVELS.map((level) => {
            const value = contentMap[level.key];
            return (
              <div
                key={level.key}
                className="rounded border p-4"
                style={{
                  borderColor: "#1e2433",
                  backgroundColor: "#0b0e1499",
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider opacity-60">
                    {VIEW_LABELS[level.key]}
                  </p>
                </div>
                <div className="mt-3 whitespace-pre-line text-sm leading-relaxed">
                  {value?.trim().length ? value : "—"}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
