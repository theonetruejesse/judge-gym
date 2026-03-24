"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@judge-gym/engine-convex";
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

type EvidenceUniverseSummary = {
  universe_id: string;
  universe_tag: string;
  kind: string;
  title: string;
  status: string;
  acquisition_spec_count: number;
  evidence_set_count: number;
  candidate_count: number;
  item_count: number;
};

type AcquisitionRunItem = {
  acquisition_run_id: string;
  spec_tag: string;
  discovery_provider: string;
  status: string;
  candidate_count: number;
  item_count: number;
  started_at_ms: number | null;
};

type EvidenceSetItem = {
  evidence_set_id: string;
  evidence_set_tag: string;
  title: string;
  source_kind: string;
  quality_label: string;
  item_count: number;
  status: string;
};

type UniverseItem = {
  evidence_item_id: string;
  canonical_key: string;
  title: string | null;
  source_url: string | null;
  source_name: string | null;
  publish_date: string | null;
  language: string | null;
  hydration_status: string;
};

type EvidenceContent = {
  evidence_item_id: string;
  canonical_key: string;
  title: string | null;
  source_url: string | null;
  source_name: string | null;
  publish_date: string | null;
  raw_text: string | null;
  raw_html: string | null;
  views: Array<{
    evidence_view_id: string;
    view_kind: string;
    pipeline_kind: string;
    pipeline_version: string;
    content: string | null;
  }>;
};

