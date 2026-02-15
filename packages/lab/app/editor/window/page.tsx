"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { api } from "@judge-gym/engine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  window_tag: z.string().optional(),
  concept: z.string().min(1, "Concept is required."),
  country: z.string().min(1, "Country is required."),
  start_date: z.string().min(1, "Start date is required."),
  end_date: z.string().min(1, "End date is required."),
  model_id: z.string().min(1, "Model ID is required."),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_WINDOW: FormValues = {
  window_tag: "",
  concept: "",
  country: "USA",
  start_date: "",
  end_date: "",
  model_id: "gpt-4.1",
};

export default function EvidenceWindowEditorPage() {
  if (!hasConvex) {
    return (
      <div className="min-h-screen px-6 py-12">
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

  const [selectedWindowId, setSelectedWindowId] = useState<string>("");
  const [windowStatus, setWindowStatus] = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: DEFAULT_WINDOW,
  });

  useEffect(() => {
    if (!selectedWindowId && windows && windows.length > 0) {
      setSelectedWindowId(windows[0].window_id);
    }
  }, [windows, selectedWindowId]);

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
      const window_tag = parsed.data.window_tag?.trim() || undefined;
      const result = await initEvidenceWindow({
        evidence_window: {
          ...parsed.data,
          window_tag,
        },
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-card/80 px-6 py-4">
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
        <Card className="border-border bg-card/80 p-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              Evidence Window
            </p>
            <p className="mt-1 text-xs opacity-60">
              Define the evidence time window and scraping model.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleCreateWindow)}
              className="mt-6 grid gap-4"
            >
              <FormField
                control={form.control}
                name="window_tag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Window Tag (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="pilot_fascism_2026_01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="concept"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Concept</FormLabel>
                    <FormControl>
                      <Input placeholder="fascism" {...field} />
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
                      <Input placeholder="USA" {...field} />
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
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
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
                    <FormControl>
                      <Input placeholder="gpt-4.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" className="text-[10px] uppercase tracking-wider">
                  Create Window
                </Button>
                {windowStatus && (
                  <span className="text-[10px] uppercase tracking-wider opacity-60">
                    {windowStatus}
                  </span>
                )}
              </div>
            </form>
          </Form>

          <div className="mt-6 grid gap-2 text-[11px] opacity-60">
            <span className="uppercase tracking-widest opacity-40">
              Existing Windows
            </span>
            <Select value={selectedWindowId} onValueChange={setSelectedWindowId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select window" />
              </SelectTrigger>
              <SelectContent>
                {windows?.map((window) => (
                  <SelectItem key={window.window_id} value={window.window_id}>
                    {window.window_tag ?? window.concept} · {window.country} · {window.start_date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      </div>
    </div>
  );
}
