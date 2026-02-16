"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { api } from "@judge-gym/engine";
import {
  MODEL_OPTIONS,
  RANDOMIZATION_LABELS,
  SCORING_METHOD_LABELS,
  TASK_TYPE_LABELS,
  VIEW_LABELS,
} from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LabNavbar from "@/components/lab_navbar";

type EvidenceWindowItem = {
  window_id: string;
  start_date: string;
  end_date: string;
  country: string;
  concept: string;
  model_id: string;
  window_tag?: string;
};

type EvidenceItem = {
  evidence_id: string;
  title: string;
  url: string;
  created_at: number;
};

const formSchema = z.object({
  task_type: z.enum(["ecc", "control", "benchmark"]),
  rubric_model_id: z
    .string()
    .min(1, "Rubric model is required.")
    .refine(
      (value) =>
        MODEL_OPTIONS.includes(value as (typeof MODEL_OPTIONS)[number]),
      "Invalid rubric model.",
    ),
  scoring_model_id: z
    .string()
    .min(1, "Scoring model is required.")
    .refine(
      (value) =>
        MODEL_OPTIONS.includes(value as (typeof MODEL_OPTIONS)[number]),
      "Invalid scoring model.",
    ),
  scale_size: z.coerce.number().int().min(1),
  method: z.enum(["single", "subset"]),
  evidence_view: z.enum([
    "l0_raw",
    "l1_cleaned",
    "l2_neutralized",
    "l3_abstracted",
  ]),
  abstain_enabled: z.boolean(),
  randomizations: z.array(
    z.enum(["anonymize_labels", "shuffle_rubric_order", "hide_label_text"]),
  ),
});

type FormValues = z.infer<typeof formSchema>;

