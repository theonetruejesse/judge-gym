"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@judge-gym/engine";
import {
  RANDOMIZATION_LABELS,
  SCORING_METHOD_LABELS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
} from "@/lib/ui";

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

const DEFAULT_EXPERIMENT = {
  experiment_tag: "",
  task_type: "ecc",
  rubric_model_id: "gpt-4.1",
  scoring_model_id: "gpt-4.1",
  scale_size: 4,
  method: "subset",
  sample_count: 10,
  evidence_cap: 10,
  evidence_view: "l2_neutralized",
  abstain_enabled: true,
  randomizations: ["anonymize_labels", "shuffle_rubric_order"],
};

export default function RouteOneEditorPage() {
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
      </div>
    );
  }

  const windows = useQuery(
    api.lab.listEvidenceWindows,
    {},
  ) as EvidenceWindowItem[] | undefined;
  const initEvidenceWindow = useMutation(api.lab.initEvidenceWindow);
  const initExperiment = useMutation(api.lab.initExperiment);

  const [windowForm, setWindowForm] = useState(DEFAULT_WINDOW);
  const [experimentForm, setExperimentForm] = useState(DEFAULT_EXPERIMENT);
  const [selectedWindowId, setSelectedWindowId] = useState<string>("");
  const [windowStatus, setWindowStatus] = useState<string | null>(null);
  const [experimentStatus, setExperimentStatus] = useState<string | null>(null);

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

  const handleCreateExperiment = async () => {
    setExperimentStatus(null);
    if (!selectedWindowId) {
      setExperimentStatus("Select an evidence window first.");
      return;
    }
    if (!experimentForm.experiment_tag) {
      setExperimentStatus("Experiment tag is required.");
      return;
    }
    try {
      await initExperiment({
        window_id: selectedWindowId,
        experiment: {
          experiment_tag: experimentForm.experiment_tag,
          task_type: experimentForm.task_type as "ecc" | "control" | "benchmark",
          config: {
            rubric_stage: {
              scale_size: experimentForm.scale_size,
              model_id: experimentForm.rubric_model_id,
            },
            scoring_stage: {
              model_id: experimentForm.scoring_model_id,
              method: experimentForm.method as "single" | "subset",
              sample_count: experimentForm.sample_count,
              evidence_cap: experimentForm.evidence_cap,
              randomizations: experimentForm.randomizations as Array<
                "anonymize_labels" | "shuffle_rubric_order" | "hide_label_text"
              >,
              evidence_view: experimentForm.evidence_view as
                | "l0_raw"
                | "l1_cleaned"
                | "l2_neutralized"
                | "l3_abstracted",
              abstain_enabled: experimentForm.abstain_enabled,
            },
          },
        },
      });
      setExperimentStatus("Experiment created.");
    } catch (error) {
      setExperimentStatus(
        error instanceof Error ? error.message : "Failed to create experiment.",
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
            Experiment Editor
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            Create Evidence Window + Experiment
          </h1>
        </div>
        <div className="flex items-center gap-3 text-[11px] opacity-60">
          <Link href="/">Back</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[1fr_1fr]">
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

        <section
          className="grid gap-5 rounded border p-6"
          style={{ borderColor: "#1e2433", backgroundColor: "#0b0e1499" }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              Experiment
            </p>
            <p className="mt-1 text-xs opacity-60">
              Configure rubric + scoring stages and bind to an evidence window.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              Tag
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.experiment_tag}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    experiment_tag: event.target.value,
                  }))
                }
                placeholder="ecc-fascism-jan"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Task Type
              <select
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.task_type}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    task_type: event.target.value,
                  }))
                }
              >
                {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              Rubric Model
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.rubric_model_id}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    rubric_model_id: event.target.value,
                  }))
                }
                placeholder="gpt-4.1"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Scale Size
              <select
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.scale_size}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    scale_size: Number(event.target.value),
                  }))
                }
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              Scoring Model
              <input
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.scoring_model_id}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    scoring_model_id: event.target.value,
                  }))
                }
                placeholder="gpt-4.1"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Scoring Method
              <select
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.method}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    method: event.target.value,
                  }))
                }
              >
                {Object.entries(SCORING_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              Sample Count
              <input
                type="number"
                min={1}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.sample_count}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    sample_count: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="grid gap-2 text-xs">
              Evidence Cap
              <input
                type="number"
                min={1}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.evidence_cap}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    evidence_cap: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              Evidence View
              <select
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "#1e2433", backgroundColor: "#0b0e14" }}
                value={experimentForm.evidence_view}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    evidence_view: event.target.value,
                  }))
                }
              >
                {Object.entries(VIEW_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={experimentForm.abstain_enabled}
                onChange={(event) =>
                  setExperimentForm((prev) => ({
                    ...prev,
                    abstain_enabled: event.target.checked,
                  }))
                }
              />
              Abstain Enabled
            </label>
          </div>

          <div className="grid gap-2 text-xs">
            <span className="uppercase tracking-widest opacity-50">
              Randomizations
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(RANDOMIZATION_LABELS).map(([value, label]) => {
                const active = experimentForm.randomizations.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setExperimentForm((prev) => ({
                        ...prev,
                        randomizations: active
                          ? prev.randomizations.filter((item) => item !== value)
                          : [...prev.randomizations, value],
                      }))
                    }
                    className="rounded px-2 py-1 text-[10px] uppercase tracking-wider"
                    style={{
                      backgroundColor: active ? "#ff6b3530" : "#151a24",
                      color: active ? "#ff6b35" : "#7a8599",
                      border: `1px solid ${active ? "#ff6b3550" : "#1e2433"}`,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreateExperiment}
              className="rounded px-4 py-2 text-[10px] uppercase tracking-wider"
              style={{ backgroundColor: "#ff6b35", color: "#0b0e14" }}
            >
              Save Experiment
            </button>
            {experimentStatus && (
              <span className="text-[10px] uppercase tracking-wider opacity-60">
                {experimentStatus}
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
