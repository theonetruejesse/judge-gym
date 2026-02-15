"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@judge-gym/engine";

const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

type EvidenceWindowItem = {
  window_id: string;
  start_date: string;
  end_date: string;
  country: string;
  concept: string;
  model_id: string;
};

const DEFAULT_WINDOW = {
  concept: "",
  country: "USA",
  start_date: "",
  end_date: "",
  model_id: "gpt-4.1",
};

export default function EvidenceWindowEditorPage() {
  if (!hasConvex) {
    return (
      <div
        className="min-h-screen px-6 py-12"
        style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
      >
        <p className="text-sm">Missing `NEXT_PUBLIC_CONVEX_URL`.</p>
        <p className="mt-2 text-xs opacity-60">
          Set the Convex URL to enable the editor.
        </p>
        <Link href="/" className="mt-4 inline-block text-xs">
          Back to judge-gym
        </Link>
      </div>
    );
  }

  const windows = useQuery(
    api.lab.listEvidenceWindows,
    {},
  ) as EvidenceWindowItem[] | undefined;
  const initEvidenceWindow = useMutation(api.lab.initEvidenceWindow);

  const [windowForm, setWindowForm] = useState(DEFAULT_WINDOW);
  const [selectedWindowId, setSelectedWindowId] = useState<string>("");
  const [windowStatus, setWindowStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWindowId && windows && windows.length > 0) {
      setSelectedWindowId(windows[0].window_id);
    }
  }, [windows, selectedWindowId]);

  const handleCreateWindow = async () => {
    setWindowStatus(null);
    if (
      !windowForm.concept ||
      !windowForm.country ||
      !windowForm.start_date ||
      !windowForm.end_date
    ) {
      setWindowStatus("Fill all evidence window fields.");
      return;
    }
    try {
      const result = await initEvidenceWindow({
        evidence_window: windowForm,
      });
      setSelectedWindowId(result.window_id);
      setWindowStatus(
        result.reused_window ? "Reused existing window." : "Created new window.",
      );
    } catch (error) {
      setWindowStatus(
        error instanceof Error ? error.message : "Failed to create window.",
      );
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0f1219", color: "#c8ccd4" }}
    >
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Evidence Window Editor
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            Create Evidence Window
          </h1>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href="/" className="hover:text-[#ff6b35]">
            Back to judge-gym
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-8">
        <section
          className="grid gap-5 rounded border p-6"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              Evidence Window
            </p>
            <p className="mt-1 text-xs opacity-60">
              Define the evidence time window and scraping model.
            </p>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-2 text-xs">
              Concept
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={windowForm.concept}
                onChange={(event) =>
                  setWindowForm((prev) => ({
                    ...prev,
                    concept: event.target.value,
                  }))
                }
                placeholder="fascism"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Country
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={windowForm.country}
                onChange={(event) =>
                  setWindowForm((prev) => ({
                    ...prev,
                    country: event.target.value,
                  }))
                }
                placeholder="USA"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-xs">
                Start Date
                <input
                  type="date"
                  className="rounded border px-3 py-2 text-sm"
                  style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                  value={windowForm.start_date}
                  onChange={(event) =>
                    setWindowForm((prev) => ({
                      ...prev,
                      start_date: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-2 text-xs">
                End Date
                <input
                  type="date"
                  className="rounded border px-3 py-2 text-sm"
                  style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                  value={windowForm.end_date}
                  onChange={(event) =>
                    setWindowForm((prev) => ({
                      ...prev,
                      end_date: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-2 text-xs">
              Evidence Model
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={windowForm.model_id}
                onChange={(event) =>
                  setWindowForm((prev) => ({
                    ...prev,
                    model_id: event.target.value,
                  }))
                }
                placeholder="gpt-4.1"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreateWindow}
              className="rounded px-4 py-2 text-[10px] uppercase tracking-wider"
              style={{ backgroundColor: "#ff6b35", color: "#0b0e14" }}
            >
              Create Window
            </button>
            {windowStatus && (
              <span className="text-[10px] uppercase tracking-wider opacity-60">
                {windowStatus}
              </span>
            )}
          </div>

          <div className="grid gap-2 text-[11px] opacity-60">
            <span className="uppercase tracking-widest opacity-40">
              Existing Windows
            </span>
            <select
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
              value={selectedWindowId}
              onChange={(event) => setSelectedWindowId(event.target.value)}
            >
              {windows?.map((window) => (
                <option key={window.window_id} value={window.window_id}>
                  {window.concept} · {window.country} · {window.start_date}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>
    </div>
  );
}
