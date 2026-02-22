"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import { Button } from "@/components/ui/button";
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
  evidence_status:
    | "scraping"
    | "cleaning"
    | "neutralizing"
    | "abstracting"
    | "ready";
};

export default function EvidenceHomePage() {
  const router = useRouter();
  const windows = useQuery(
    api.packages.lab.listEvidenceWindows,
    {},
  ) as EvidenceWindowItem[] | undefined;

  const windowsLoading = windows === undefined;
  const windowRows = windows ?? [];

  const buildWindowCloneHref = (window: EvidenceWindowItem) => {
    const params = new URLSearchParams({
      concept: window.concept,
      country: window.country,
      start_date: window.start_date,
      end_date: window.end_date,
      model_id: window.model_id,
    });
    return `/editor/window?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-6">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Windows
              </p>
              <p className="text-xs opacity-60">
                {windowRows.length} windows
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="text-[10px] uppercase tracking-wider"
            >
              <Link href="/editor/window">New Window</Link>
            </Button>
          </div>

          <div className="overflow-hidden rounded border border-border bg-card/80">
            <Table>
              <TableHeader className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Evidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {windowsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs opacity-50">
                      Loading evidence windows...
                    </TableCell>
                  </TableRow>
                )}
                {!windowsLoading && windowRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs opacity-50">
                      No evidence windows found.
                    </TableCell>
                  </TableRow>
                )}
                {windowRows.map((window) => (
                  <TableRow
                    key={window.window_id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/evidence/${window.window_id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {window.window_tag ?? "—"}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {window.country}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {window.model_id}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {`${window.start_date} -> ${window.end_date}`}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {window.evidence_status ?? "—"}
                    </TableCell>
                    <TableCell className="text-right opacity-70">
                      {window.evidence_count ?? 0}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] uppercase tracking-wider"
                      >
                        <Link href={buildWindowCloneHref(window)}>Clone</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
