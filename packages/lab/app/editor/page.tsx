"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function EditorLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-card/80 px-6 py-4">
        <div>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            judge-gym
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Editor
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href="/" className="hover:text-[#ff6b35]">
            Back to judge-gym
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:grid-cols-2">
        <Card className="border-border bg-card/80 p-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              Experiment
            </p>
            <p className="mt-1 text-xs opacity-60">
              Configure rubric + scoring settings and bind to an evidence window.
            </p>
          </div>
          <Button asChild className="mt-4 w-full text-[10px] uppercase tracking-wider">
            <Link href="/editor/experiment">New Experiment</Link>
          </Button>
        </Card>

        <Card className="border-border bg-card/80 p-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              Evidence Window
            </p>
            <p className="mt-1 text-xs opacity-60">
              Define a scraping window and model for evidence collection.
            </p>
          </div>
          <Button asChild className="mt-4 w-full text-[10px] uppercase tracking-wider">
            <Link href="/editor/window">New Window</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
