"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EvidenceWindowItem = {
  window_id: string;
  start_date: string;
  end_date: string;
  country: string;
  query: string;
  model: string;
};

export type EvidenceItem = {
  evidence_id: string;
  title: string;
  url: string;
  created_at: number;
};

interface EvidenceSelectorProps {
  windows: EvidenceWindowItem[];
  selectedWindowId: string;
  onWindowChange: (value: string) => void;
  createWindowValue: string;
  evidenceItems: EvidenceItem[];
  selectedEvidenceIds: string[];
  onToggleEvidence: (id: string) => void;
  onSelectWindowEvidence: () => void;
  onClearWindowEvidence: () => void;
  onClearAllEvidence: () => void;
}

export function EvidenceSelector({
  windows,
  selectedWindowId,
  onWindowChange,
  createWindowValue,
  evidenceItems,
  selectedEvidenceIds,
  onToggleEvidence,
  onSelectWindowEvidence,
  onClearWindowEvidence,
  onClearAllEvidence,
}: EvidenceSelectorProps) {
  return (
    <Card className="border-border bg-card/80">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Evidence Selection
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-xs opacity-70">
              Select evidence across any windows. Selections persist as you switch
              windows.
            </p>
            <p className="text-[11px] uppercase tracking-widest opacity-50">
              Total selected: {selectedEvidenceIds.length}
            </p>
          </div>

          <Select value={selectedWindowId} onValueChange={onWindowChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select evidence window" />
            </SelectTrigger>
            <SelectContent>
              {windows.map((window) => (
                <SelectItem key={window.window_id} value={window.window_id}>
                  {window.query}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value={createWindowValue}>
                Create new window
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onSelectWindowEvidence}
              className="text-[10px] uppercase tracking-wider"
            >
              Select Window
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onClearWindowEvidence}
              className="text-[10px] uppercase tracking-wider"
            >
              Clear Window
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onClearAllEvidence}
              className="text-[10px] uppercase tracking-wider"
            >
              Clear All
            </Button>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded border border-border">
            <table className="w-full text-xs">
              <tbody>
                {evidenceItems.map((item) => {
                  const selected = selectedEvidenceIds.includes(item.evidence_id);
                  return (
                    <tr
                      key={item.evidence_id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="w-10 px-3 py-2">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => onToggleEvidence(item.evidence_id)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-foreground">{item.title}</div>
                        <div className="text-[10px] opacity-50">{item.url}</div>
                      </td>
                    </tr>
                  );
                })}
                {evidenceItems.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-xs opacity-50">
                      No evidence loaded for this window.
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
