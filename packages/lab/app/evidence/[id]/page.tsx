"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import { NORMALIZATION_LEVELS, VIEW_LABELS } from "@/lib/ui-maps";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LabNavbar from "@/components/lab_navbar";

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

type EvidenceItem = {
  evidence_id: string;
  title: string;
  url: string;
  created_at: number;
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
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("l0_raw");

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

  const windows = useQuery(api.packages.lab.listEvidenceWindows, {}) as
    | EvidenceWindowItem[]
    | undefined;

  const evidenceItems = useQuery(
    api.packages.lab.listEvidenceByWindow,
    resolvedParams ? { window_id: resolvedParams.id } : "skip",
  ) as EvidenceItem[] | undefined;

  const evidenceContent = useQuery(
    api.packages.lab.getEvidenceContent,
    selectedEvidenceId ? { evidence_id: selectedEvidenceId } : "skip",
  ) as EvidenceContent | null | undefined;

  const windowsLoading = windows === undefined;
  const evidenceLoading = !!resolvedParams && evidenceItems === undefined;
  const windowRows = windows ?? [];
  const matchedWindow = windowRows.find(
    (window) => window.window_id === resolvedParams?.id,
  );
  const selectedWindow = matchedWindow;

  const evidenceRows = evidenceItems ?? [];

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

      <div className="w-full max-w-full px-6 py-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Evidence Window
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            {(selectedWindow?.window_tag ??
              selectedWindow?.concept ??
              "Evidence Window") + ` (${selectedWindow?.evidence_count ?? 0})`}
          </h1>
          <p className="text-[11px] opacity-50">
            {selectedWindow?.country ?? "—"} ·{" "}
            {selectedWindow?.start_date ?? "—"} -{" "}
            {selectedWindow?.end_date ?? "—"} ·{" "}
            {selectedWindow?.model_id ?? "—"}
          </p>
        </div>

        <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
          <section className="min-w-0 flex-1 space-y-4 lg:basis-[38%] lg:max-w-[38%]">
            <Card className="w-full border-border bg-card/80">
              <Table className="w-full table-fixed">
                <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead className="w-full">Evidence Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidenceLoading && evidenceRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-xs opacity-50">
                        Loading evidence items...
                      </TableCell>
                    </TableRow>
                  )}
                  {!evidenceLoading && evidenceRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-xs opacity-50">
                        No evidence items found.
                      </TableCell>
                    </TableRow>
                  )}
                  {evidenceRows.map((item, index) => {
                    const selected = item.evidence_id === selectedEvidenceId;
                    return (
                      <TableRow
                        key={item.evidence_id}
                        className={selected ? "bg-muted/60" : undefined}
                        onClick={() => setSelectedEvidenceId(item.evidence_id)}
                      >
                        <TableCell className="opacity-50">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div
                            className="break-words font-medium"
                            style={{ color: selected ? "#ff6b35" : "#e8eaed" }}
                          >
                            {item.title}
                          </div>
                          <div className="break-all text-[10px] opacity-50">
                            {item.url}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </section>

          <section className="min-w-0 flex-1 space-y-4 lg:basis-[62%]">
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
                <Card className="w-full border-border bg-card/80 p-5">
                  <h2 className="break-words text-sm font-semibold text-foreground">
                    {activeEvidence.title}
                  </h2>
                  <p className="break-all text-[11px] opacity-50">
                    {activeEvidence.url}
                  </p>

                  <Tabs
                    className="mt-4"
                    value={selectedLevel}
                    onValueChange={setSelectedLevel}
                  >
                    <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
                      {NORMALIZATION_LEVELS.map((level) => (
                        <TabsTrigger
                          key={level.key}
                          value={level.key}
                          className="text-xs"
                        >
                          {VIEW_LABELS[level.key]}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {(() => {
                      const contentMap: Record<string, string | undefined> = {
                        l0_raw: activeEvidence.raw_content,
                        l1_cleaned: activeEvidence.cleaned_content,
                        l2_neutralized: activeEvidence.neutralized_content,
                        l3_abstracted: activeEvidence.abstracted_content,
                      };
                      return NORMALIZATION_LEVELS.map((level) => {
                        const value = contentMap[level.key];
                        return (
                          <TabsContent key={level.key} value={level.key}>
                            <div className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">
                              {value?.trim().length ? value : "—"}
                            </div>
                          </TabsContent>
                        );
                      });
                    })()}
                  </Tabs>
                </Card>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
