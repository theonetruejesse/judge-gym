"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EvidenceSetCatalogItem = {
  evidence_set_id: string;
  universe_id: string;
  universe_tag: string;
  universe_title: string;
  evidence_set_tag: string;
  title: string;
  source_kind: string;
  quality_label: string;
  item_count: number;
  status: string;
};

export type EvidenceSetItem = {
  evidence_set_item_id: string;
  evidence_item_id: string;
  pinned_source_record_id: string | null;
  pinned_view_id: string | null;
  ordinal: number;
  inclusion_reason: string | null;
  quality_label: string;
  title: string | null;
  source_url: string | null;
  source_name: string | null;
  publish_date: string | null;
  language: string | null;
  canonical_key: string;
};

interface EvidenceSelectorProps {
  evidenceSets: EvidenceSetCatalogItem[];
  selectedEvidenceSetId: string;
  onEvidenceSetChange: (value: string) => void;
  evidenceItems: EvidenceSetItem[];
}

export function EvidenceSelector({
  evidenceSets,
  selectedEvidenceSetId,
  onEvidenceSetChange,
  evidenceItems,
}: EvidenceSelectorProps) {
  const selectedEvidenceSet = evidenceSets.find(
    (set) => set.evidence_set_id === selectedEvidenceSetId,
  );

  return (
    <Card className="border-border bg-card/80">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Evidence Set
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-xs opacity-70">
              Experiments now bind directly to curated evidence sets.
            </p>
            <p className="text-[11px] uppercase tracking-widest opacity-50">
              Selected items: {selectedEvidenceSet?.item_count ?? 0}
            </p>
          </div>

          <Select
            value={selectedEvidenceSetId}
            onValueChange={onEvidenceSetChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select evidence set" />
            </SelectTrigger>
            <SelectContent>
              {evidenceSets.map((evidenceSet) => (
                <SelectItem
                  key={evidenceSet.evidence_set_id}
                  value={evidenceSet.evidence_set_id}
                >
                  {evidenceSet.evidence_set_tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEvidenceSet ? (
            <div className="rounded border border-border px-3 py-3 text-xs">
              <div className="font-medium text-foreground">
                {selectedEvidenceSet.title}
              </div>
              <div className="mt-1 text-[11px] opacity-60">
                {selectedEvidenceSet.universe_tag} · {selectedEvidenceSet.source_kind} ·{" "}
                {selectedEvidenceSet.quality_label}
              </div>
            </div>
          ) : (
            <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs opacity-50">
              No evidence sets available yet.
            </div>
          )}

          <div className="max-h-[420px] overflow-y-auto rounded border border-border">
            <table className="w-full text-xs">
              <tbody>
                {evidenceItems.map((item) => (
                  <tr
                    key={item.evidence_set_item_id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <div className="text-foreground">
                        {item.title ?? item.canonical_key}
                      </div>
                      <div className="text-[10px] opacity-50">
                        {item.source_name ?? item.source_url ?? item.canonical_key}
                      </div>
                    </td>
                    <td className="w-24 px-3 py-2 text-right text-[10px] uppercase tracking-wider opacity-50">
                      #{item.ordinal + 1}
                    </td>
                  </tr>
                ))}
                {selectedEvidenceSetId && evidenceItems.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-xs opacity-50">
                      No items pinned to this evidence set yet.
                    </td>
                  </tr>
                )}
                {!selectedEvidenceSetId && (
                  <tr>
                    <td className="px-3 py-4 text-center text-xs opacity-50">
                      Select an evidence set to inspect its items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
