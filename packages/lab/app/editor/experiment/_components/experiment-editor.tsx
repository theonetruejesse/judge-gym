"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@judge-gym/engine-convex";
import LabNavbar from "@/components/lab_navbar";
import { ExperimentForm } from "./experiment-form";
import {
  EvidenceSelector,
  type EvidenceItem,
  type EvidenceWindowItem,
} from "./evidence-selector";
import type { ExperimentFormDefaults } from "../_utils/experiment-form-schema";

interface ExperimentEditorProps {
  defaultValues?: ExperimentFormDefaults;
}

export function ExperimentEditor({ defaultValues }: ExperimentEditorProps) {
  const router = useRouter();
  const windows = useQuery(api.packages.lab.listEvidenceWindows, {}) as
    | EvidenceWindowItem[]
    | undefined;
  const [selectedWindowId, setSelectedWindowId] = useState<string>("");
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [experimentStatus, setExperimentStatus] = useState<string | null>(null);
  const createWindowValue = "__create_window__";
  const initializedRef = useRef(false);

  const evidenceItems = useQuery(
    api.packages.lab.listEvidenceByWindow,
    selectedWindowId ? { window_id: selectedWindowId } : "skip",
  ) as EvidenceItem[] | undefined;

  useEffect(() => {
    if (initializedRef.current) return;
    if (!windows || windows.length === 0) return;
    setSelectedWindowId(windows[0].window_id);
    initializedRef.current = true;
  }, [windows]);

  const handleWindowChange = (value: string) => {
    if (value === createWindowValue) {
      router.push("/editor/window");
      return;
    }
    setSelectedWindowId(value);
  };

  const evidenceRows = evidenceItems ?? [];

  useEffect(() => {
    if (!selectedWindowId || !evidenceItems) return;
    const newIds = evidenceItems.map((item) => item.evidence_id);
    setSelectedEvidenceIds((prev) => {
      const merged = new Set(prev);
      for (const id of newIds) merged.add(id);
      return Array.from(merged);
    });
  }, [selectedWindowId, evidenceItems]);

  const toggleEvidence = (id: string) => {
    setSelectedEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectWindowEvidence = () => {
    const ids = evidenceRows.map((row) => row.evidence_id);
    setSelectedEvidenceIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearWindowEvidence = () => {
    const ids = new Set(evidenceRows.map((row) => row.evidence_id));
    setSelectedEvidenceIds((prev) => prev.filter((id) => !ids.has(id)));
  };

  const clearAllEvidence = () => {
    setSelectedEvidenceIds([]);
  };

  const sortedEvidence = useMemo(
    () => evidenceRows.slice().sort((a, b) => a.created_at - b.created_at),
    [evidenceRows],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Experiment Editor
          </p>
          <p className="text-xs opacity-60">
            Configure rubric/scoring stages and freeze evidence selections.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <ExperimentForm
              defaultValues={defaultValues}
              selectedEvidenceIds={selectedEvidenceIds}
              onStatusChange={setExperimentStatus}
            />
            {experimentStatus && (
              <div className="text-[10px] uppercase tracking-wider opacity-60">
                {experimentStatus}
              </div>
            )}
          </div>

          <EvidenceSelector
            windows={windows ?? []}
            selectedWindowId={selectedWindowId}
            onWindowChange={handleWindowChange}
            createWindowValue={createWindowValue}
            evidenceItems={sortedEvidence}
            selectedEvidenceIds={selectedEvidenceIds}
            onToggleEvidence={toggleEvidence}
            onSelectWindowEvidence={selectWindowEvidence}
            onClearWindowEvidence={clearWindowEvidence}
            onClearAllEvidence={clearAllEvidence}
          />
        </div>
      </div>
    </div>
  );
}
