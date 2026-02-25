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
  VIEW_LABELS,
} from "@/lib/ui-maps";
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
  query: string;
  model: string;
  window_tag?: string;
};

type EvidenceItem = {
  evidence_id: string;
  title: string;
  url: string;
  created_at: number;
};

const formSchema = z.object({
  concept: z.string().min(1, "Concept is required."),
  rubric_model: z
    .string()
    .min(1, "Rubric model is required.")
    .refine(
      (value) =>
        MODEL_OPTIONS.includes(value as (typeof MODEL_OPTIONS)[number]),
      "Invalid rubric model.",
    ),
  scoring_model: z
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
    z.enum(["anonymize_stages", "shuffle_rubric_order", "hide_label_text"]),
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
  const initExperiment = useMutation(api.packages.lab.initExperiment);

  const form = useForm<FormValues>({
    defaultValues: {
      concept: "",
      rubric_model: "",
      scoring_model: "",
      evidence_view: "l0_raw",
      abstain_enabled: false,
      randomizations: [],
      method: "single",
      scale_size: 5,
    },
  });

  useEffect(() => {
    if (initializedRef.current) return;
    const values = form.getValues();
    const concept = searchParams.get("concept");
    const rubricModel = searchParams.get("rubric_model");
    const scoringModel = searchParams.get("scoring_model");
    const scaleSize = parseNumberParam(searchParams.get("scale_size"));
    const methodParam = searchParams.get("method");
    const evidenceViewParam = searchParams.get("evidence_view");
    const abstainEnabled = parseBooleanParam(searchParams.get("abstain_enabled"));
    const randomizationsRaw = searchParams.get("randomizations");
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
            [
              "anonymize_stages",
              "shuffle_rubric_order",
              "hide_label_text",
            ].includes(item),
          ) as FormValues["randomizations"]
      : undefined;
    const windowId = searchParams.get("window_id");

    form.reset({
      ...values,
      concept: concept ?? values.concept,
      rubric_model: rubricModel ?? values.rubric_model,
      scoring_model: scoringModel ?? values.scoring_model,
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
    const newIds = evidenceItems.map((item) => item.evidence_id);
    setSelectedEvidenceIds((prev) => {
      const merged = new Set(prev);
      for (const id of newIds) merged.add(id);
      return Array.from(merged);
    });
  }, [selectedWindowId, evidenceItems]);

  const handleWindowChange = (value: string) => {
    if (value === createWindowValue) {
      router.push("/editor/window");
      return;
    }
    setSelectedWindowId(value);
  };

  const evidenceRows = evidenceItems ?? [];

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

  const onSubmit = async (values: FormValues) => {
    setExperimentStatus(null);
    if (selectedEvidenceIds.length === 0) {
      setExperimentStatus("Select at least one evidence item.");
      return;
    }

    try {
      const result = await initExperiment({
        experiment_config: {
          rubric_config: {
            model: values.rubric_model,
            scale_size: values.scale_size,
            concept: values.concept,
          },
          scoring_config: {
            model: values.scoring_model,
            method: values.method,
            abstain_enabled: values.abstain_enabled,
            evidence_view: values.evidence_view,
            randomizations: values.randomizations,
          },
        },
        evidence_ids: selectedEvidenceIds,
      });
      setExperimentStatus("Experiment created.");
      router.replace(`/experiment/${result.experiment_id}`);
    } catch (error) {
      setExperimentStatus(
        error instanceof Error ? error.message : "Failed to create experiment.",
      );
    }
  };

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
          <Card className="border-border bg-card/80 p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="concept"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Experiment concept"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="rubric_model"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Rubric model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MODEL_OPTIONS.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
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
                    name="scoring_model"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Scoring model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MODEL_OPTIONS.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
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
                    name="scale_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
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
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Scoring method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SCORING_METHOD_LABELS).map(
                              ([key, label]) => (
                                <SelectItem key={key} value={key}>
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
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Evidence view" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(VIEW_LABELS).map(
                              ([key, label]) => (
                                <SelectItem key={key} value={key}>
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
                      <FormItem className="flex h-10 items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <span className="text-xs">Abstain enabled</span>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-widest opacity-50">
                    Randomizations
                  </p>
                  <div className="grid gap-2">
                    {Object.entries(RANDOMIZATION_LABELS).map(
                      ([key, label]) => (
                        <FormField
                          key={key}
                          control={form.control}
                          name="randomizations"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value.includes(
                                    key as FormValues["randomizations"][number],
                                  )}
                                  onCheckedChange={(checked) => {
                                    const value =
                                      key as FormValues["randomizations"][number];
                                    if (checked) {
                                      field.onChange([...field.value, value]);
                                    } else {
                                      field.onChange(
                                        field.value.filter((item) => item !== value),
                                      );
                                    }
                                  }}
                                />
                              </FormControl>
                              <span className="text-xs">{label}</span>
                            </FormItem>
                          )}
                        />
                      ),
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full text-[10px] uppercase tracking-wider">
                  Create Experiment
                </Button>
                {experimentStatus && (
                  <div className="text-[10px] uppercase tracking-wider opacity-60">
                    {experimentStatus}
                  </div>
                )}
              </form>
            </Form>
          </Card>

          <Card className="border-border bg-card/80 p-6">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-50">
                  Evidence Selection
                </p>
                <p className="text-xs opacity-60">
                  Select evidence across any windows. Total selected: {selectedEvidenceIds.length}
                </p>
              </div>

              <Select value={selectedWindowId} onValueChange={handleWindowChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select evidence window" />
                </SelectTrigger>
                <SelectContent>
                  {(windows ?? []).map((window) => (
                    <SelectItem key={window.window_id} value={window.window_id}>
                      {window.window_tag ?? window.query}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={createWindowValue}>Create new window</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={selectWindowEvidence}
                  className="text-[10px] uppercase tracking-wider"
                >
                  Select Window
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={clearWindowEvidence}
                  className="text-[10px] uppercase tracking-wider"
                >
                  Clear Window
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={clearAllEvidence}
                  className="text-[10px] uppercase tracking-wider"
                >
                  Clear All
                </Button>
              </div>

              <div className="max-h-[420px] overflow-y-auto rounded border border-border">
                <table className="w-full text-xs">
                  <tbody>
                    {sortedEvidence.map((item) => {
                      const selected = selectedEvidenceIds.includes(item.evidence_id);
                      return (
                        <tr
                          key={item.evidence_id}
                          className="border-b border-border last:border-b-0"
                        >
                          <td className="w-10 px-3 py-2">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleEvidence(item.evidence_id)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-foreground">{item.title}</div>
                            <div className="text-[10px] opacity-50">{item.url}</div>
                          </td>
                        </tr>
                      );
                    })}
                    {sortedEvidence.length === 0 && (
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
          </Card>
        </div>
      </div>
    </div>
  );
}
