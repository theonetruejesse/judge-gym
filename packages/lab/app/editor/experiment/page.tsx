"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { api } from "@judge-gym/engine";
import {
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LabNavbar from "@/components/lab_navbar";

const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

type EvidenceWindowItem = {
  window_id: string;
  start_date: string;
  end_date: string;
  country: string;
  concept: string;
  model_id: string;
  window_tag?: string;
};

const formSchema = z.object({
  task_type: z.enum(["ecc", "control", "benchmark"]),
  rubric_model_id: z.string().min(1, "Rubric model is required."),
  scoring_model_id: z.string().min(1, "Scoring model is required."),
  scale_size: z.coerce.number().int().min(3).max(5),
  method: z.enum(["single", "subset"]),
  sample_count: z.coerce.number().int().min(1, "Sample count must be at least 1."),
  evidence_cap: z.coerce.number().int().min(1, "Evidence cap must be at least 1."),
  evidence_view: z.enum(["l0_raw", "l1_cleaned", "l2_neutralized", "l3_abstracted"]),
  abstain_enabled: z.boolean(),
  randomizations: z.array(z.enum(["anonymize_labels", "shuffle_rubric_order", "hide_label_text"])),
});

type FormValues = z.infer<typeof formSchema>;

export default function ExperimentEditorPage() {
  if (!hasConvex) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <LabNavbar />
        <div className="px-6 py-12">
          <p className="text-sm">Missing `NEXT_PUBLIC_CONVEX_URL`.</p>
          <p className="mt-2 text-xs opacity-60">
            Set the Convex URL to enable the editor.
          </p>
        </div>
      </div>
    );
  }

  const searchParams = useSearchParams();
  const cloneId = searchParams.get("clone_id");

  const windows = useQuery(
    api.lab.listEvidenceWindows,
    {},
  ) as EvidenceWindowItem[] | undefined;
  const initExperiment = useMutation(api.lab.initExperiment);
  const cloneExperiment = useQuery(
    api.lab.getExperimentSummary,
    cloneId ? { experiment_id: cloneId } : "skip",
  );

  const [selectedWindowId, setSelectedWindowId] = useState<string>("");
  const [experimentStatus, setExperimentStatus] = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      abstain_enabled: false,
      randomizations: [],
    },
  });

  useEffect(() => {
    if (!selectedWindowId && windows && windows.length > 0) {
      setSelectedWindowId(windows[0].window_id);
    }
  }, [windows, selectedWindowId]);

  useEffect(() => {
    if (!cloneExperiment) return;
    const config = cloneExperiment.config;
    form.reset({
      task_type: cloneExperiment.task_type,
      rubric_model_id: config.rubric_stage.model_id,
      scoring_model_id: config.scoring_stage.model_id,
      scale_size: config.rubric_stage.scale_size,
      method: config.scoring_stage.method,
      sample_count: config.scoring_stage.sample_count,
      evidence_cap: config.scoring_stage.evidence_cap,
      evidence_view: config.scoring_stage.evidence_view,
      abstain_enabled: config.scoring_stage.abstain_enabled,
      randomizations: config.scoring_stage.randomizations,
    });
    setSelectedWindowId(cloneExperiment.window_id);
  }, [cloneExperiment, form]);

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
              sample_count: parsed.data.sample_count,
              evidence_cap: parsed.data.evidence_cap,
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
                Select the evidence window to bind with this experiment.
              </p>
            </div>
            <Select value={selectedWindowId} onValueChange={setSelectedWindowId}>
              <SelectTrigger className="mt-4">
                <SelectValue placeholder="Select window" />
              </SelectTrigger>
              <SelectContent>
                {windows?.map((window) => (
                  <SelectItem key={window.window_id} value={window.window_id}>
                    {window.window_tag ?? window.concept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card className="border-border bg-card/80 p-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Experiment
              </p>
              <p className="mt-1 text-xs opacity-60">
                Configure rubric + scoring stages and bind to an evidence window.
              </p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateExperiment)}
                className="mt-6 grid gap-5"
              >
                <FormField
                  control={form.control}
                  name="task_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select task" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="rubric_model_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rubric Model</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scale_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scale Size</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ? String(field.value) : ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select scale" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[3, 4, 5].map((value) => (
                              <SelectItem key={value} value={String(value)}>
                                {value}
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
                    name="scoring_model_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scoring Model</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>Scoring Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SCORING_METHOD_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
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
                    name="sample_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sample Count</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="evidence_cap"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Evidence Cap</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
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
                        <FormLabel>Evidence View</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select view" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(VIEW_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
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
                    name="abstain_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border border-border p-3">
                        <FormControl>
                          <Checkbox
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm">Abstain Enabled</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="randomizations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Randomizations</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {randomizationOptions.map(([value, label]) => {
                          const active = field.value.includes(value as FormValues["randomizations"][number]);
                          return (
                            <Button
                              key={value}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-[10px] uppercase tracking-wider"
                              style={{
                                backgroundColor: active ? "#ff6b3530" : "#151a24",
                                color: active ? "#ff6b35" : "#7a8599",
                                borderColor: active ? "#ff6b3550" : "#1e2433",
                              }}
                              onClick={() => {
                                const next = active
                                  ? field.value.filter((item) => item !== value)
                                  : [...field.value, value as FormValues["randomizations"][number]];
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
                  <Button type="submit" className="text-[10px] uppercase tracking-wider">
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
