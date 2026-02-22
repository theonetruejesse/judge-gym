"use client";

import Link from "next/link";
import LabNavbar from "@/components/lab_navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function EditorLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Editor
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border bg-card/80 p-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Window
              </p>
              <p className="mt-1 text-xs opacity-60">
                Define a scraping window and model for evidence collection.
              </p>
            </div>
            <Button
              asChild
              className="mt-4 w-full text-[10px] uppercase tracking-wider"
            >
              <Link href="/editor/window">New Window</Link>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