function parseBooleanParam(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseNumberParam(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function ExperimentEditorPage() {
  return <ExperimentEditorWithConvex />;
}

function ExperimentEditorWithConvex() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const windows = useQuery(api.lab.listEvidenceWindows, {}) as
    | EvidenceWindowItem[]
    | undefined;
  const [selectedWindowId, setSelectedWindowId] = useState<string>("");
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [experimentStatus, setExperimentStatus] = useState<string | null>(null);
  const createWindowValue = "__create_window__";
  const initializedRef = useRef(false);
  const evidenceItems = useQuery(
    api.lab.listEvidenceByWindow,
    selectedWindowId ? { window_id: selectedWindowId } : "skip",
  ) as EvidenceItem[] | undefined;
  const initExperiment = useMutation(api.lab.initExperiment);

  const form = useForm<FormValues>({
    defaultValues: {
      abstain_enabled: false,
      randomizations: [],
    },
  });

  useEffect(() => {
    if (initializedRef.current) return;
    const values = form.getValues();
    const taskTypeParam = searchParams.get("task_type");
    const rubricModel = searchParams.get("rubric_model_id");
    const scoringModel = searchParams.get("scoring_model_id");
    const scaleSize = parseNumberParam(searchParams.get("scale_size"));
    const methodParam = searchParams.get("method");
    const evidenceViewParam = searchParams.get("evidence_view");
    const abstainEnabled = parseBooleanParam(searchParams.get("abstain_enabled"));
    const randomizationsRaw = searchParams.get("randomizations");
    const taskType = ["ecc", "control", "benchmark"].includes(taskTypeParam ?? "")
      ? (taskTypeParam as FormValues["task_type"])
      : undefined;
    const method = ["single", "subset"].includes(methodParam ?? "")
      ? (methodParam as FormValues["method"])
      : undefined;
    const evidenceView = [
      "l0_raw",
      "l1_cleaned",
      "l2_neutralized",
      "l3_abstracted",
    ].includes(evidenceViewParam ?? "")
      ? (evidenceViewParam as FormValues["evidence_view"])
      : undefined;
    const randomizations = randomizationsRaw
      ? randomizationsRaw
          .split(",")
          .map((item) => item.trim())
          .filter((item) =>
            ["anonymize_labels", "shuffle_rubric_order", "hide_label_text"].includes(item),
          ) as FormValues["randomizations"]
      : undefined;
    const windowId = searchParams.get("window_id");

    form.reset({
      ...values,
      task_type: taskType ?? values.task_type,
      rubric_model_id: rubricModel ?? values.rubric_model_id,
      scoring_model_id: scoringModel ?? values.scoring_model_id,
      scale_size: scaleSize ?? values.scale_size,
      method: method ?? values.method,
      evidence_view: evidenceView ?? values.evidence_view,
      abstain_enabled: abstainEnabled ?? values.abstain_enabled,
      randomizations: randomizations ?? values.randomizations,
    });

    if (windowId) {
      setSelectedWindowId(windowId);
    }

    initializedRef.current = true;
  }, [form, searchParams]);

  useEffect(() => {
    if (!selectedWindowId && windows && windows.length > 0) {
      setSelectedWindowId(windows[0].window_id);
    }
  }, [windows, selectedWindowId]);

  useEffect(() => {
    if (!selectedWindowId || !evidenceItems) return;
    setSelectedEvidenceIds(evidenceItems.map((item) => item.evidence_id));
  }, [selectedWindowId, evidenceItems]);

  const handleWindowChange = (value: string) => {
    if (value === createWindowValue) {
      router.push("/editor/window");
      return;
    }
    setSelectedWindowId(value);
  };

  const watchedValues = form.watch();

  useEffect(() => {
    if (!initializedRef.current) return;
    const params = new URLSearchParams();
    if (watchedValues.task_type) params.set("task_type", watchedValues.task_type);
    if (watchedValues.rubric_model_id) {
      params.set("rubric_model_id", watchedValues.rubric_model_id);
    }
    if (watchedValues.scoring_model_id) {
      params.set("scoring_model_id", watchedValues.scoring_model_id);
    }
    if (Number.isFinite(watchedValues.scale_size)) {
      params.set("scale_size", String(watchedValues.scale_size));
    }
    if (watchedValues.method) params.set("method", watchedValues.method);
    if (watchedValues.evidence_view) {
      params.set("evidence_view", watchedValues.evidence_view);
    }
    if (typeof watchedValues.abstain_enabled === "boolean") {
      params.set("abstain_enabled", watchedValues.abstain_enabled ? "true" : "false");
    }
    if (watchedValues.randomizations && watchedValues.randomizations.length > 0) {
      params.set(
        "randomizations",
        watchedValues.randomizations.slice().sort().join(","),
      );
    }
    if (selectedWindowId) {
      params.set("window_id", selectedWindowId);
    }

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `/editor/experiment?${next}` : "/editor/experiment", {
        scroll: false,
      });
    }
  }, [watchedValues, selectedWindowId, router, searchParams]);

  const randomizationOptions = useMemo(
    () => Object.entries(RANDOMIZATION_LABELS),
    [],
  );

  const handleCreateExperiment = async (values: FormValues) => {
    setExperimentStatus(null);
    if (!selectedWindowId) {
      setExperimentStatus("Select an evidence window first.");
      return;
    }
    if (selectedEvidenceIds.length === 0) {
      setExperimentStatus("Select at least one evidence item.");
      return;
    }
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string") {
          form.setError(field as keyof FormValues, {
            type: "manual",
            message: issue.message,
          });
        }
      });
      return;
    }
    try {
      await initExperiment({
        window_id: selectedWindowId,
        evidence_ids: selectedEvidenceIds,
        experiment: {
          task_type: parsed.data.task_type,
          config: {
            rubric_stage: {
              scale_size: parsed.data.scale_size,
              model_id: parsed.data.rubric_model_id,
            },
            scoring_stage: {
              model_id: parsed.data.scoring_model_id,
              method: parsed.data.method,
              randomizations: parsed.data.randomizations,
              evidence_view: parsed.data.evidence_view,
              abstain_enabled: parsed.data.abstain_enabled,
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
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Experiment Editor
          </p>
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-1-serif)", color: "#ff6b35" }}
          >
            Create Experiment
          </h1>
        </div>

        <div className="grid gap-6">
          <Card className="border-border bg-card/80 p-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Window
              </p>
              <p className="mt-1 text-xs opacity-60">
                Select the evidence window for this experiment.
              </p>
            </div>
            <Select value={selectedWindowId} onValueChange={handleWindowChange}>
              <SelectTrigger className="mt-4">
                <SelectValue placeholder="Select window" />
              </SelectTrigger>
              <SelectContent>
                {windows?.map((window) => (
                  <SelectItem key={window.window_id} value={window.window_id}>
                    {window.window_tag ?? window.concept}
                  </SelectItem>
                ))}
                {windows && windows.length > 0 ? <SelectSeparator /> : null}
                <SelectItem value={createWindowValue}>
                  Create new window
                </SelectItem>
              </SelectContent>
            </Select>
          </Card>

          <Card className="border-border bg-card/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-50">
                  Evidence Selection
                </p>
                <p className="mt-1 text-xs opacity-60">
                  Choose the evidence items to freeze into this experiment.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-2 text-[10px] uppercase tracking-wider"
                  onClick={() =>
                    setSelectedEvidenceIds(
                      (evidenceItems ?? []).map((item) => item.evidence_id),
                    )
                  }
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-2 text-[10px] uppercase tracking-wider"
                  onClick={() => setSelectedEvidenceIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="mt-4 max-h-72 overflow-auto rounded border border-border">
              <table className="w-full table-fixed">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2 text-left">Use</th>
                    <th className="px-3 py-2 text-left">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {(evidenceItems ?? []).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-3 text-xs opacity-60">
                        {selectedWindowId
                          ? "No evidence collected for this window."
                          : "Select a window to see evidence."}
                      </td>
                    </tr>
                  )}
                  {(evidenceItems ?? []).map((item) => {
                    const checked = selectedEvidenceIds.includes(
                      item.evidence_id,
                    );
                    return (
                      <tr
                        key={item.evidence_id}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const next = Boolean(value);
                              setSelectedEvidenceIds((prev) =>
                                next
                                  ? prev.includes(item.evidence_id)
                                    ? prev
                                    : [...prev, item.evidence_id]
                                  : prev.filter(
                                      (id) => id !== item.evidence_id,
                                    ),
                              );
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="line-clamp-2">{item.title}</div>
                          <div className="text-[10px] opacity-50">
                            {item.url}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest opacity-50">
              Selected: {selectedEvidenceIds.length}
            </p>
          </Card>

          <Card className="border-border bg-card/80 p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateExperiment)}
                className="grid gap-5"
              >
                <FormField
                  control={form.control}
                  name="task_type"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Task type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TASK_TYPE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <h3 className="text-xs uppercase tracking-widest opacity-50">
                  Rubric Stage
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="rubric_model_id"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Rubric model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MODEL_OPTIONS.map((modelId) => (
                              <SelectItem key={modelId} value={modelId}>
                                {modelId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scale_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            placeholder="Scale size"
                            value={field.value ?? ""}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h3 className="pt-2 text-xs uppercase tracking-widest opacity-50">
                  Scoring Stage
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="scoring_model_id"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Scoring model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MODEL_OPTIONS.map((modelId) => (
                              <SelectItem key={modelId} value={modelId}>
                                {modelId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Scoring method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SCORING_METHOD_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="evidence_view"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Evidence view" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(VIEW_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="abstain_enabled"
                    render={({ field }) => (
                      <FormItem className="flex h-10 flex-row items-center gap-3 space-y-0 rounded-md border border-border px-3">
                        <FormControl>
                          <Checkbox
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <span className="text-sm">Abstain Enabled</span>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="randomizations"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border border-border p-3">
                      <span className="text-sm">Randomizations</span>
                      <div className="flex flex-wrap gap-2">
                        {randomizationOptions.map(([value, label]) => {
                          const active = field.value.includes(
                            value as FormValues["randomizations"][number],
                          );
                          return (
                            <Button
                              key={value}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-[10px] uppercase tracking-wider"
                              style={{
                                backgroundColor: active
                                  ? "#ff6b3530"
                                  : "#151a24",
                                color: active ? "#ff6b35" : "#7a8599",
                                borderColor: active ? "#ff6b3550" : "#1e2433",
                              }}
                              onClick={() => {
                                const next = active
                                  ? field.value.filter((item) => item !== value)
                                  : [
                                      ...field.value,
                                      value as FormValues["randomizations"][number],
                                    ];
                                field.onChange(next);
                              }}
                            >
                              {label}
                            </Button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    className="text-[10px] uppercase tracking-wider"
                  >
                    Save Experiment
                  </Button>
                  {experimentStatus && (
                    <span className="text-[10px] uppercase tracking-wider opacity-60">
                      {experimentStatus}
                    </span>
                  )}
                </div>
              </form>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
}
