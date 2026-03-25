"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@judge-gym/engine-convex";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { MODEL_OPTIONS, STATUS_COLORS, VIEW_LABELS } from "@/lib/ui-maps";

const SOURCE_RECORD_OPTIONS = [
  { value: "source_text", label: "Source Text" },
  { value: "paper_original", label: "Paper Original" },
] as const;

const TRANSFORM_STAGE_OPTIONS = [
  { value: "l1_cleaned", label: VIEW_LABELS.l1_cleaned },
  { value: "l2_neutralized", label: VIEW_LABELS.l2_neutralized },
  { value: "l3_abstracted", label: VIEW_LABELS.l3_abstracted },
] as const;

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

type TransformRun = {
  evidence_transform_run_id: string;
  evidence_set_id: string;
  evidence_set_tag: string;
  evidence_set_title: string;
  evidence_set_quality_label: string;
  source_record_kind: "source_text" | "paper_original";
  target_view_kinds: Array<"l1_cleaned" | "l2_neutralized" | "l3_abstracted">;
  model: string;
  prompt_version: string;
  status: string;
  workflow_id: string | null;
  workflow_run_id: string | null;
  current_stage: "l1_cleaned" | "l2_neutralized" | "l3_abstracted" | null;
  total_count: number;
  completed_count: number;
  failed_count: number;
  last_error_message: string | null;
  started_at_ms: number | null;
  finished_at_ms: number | null;
  created_at_ms: number;
};

type TransformCoverage = {
  evidence_set_id: string;
  evidence_set_tag: string;
  title: string;
  quality_label: string;
  item_count: number;
  source_record_coverage: Array<{
    record_kind: "source_text" | "paper_original";
    available_count: number;
    missing_count: number;
  }>;
  view_coverage: Array<{
    view_kind: "l1_cleaned" | "l2_neutralized" | "l3_abstracted";
    completed_count: number;
    error_count: number;
    pending_count: number;
  }>;
};

