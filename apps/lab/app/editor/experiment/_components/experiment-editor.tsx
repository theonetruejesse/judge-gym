"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@judge-gym/engine-convex";
import LabNavbar from "@/components/lab_navbar";
import { ExperimentForm } from "./experiment-form";
import {
  EvidenceSelector,
  type EvidenceSetCatalogItem,
  type EvidenceSetItem,
} from "./evidence-selector";
import type { ExperimentFormDefaults } from "../_utils/experiment-form-schema";

interface ExperimentEditorProps {
  defaultValues?: ExperimentFormDefaults;
}

export function ExperimentEditor({ defaultValues }: ExperimentEditorProps) {
  const evidenceSets = useQuery(api.packages.evidence.listEvidenceSets, {}) as
    | EvidenceSetCatalogItem[]
    | undefined;
  const [selectedEvidenceSetId, setSelectedEvidenceSetId] = useState<string>("");
  const [experimentStatus, setExperimentStatus] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const evidenceItems = useQuery(api.packages.evidence.listEvidenceSetItems, selectedEvidenceSetId
    ? { evidence_set_id: selectedEvidenceSetId }
    : "skip") as EvidenceSetItem[] | undefined;

  useEffect(() => {
    if (initializedRef.current) return;
    if (!evidenceSets || evidenceSets.length === 0) return;
    setSelectedEvidenceSetId(evidenceSets[0].evidence_set_id);
    initializedRef.current = true;
  }, [evidenceSets]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Experiment Editor
          </p>
          <p className="text-xs opacity-60">
            Configure rubric/scoring stages and bind the run to a curated evidence set.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <ExperimentForm
              defaultValues={defaultValues}
              selectedEvidenceSetId={selectedEvidenceSetId}
              selectedEvidenceCount={evidenceItems?.length ?? 0}
              onStatusChange={setExperimentStatus}
            />
            {experimentStatus && (
              <div className="text-[10px] uppercase tracking-wider opacity-60">
                {experimentStatus}
              </div>
            )}
          </div>

          <EvidenceSelector
            evidenceSets={evidenceSets ?? []}
            selectedEvidenceSetId={selectedEvidenceSetId}
            onEvidenceSetChange={setSelectedEvidenceSetId}
            evidenceItems={evidenceItems ?? []}
          />
        </div>
      </div>
    </div>
  );
}