export default function EvidenceUniversePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<string>("raw_text");
  const [content, setContent] = useState<EvidenceContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const getEvidenceItemContent = useAction(api.packages.evidence.getEvidenceItemContent);

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

  const universe = useQuery(
    api.packages.evidence.getEvidenceUniverseSummary,
    resolvedParams ? { universe_id: resolvedParams.id as never } : "skip",
  ) as EvidenceUniverseSummary | undefined;
  const acquisitionRuns = useQuery(
    api.packages.evidence.listAcquisitionRuns,
    resolvedParams ? { universe_id: resolvedParams.id as never } : "skip",
  ) as AcquisitionRunItem[] | undefined;
  const evidenceSets = useQuery(
    api.packages.evidence.listEvidenceSets,
    resolvedParams ? { universe_id: resolvedParams.id as never } : "skip",
  ) as EvidenceSetItem[] | undefined;
  const evidenceItems = useQuery(
    api.packages.evidence.listUniverseItems,
    resolvedParams ? { universe_id: resolvedParams.id as never } : "skip",
  ) as UniverseItem[] | undefined;

  const universeLoading = !!resolvedParams && universe === undefined;
  const evidenceLoading = !!resolvedParams && evidenceItems === undefined;
  const evidenceRows = evidenceItems ?? [];

  useEffect(() => {
    if (!selectedEvidenceId && evidenceRows.length > 0) {
      setSelectedEvidenceId(evidenceRows[0].evidence_item_id);
    }
  }, [evidenceRows, selectedEvidenceId]);

  useEffect(() => {
    if (!selectedEvidenceId) {
      setContent(null);
      return;
    }

    let cancelled = false;
    setContentLoading(true);
    void getEvidenceItemContent({ evidence_item_id: selectedEvidenceId as never })
      .then((result) => {
        if (cancelled) return;
        const typed = result as EvidenceContent;
        setContent(typed);
        const firstTab = typed.raw_text
          ? "raw_text"
          : typed.raw_html
            ? "raw_html"
            : (typed.views[0]?.view_kind ?? "raw_text");
        setSelectedTab(firstTab);
      })
      .catch(() => {
        if (!cancelled) {
          setContent(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getEvidenceItemContent, selectedEvidenceId]);

  if (!resolvedParams) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <LabNavbar />
        <div className="px-6 py-12">
          <p className="text-sm">Loading evidence universe...</p>
        </div>
      </div>
    );
  }

  if (!universeLoading && !universe) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <LabNavbar />
        <div className="px-6 py-12">
          <p className="text-sm">Evidence universe not found.</p>
        </div>
      </div>
    );
  }

  const selectedItem =
    evidenceRows.find((item) => item.evidence_item_id === selectedEvidenceId) ?? null;
  const previewTabs = [
    ...(content?.raw_text
      ? [{ key: "raw_text", label: "Raw Text", content: content.raw_text }]
      : []),
    ...(content?.raw_html
      ? [{ key: "raw_html", label: "Raw HTML", content: content.raw_html }]
      : []),
    ...((content?.views ?? []).map((view) => ({
      key: view.view_kind,
      label: view.view_kind,
      content: view.content ?? "",
    }))),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Evidence Universe
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            {universe?.title ?? "Evidence Universe"}
          </h1>
          <p className="text-[11px] opacity-50">
            {universe?.universe_tag ?? "—"} · {universe?.kind ?? "—"} · candidates{" "}
            {universe?.candidate_count ?? 0} · items {universe?.item_count ?? 0} · sets{" "}
            {universe?.evidence_set_count ?? 0}
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Card className="border-border bg-card/80">
              <div className="border-b border-border px-5 py-4">
                <p className="text-[10px] uppercase tracking-widest opacity-50">
                  Universe Items
                </p>
              </div>
              <Table>
                <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidenceLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs opacity-50">
                        Loading evidence items...
                      </TableCell>
                    </TableRow>
                  )}
                  {!evidenceLoading && evidenceRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs opacity-50">
                        No hydrated evidence items found.
                      </TableCell>
                    </TableRow>
                  )}
                  {evidenceRows.map((item) => (
                    <TableRow
                      key={item.evidence_item_id}
                      className={
                        item.evidence_item_id === selectedEvidenceId
                          ? "bg-muted/60"
                          : "cursor-pointer hover:bg-muted/30"
                      }
                      onClick={() => setSelectedEvidenceId(item.evidence_item_id)}
                    >
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium">
                            {item.title ?? item.canonical_key}
                          </div>
                          <div className="text-[10px] opacity-45">
                            {item.canonical_key}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{item.source_name ?? "—"}</div>
                        <div className="max-w-[18rem] truncate text-[10px] opacity-45">
                          {item.source_url ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.publish_date ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.hydration_status}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card className="border-border bg-card/80 p-5">
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Preview
              </p>
              {!selectedEvidenceId && (
                <p className="mt-4 text-xs opacity-50">
                  Select an item to inspect its stored content.
                </p>
              )}
              {selectedEvidenceId && contentLoading && (
                <p className="mt-4 text-xs opacity-50">
                  Loading stored evidence content...
                </p>
              )}
              {selectedEvidenceId && !contentLoading && content && (
                <div className="mt-4 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {selectedItem?.title ?? content.canonical_key}
                    </h2>
                    <p className="break-all text-[11px] opacity-50">
                      {selectedItem?.source_url ?? content.source_url ?? "—"}
                    </p>
                  </div>

                  <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                    <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
                      {previewTabs.map((tab) => (
                        <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {previewTabs.map((tab) => (
                      <TabsContent key={tab.key} value={tab.key}>
                        <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/20 p-4 text-xs leading-5">
                          {tab.content || "No stored content."}
                        </pre>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border bg-card/80">
              <div className="border-b border-border px-5 py-4">
                <p className="text-[10px] uppercase tracking-widest opacity-50">
                  Acquisition Runs
                </p>
              </div>
              <Table>
                <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <TableRow>
                    <TableHead>Spec</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Candidates</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(acquisitionRuns ?? []).map((run) => (
                    <TableRow key={run.acquisition_run_id}>
                      <TableCell className="text-xs">{run.spec_tag}</TableCell>
                      <TableCell className="text-xs">{run.status}</TableCell>
                      <TableCell className="text-right text-xs">
                        {run.candidate_count}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {run.item_count}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(acquisitionRuns ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs opacity-50">
                        No acquisition runs found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            <Card className="border-border bg-card/80">
              <div className="border-b border-border px-5 py-4">
                <p className="text-[10px] uppercase tracking-widest opacity-50">
                  Evidence Sets
                </p>
              </div>
              <Table>
                <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <TableRow>
                    <TableHead>Set</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(evidenceSets ?? []).map((setRow) => (
                    <TableRow key={setRow.evidence_set_id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium">{setRow.title}</div>
                          <div className="text-[10px] opacity-45">
                            {setRow.evidence_set_tag}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {setRow.quality_label} · {setRow.source_kind}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {setRow.item_count}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(evidenceSets ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-xs opacity-50">
                        No evidence sets found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