type EvidenceContent = {
  evidence_item_id: string;
  canonical_key: string;
  title: string | null;
  source_url: string | null;
  source_name: string | null;
  publish_date: string | null;
  source_records: Array<{
    evidence_source_record_id: string;
    record_kind: string;
    is_primary: boolean;
    pipeline_kind: string;
    pipeline_version: string;
    content: string | null;
  }>;
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
  const [selectedEvidenceSetId, setSelectedEvidenceSetId] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<string>("source_text");
  const [content, setContent] = useState<EvidenceContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [transformSourceRecordKind, setTransformSourceRecordKind] = useState<
    "source_text" | "paper_original"
  >("source_text");
  const [transformModel, setTransformModel] = useState<string>("claude-sonnet-4");
  const [selectedTransformStages, setSelectedTransformStages] = useState<
    Array<"l1_cleaned" | "l2_neutralized" | "l3_abstracted">
  >(["l1_cleaned", "l2_neutralized", "l3_abstracted"]);
  const [transformSubmitting, setTransformSubmitting] = useState(false);

  const getEvidenceItemContent = useAction(api.packages.evidence.getEvidenceItemContent);
  const createEvidenceTransformRun = useMutation(
    api.packages.evidence_transform.createEvidenceTransformRun,
  );
  const startEvidenceTransformRun = useAction(
    api.packages.evidence_transform.startEvidenceTransformRun,
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
  const transformRuns = useQuery(
    api.packages.evidence_transform.listEvidenceTransformRuns,
    resolvedParams ? { universe_id: resolvedParams.id as never } : "skip",
  ) as TransformRun[] | undefined;
  const transformCoverage = useQuery(
    api.packages.evidence_transform.getEvidenceSetTransformCoverage,
    selectedEvidenceSetId ? { evidence_set_id: selectedEvidenceSetId as never } : "skip",
  ) as TransformCoverage | undefined;

  const universeLoading = !!resolvedParams && universe === undefined;
  const evidenceLoading = !!resolvedParams && evidenceItems === undefined;
  const evidenceRows = evidenceItems ?? [];

  useEffect(() => {
    if (!selectedEvidenceId && evidenceRows.length > 0) {
      setSelectedEvidenceId(evidenceRows[0].evidence_item_id);
    }
  }, [evidenceRows, selectedEvidenceId]);

  useEffect(() => {
    if (!selectedEvidenceSetId && (evidenceSets?.length ?? 0) > 0) {
      setSelectedEvidenceSetId(evidenceSets?.[0]?.evidence_set_id ?? "");
    }
  }, [evidenceSets, selectedEvidenceSetId]);

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
        const firstTab = typed.source_records[0]?.record_kind
          ?? typed.views[0]?.view_kind
          ?? "source_text";
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
    ...((content?.source_records ?? []).map((record) => ({
      key: record.record_kind,
      label: record.record_kind,
      content: record.content ?? "",
    }))),
    ...((content?.views ?? []).map((view) => ({
      key: view.view_kind,
      label: VIEW_LABELS[view.view_kind] ?? view.view_kind,
      content: view.content ?? "",
    }))),
  ];

  const toggleTransformStage = (
    stage: "l1_cleaned" | "l2_neutralized" | "l3_abstracted",
    nextChecked: boolean,
  ) => {
    setSelectedTransformStages((current) => {
      if (nextChecked) {
        return current.includes(stage) ? current : [...current, stage];
      }
      return current.filter((value) => value !== stage);
    });
  };

  const handleLaunchTransformRun = async () => {
    if (!selectedEvidenceSetId) {
      toast.error("Select an evidence set before starting transforms.");
      return;
    }
    if (selectedTransformStages.length === 0) {
      toast.error("Select at least one semantic transform stage.");
      return;
    }

    setTransformSubmitting(true);
    try {
      const orderedStages = TRANSFORM_STAGE_OPTIONS
        .map((option) => option.value)
        .filter((value) => selectedTransformStages.includes(value));
      const { evidence_transform_run_id } = await createEvidenceTransformRun({
        evidence_set_id: selectedEvidenceSetId as never,
        source_record_kind: transformSourceRecordKind,
        target_view_kinds: orderedStages as never,
        model: transformModel as never,
      });
      await startEvidenceTransformRun({
        evidence_transform_run_id: evidence_transform_run_id as never,
      });
      toast.success("Semantic transform started.", {
        description: `${orderedStages.map((stage) => VIEW_LABELS[stage]).join(" -> ")} via ${transformModel}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Semantic transform launch failed.", {
        description: message,
      });
    } finally {
      setTransformSubmitting(false);
    }
  };

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

            <Card className="border-border bg-card/80 p-5">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest opacity-50">
                  Semantic Transforms
                </p>
                <h2 className="text-sm font-semibold">Coverage and execution</h2>
                <p className="text-[11px] opacity-50">
                  Run `l1/l2/l3` transforms on a curated evidence set, then inspect raw-vs-semantic
                  readiness before locking the V4 matrix.
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Evidence Set</Label>
                  <Select
                    value={selectedEvidenceSetId}
                    onValueChange={(value) => setSelectedEvidenceSetId(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select evidence set" />
                    </SelectTrigger>
                    <SelectContent>
                      {(evidenceSets ?? []).map((setRow) => (
                        <SelectItem key={setRow.evidence_set_id} value={setRow.evidence_set_id}>
                          {setRow.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Source Record</Label>
                  <Select
                    value={transformSourceRecordKind}
                    onValueChange={(value) =>
                      setTransformSourceRecordKind(value as "source_text" | "paper_original")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_RECORD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Transform Model</Label>
                  <Select value={transformModel} onValueChange={setTransformModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Target Views</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  {TRANSFORM_STAGE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 rounded border border-border bg-muted/20 px-3 py-2 text-xs"
                    >
                      <Checkbox
                        checked={selectedTransformStages.includes(option.value)}
                        onCheckedChange={(checked) =>
                          toggleTransformStage(option.value, checked === true)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-[11px] opacity-50">
                  Coverage updates automatically as semantic views complete or fail.
                </div>
                <Button
                  onClick={handleLaunchTransformRun}
                  disabled={transformSubmitting || !selectedEvidenceSetId}
                >
                  {transformSubmitting ? "Starting..." : "Start Semantic Transform"}
                </Button>
              </div>

              {transformCoverage && (
                <div className="mt-6 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{transformCoverage.evidence_set_tag}</Badge>
                    <Badge variant="secondary">{transformCoverage.quality_label}</Badge>
                    <span className="text-[11px] opacity-50">
                      {transformCoverage.item_count} unique evidence items
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-border bg-muted/20 p-4">
                      <p className="text-[10px] uppercase tracking-widest opacity-50">
                        Source Record Coverage
                      </p>
                      <div className="mt-3 space-y-2">
                        {transformCoverage.source_record_coverage.map((entry) => (
                          <div
                            key={entry.record_kind}
                            className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs"
                          >
                            <span>{VIEW_LABELS[entry.record_kind] ?? entry.record_kind}</span>
                            <span className="opacity-60">
                              {entry.available_count} ready · {entry.missing_count} missing
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="border-border bg-muted/20 p-4">
                      <p className="text-[10px] uppercase tracking-widest opacity-50">
                        Semantic View Coverage
                      </p>
                      <div className="mt-3 space-y-2">
                        {transformCoverage.view_coverage.map((entry) => (
                          <div
                            key={entry.view_kind}
                            className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs"
                          >
                            <span>{VIEW_LABELS[entry.view_kind] ?? entry.view_kind}</span>
                            <span className="opacity-60">
                              {entry.completed_count} done · {entry.error_count} error · {entry.pending_count} pending
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </Card>

            <Card className="border-border bg-card/80">
              <div className="border-b border-border px-5 py-4">
                <p className="text-[10px] uppercase tracking-widest opacity-50">
                  Transform Runs
                </p>
              </div>
              <Table>
                <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <TableRow>
                    <TableHead>Set</TableHead>
                    <TableHead>Stages</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transformRuns ?? []).map((run) => (
                    <TableRow key={run.evidence_transform_run_id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium">{run.evidence_set_title}</div>
                          <div className="text-[10px] opacity-45">
                            {run.evidence_set_tag} · {VIEW_LABELS[run.source_record_kind]}
                          </div>
                          <div className="text-[10px] opacity-45">{run.model}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {run.target_view_kinds.map((stage) => VIEW_LABELS[stage]).join(" -> ")}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant="outline"
                          style={{ borderColor: STATUS_COLORS[run.status] ?? "#6b7280" }}
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {run.completed_count}/{run.total_count} · err {run.failed_count}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(transformRuns ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs opacity-50">
                        No semantic transform runs found.
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
