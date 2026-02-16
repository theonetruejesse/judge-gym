"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { api } from "@judge-gym/engine";
import { CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { MODEL_OPTIONS } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LabNavbar from "@/components/lab_navbar";

const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

const formSchema = z.object({
  concept: z.string().min(1, "Concept is required."),
  country: z.string().min(1, "Country is required."),
  start_date: z.string().min(1, "Start date is required."),
  end_date: z.string().min(1, "End date is required."),
  model_id: z
    .string()
    .min(1, "Evidence model is required.")
    .refine(
      (value) => MODEL_OPTIONS.includes(value as (typeof MODEL_OPTIONS)[number]),
      "Invalid evidence model.",
    ),
  evidence_limit: z
    .coerce
    .number({ invalid_type_error: "Starting count is required." })
    .int("Starting count must be a whole number.")
    .min(1, "Starting count must be at least 1."),
});

type FormValues = z.infer<typeof formSchema>;

function parseNumberParam(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function EvidenceWindowEditorPage() {
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
  const router = useRouter();
  const initEvidenceWindowAndCollect = useAction(
    api.lab.initEvidenceWindowAndCollect,
  );

  const [windowStatus, setWindowStatus] = useState<string | null>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const initializedRef = useRef(false);

  const form = useForm<FormValues>({
    defaultValues: {
      evidence_limit: 15,
    },
  });

  useEffect(() => {
    if (initializedRef.current) return;
    const values = form.getValues();
    const concept = searchParams.get("concept");
    const country = searchParams.get("country");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const modelId = searchParams.get("model_id");
    const evidenceLimit = parseNumberParam(searchParams.get("evidence_limit"));

    form.reset({
      ...values,
      concept: concept ?? values.concept,
      country: country ?? values.country,
      start_date: startDate ?? values.start_date,
      end_date: endDate ?? values.end_date,
      model_id: modelId ?? values.model_id,
      evidence_limit: evidenceLimit ?? values.evidence_limit,
    });

    initializedRef.current = true;
  }, [form, searchParams]);

  const watchedValues = form.watch();

  useEffect(() => {
    if (!initializedRef.current) return;
    const params = new URLSearchParams();
    if (watchedValues.concept) params.set("concept", watchedValues.concept);
    if (watchedValues.country) params.set("country", watchedValues.country);
    if (watchedValues.start_date) params.set("start_date", watchedValues.start_date);
    if (watchedValues.end_date) params.set("end_date", watchedValues.end_date);
    if (watchedValues.model_id) params.set("model_id", watchedValues.model_id);
    if (Number.isFinite(watchedValues.evidence_limit)) {
      params.set("evidence_limit", String(watchedValues.evidence_limit));
    }

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `/editor/window?${next}` : "/editor/window", {
        scroll: false,
      });
    }
  }, [watchedValues, router, searchParams]);

  const handleCreateWindow = async (values: FormValues) => {
    setWindowStatus(null);
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
      const { evidence_limit, ...evidence_window } = parsed.data;
      const result = await initEvidenceWindowAndCollect({
        evidence_window,
        evidence_limit,
      });
      setWindowStatus(
        result.reused_window
          ? `Reused existing window. Collected ${result.collected}.`
          : `Created new window. Collected ${result.collected}.`,
      );
      router.push("/");
    } catch (error) {
      setWindowStatus(
        error instanceof Error ? error.message : "Failed to create window.",
      );
    }
  };

  const parseDateValue = (value?: string) => {
    if (!value) return undefined;
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  const startDateValue = form.watch("start_date");
  const endDateValue = form.watch("end_date");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabNavbar />

      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
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

        <div className="grid gap-6">
          <Card className="border-border bg-card/80 p-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                Evidence Window
              </p>
              <p className="mt-1 text-xs opacity-60">
                Define the evidence time window, starting count, and scraping model.
              </p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateWindow)}
                className="mt-6 grid gap-4"
              >
                <FormField
                  control={form.control}
                  name="concept"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Concept</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value || "Pick a date"}
                                <CalendarIcon className="h-4 w-4 opacity-60" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto border-border bg-card p-0 text-foreground shadow-md"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={parseDateValue(field.value)}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                                setStartDateOpen(false);
                                const currentEnd = parseDateValue(endDateValue);
                                if (date && currentEnd && currentEnd < date) {
                                  form.setValue("end_date", "");
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value || "Pick a date"}
                                <CalendarIcon className="h-4 w-4 opacity-60" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto border-border bg-card p-0 text-foreground shadow-md"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={parseDateValue(field.value)}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                                setEndDateOpen(false);
                              }}
                              disabled={(date) => {
                                const start = parseDateValue(startDateValue);
                                return Boolean(start && date < start);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="model_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Evidence Model</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
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
                  name="evidence_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starting Count</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          step={1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" className="text-[10px] uppercase tracking-wider">
                    Create Window & Collect
                  </Button>
                  {windowStatus && (
                    <span className="text-[10px] uppercase tracking-wider opacity-60">
                      {windowStatus}
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
