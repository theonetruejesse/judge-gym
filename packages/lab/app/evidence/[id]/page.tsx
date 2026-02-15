"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import { NORMALIZATION_LEVELS, VIEW_LABELS } from "@/lib/ui";

const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

type EvidenceWindowItem = {
  window_id: string;
  start_date: string;
  end_date: string;
  country: string;
  concept: string;
  model_id: string;
  evidence_count: number;
};

type EvidenceBatch = {
  evidence_batch_id: string;
  evidence_limit: number;
  evidence_count: number;
  created_at: number;
};

type EvidenceItem = {
  evidence_id: string;
  position: number;
  title: string;
  url: string;
};

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

export default function EvidenceWindowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null,
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>("");

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

  const windows = useQuery(
    api.lab.listEvidenceWindows,
    hasConvex ? {} : "skip",
  ) as EvidenceWindowItem[] | undefined;

  const batches = useQuery(
    api.lab.listEvidenceBatches,
    resolvedParams && hasConvex ? { window_id: resolvedParams.id } : "skip",
  ) as EvidenceBatch[] | undefined;

  const batchItems = useQuery(
    api.lab.listEvidenceBatchItems,
    selectedBatchId && hasConvex ? { evidence_batch_id: selectedBatchId } : "skip",
  ) as EvidenceItem[] | undefined;

  const evidenceContent = useQuery(
    api.lab.getEvidenceContent,
    selectedEvidenceId && hasConvex
      ? { evidence_id: selectedEvidenceId }
      : "skip",
  ) as EvidenceContent | null | undefined;

  const windowsLoading = hasConvex && windows === undefined;
  const batchesLoading = hasConvex && !!resolvedParams && batches === undefined;
  const windowRows = windows ?? [];
  const matchedWindow = windowRows.find(
    (window) => window.window_id === resolvedParams?.id,
  );
  const selectedWindow = matchedWindow;

  const batchRows = batches ?? [];

  useEffect(() => {
    if (!selectedBatchId && batchRows.length > 0) {
      setSelectedBatchId(batchRows[0].evidence_batch_id);
    }
  }, [batchRows, selectedBatchId]);

  const evidenceRows = batchItems ?? [];

  useEffect(() => {
    if (!selectedEvidenceId && evidenceRows.length > 0) {
      setSelectedEvidenceId(evidenceRows[0].evidence_id);
    }
  }, [evidenceRows, selectedEvidenceId]);

  const activeEvidence = evidenceContent ?? null;

  if (!resolvedParams) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Loading evidence window...</p>
      </div>
    );
  }

  if (!selectedWindow && !windowsLoading) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Evidence window not found.</p>
        <Link href="/" className="mt-4 inline-block text-xs">
          Back to judge-gym
        </Link>
      </div>
    );
  }

  if (windowsLoading) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Loading evidence window...</p>
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
            Evidence Window
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            {selectedWindow?.concept ?? "Evidence Window"}
          </h1>
          <p className="text-[11px] opacity-50">
            {selectedWindow?.country ?? "—"} · {selectedWindow?.start_date ?? "—"}{" "}
            → {selectedWindow?.end_date ?? "—"} ·{" "}
            {selectedWindow?.model_id ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href="/" className="hover:text-[#ff6b35]">
            judge-gym
          </Link>
        </div>
      </header>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-4">
          <div
            className="rounded border p-4"
            style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Batch
              </p>
              <span className="text-xs opacity-60">
                {selectedWindow?.evidence_count ?? 0} total
              </span>
            </div>
            {batchesLoading && (
              <div className="mt-3 text-xs opacity-60">
                Loading batches...
              </div>
            )}
            {!batchesLoading && batchRows.length === 0 && (
              <div className="mt-3 text-xs opacity-60">No batches yet.</div>
            )}
            {batchRows.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <select
                  value={selectedBatchId}
                  onChange={(event) => setSelectedBatchId(event.target.value)}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ borderColor: "#1e2433", backgroundColor: "#0f1219" }}
                >
                  {batchRows.map((batch) => (
                    <option key={batch.evidence_batch_id} value={batch.evidence_batch_id}>
                      {batch.evidence_batch_id} · {batch.evidence_count} items
                    </option>
                  ))}
                </select>
                <span className="text-xs opacity-50">
                  Limit {batchRows.find((batch) => batch.evidence_batch_id === selectedBatchId)?.evidence_limit ?? "—"}
                </span>
              </div>
            )}
          </div>

          <div
            className="overflow-hidden rounded border"
            style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
          >
            <div
              className="grid grid-cols-[0.2fr_1.6fr] border-b px-4 py-2 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "#1e2433", color: "#5a6173" }}
            >
              <span>#</span>
              <span>Evidence Items</span>
            </div>
            {evidenceRows.length === 0 && (
              <div className="px-4 py-6 text-xs opacity-50">
                No evidence items found.
              </div>
            )}
            {evidenceRows.map((item) => {
              const selected = item.evidence_id === selectedEvidenceId;
              return (
                <button
                  key={item.evidence_id}
                  onClick={() => setSelectedEvidenceId(item.evidence_id)}
                  className="grid w-full grid-cols-[0.2fr_1.6fr] border-b px-4 py-3 text-left text-xs transition"
                  style={{
                    borderColor: "#1e2433",
                    backgroundColor: selected ? "#151a24" : "transparent",
                  }}
                >
                  <span className="opacity-50">{item.position}</span>
                  <div>
                    <div
                      className="font-medium"
                      style={{ color: selected ? "#ff6b35" : "#e8eaed" }}
                    >
                      {item.title}
                    </div>
                    <div className="text-[10px] opacity-50">{item.url}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          {!selectedEvidenceId && (
            <div
              className="rounded border px-6 py-10 text-center text-xs opacity-50"
              style={{ borderColor: "#1e2433" }}
            >
              Select an evidence item to preview.
            </div>
          )}
          {selectedEvidenceId && !activeEvidence && (
            <div
              className="rounded border px-6 py-10 text-center text-xs opacity-50"
              style={{ borderColor: "#1e2433" }}
            >
              Loading evidence content...
            </div>
          )}
          {selectedEvidenceId && activeEvidence && (
            <>
              <div
                className="rounded border p-5"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
              >
                <p
                  className="text-[10px] uppercase tracking-widest opacity-50"
                  style={{ fontFamily: "var(--font-1-serif)" }}
                >
                  Raw Article
                </p>
                <h2 className="mt-2 text-sm font-semibold text-[#e8eaed]">
                  {activeEvidence.title}
                </h2>
                <p className="text-[11px] opacity-50">{activeEvidence.url}</p>
                <div className="mt-4 whitespace-pre-line text-sm leading-relaxed">
                  {activeEvidence.raw_content}
                </div>
              </div>

              {NORMALIZATION_LEVELS.map((level) => {
                const contentMap: Record<string, string | undefined> = {
                  l0_raw: activeEvidence.raw_content,
                  l1_cleaned: activeEvidence.cleaned_content,
                  l2_neutralized: activeEvidence.neutralized_content,
                  l3_abstracted: activeEvidence.abstracted_content,
                };
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
            </>
          )}
        </section>
      </div>
    </div>
  );
}
