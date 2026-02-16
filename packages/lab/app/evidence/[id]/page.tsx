"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import { NORMALIZATION_LEVELS, VIEW_LABELS } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LabNavbar from "@/components/lab_navbar";

const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

type EvidenceWindowItem = {
  window_id: string;
  start_date: string;
  end_date: string;
  country: string;
  concept: string;
  model_id: string;
  window_tag?: string;
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
      <div className="min-h-screen bg-background text-foreground">
        <LabNavbar />
        <div className="px-6 py-12">
          <p className="text-sm">Loading evidence window...</p>
        </div>
      </div>
    );
  }

  if (!selectedWindow && !windowsLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <LabNavbar />
        <div className="px-6 py-12">
          <p className="text-sm">Evidence window not found.</p>
        </div>
      </div>
    );
  }

  if (windowsLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <LabNavbar />
        <div className="px-6 py-12">
          <p className="text-sm">Loading evidence window...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="px-6 py-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Evidence Window
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            {selectedWindow?.window_tag ??
              selectedWindow?.concept ??
              "Evidence Window"}
          </h1>
          <p className="text-[11px] opacity-50">
            {selectedWindow?.country ?? "—"} · {selectedWindow?.start_date ?? "—"} -{" "}
            {selectedWindow?.end_date ?? "—"} · {selectedWindow?.model_id ?? "—"}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-4">
          <Card className="border-border bg-card/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Batch
              </p>
              <span className="text-xs opacity-60">
                {selectedWindow?.evidence_count ?? 0} total
              </span>
            </div>
            {batchesLoading && (
              <div className="mt-3 text-xs opacity-60">Loading batches...</div>
            )}
            {!batchesLoading && batchRows.length === 0 && (
              <div className="mt-3 text-xs opacity-60">No batches yet.</div>
            )}
            {batchRows.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                  <SelectTrigger className="h-9 w-[280px] text-xs">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batchRows.map((batch) => (
                      <SelectItem key={batch.evidence_batch_id} value={batch.evidence_batch_id}>
                        {batch.evidence_batch_id} · {batch.evidence_count} items
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs opacity-50">
                  Limit {batchRows.find((batch) => batch.evidence_batch_id === selectedBatchId)?.evidence_limit ?? "—"}
                </span>
              </div>
            )}
          </Card>

          <Card className="border-border bg-card/80">
            <Table>
              <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Evidence Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidenceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-xs opacity-50">
                      No evidence items found.
                    </TableCell>
                  </TableRow>
                )}
                {evidenceRows.map((item) => {
                  const selected = item.evidence_id === selectedEvidenceId;
                  return (
                    <TableRow
                      key={item.evidence_id}
                      className={selected ? "bg-muted/60" : undefined}
                      onClick={() => setSelectedEvidenceId(item.evidence_id)}
                    >
                      <TableCell className="opacity-50">{item.position}</TableCell>
                      <TableCell>
                        <div
                          className="font-medium"
                          style={{ color: selected ? "#ff6b35" : "#e8eaed" }}
                        >
                          {item.title}
                        </div>
                        <div className="text-[10px] opacity-50">{item.url}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </section>

        <section className="space-y-4">
          {!selectedEvidenceId && (
            <Card className="border-border px-6 py-10 text-center text-xs opacity-50">
              Select an evidence item to preview.
            </Card>
          )}
          {selectedEvidenceId && !activeEvidence && (
            <Card className="border-border px-6 py-10 text-center text-xs opacity-50">
              Loading evidence content...
            </Card>
          )}
          {selectedEvidenceId && activeEvidence && (
            <>
              <Card className="border-border bg-card/80 p-5">
                <p
                  className="text-[10px] uppercase tracking-widest opacity-50"
                  style={{ fontFamily: "var(--font-1-serif)" }}
                >
                  Raw Article
                </p>
                <h2 className="mt-2 text-sm font-semibold text-foreground">
                  {activeEvidence.title}
                </h2>
                <p className="text-[11px] opacity-50">{activeEvidence.url}</p>
                <div className="mt-4 whitespace-pre-line text-sm leading-relaxed">
                  {activeEvidence.raw_content}
                </div>
              </Card>

              {NORMALIZATION_LEVELS.map((level) => {
                const contentMap: Record<string, string | undefined> = {
                  l0_raw: activeEvidence.raw_content,
                  l1_cleaned: activeEvidence.cleaned_content,
                  l2_neutralized: activeEvidence.neutralized_content,
                  l3_abstracted: activeEvidence.abstracted_content,
                };
                const value = contentMap[level.key];
                return (
                  <Card key={level.key} className="border-border bg-card/80 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wider opacity-60">
                        {VIEW_LABELS[level.key]}
                      </p>
                    </div>
                    <div className="mt-3 whitespace-pre-line text-sm leading-relaxed">
                      {value?.trim().length ? value : "—"}
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
