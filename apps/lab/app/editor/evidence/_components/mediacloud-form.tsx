"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { api } from "@judge-gym/engine-convex";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  universe_tag: string;
  title: string;
  description: string;
  query: string;
  start_date: string;
  end_date: string;
  collection_ids: string;
  source_ids: string;
  page_size: string;
};

const DEFAULT_FORM: FormState = {
  universe_tag: "",
  title: "",
  description: "",
  query: "",
  start_date: "",
  end_date: "",
  collection_ids: "34412234",
  source_ids: "",
  page_size: "10",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseCsvIntegers(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((part) => Number.isInteger(part) && part > 0);
}

function buildDefaults(state: FormState) {
  const title = state.title.trim();
  const query = state.query.trim();
  const universeTag = state.universe_tag.trim() || slugify(title || query || "mediacloud-universe");
  return {
    universeTag,
  };
}

export function MediaCloudForm() {
  const router = useRouter();
  const createEvidenceUniverse = useMutation(api.packages.evidence.createEvidenceUniverse);
  const createAcquisitionSpec = useMutation(api.packages.evidence.createAcquisitionSpec);
  const createAcquisitionRun = useMutation(api.packages.evidence.createAcquisitionRun);
  const startAcquisitionRun = useAction(api.packages.evidence.startAcquisitionRun);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const defaults = useMemo(() => buildDefaults(form), [form]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const query = form.query.trim();
    const title = form.title.trim();
    if (!query || !title || !form.start_date || !form.end_date) {
      toast.error("Query, title, and date range are required.");
      return;
    }

    setSubmitting(true);
    try {
      const collection_ids = parseCsvIntegers(form.collection_ids);
      const source_ids = parseCsvIntegers(form.source_ids);
      const page_size = Math.max(1, Number(form.page_size) || 10);

      const { universe_id } = await createEvidenceUniverse({
        universe_tag: defaults.universeTag,
        kind: "news",
        title,
        description: form.description.trim() || null,
      });

      const { acquisition_spec_id } = await createAcquisitionSpec({
        universe_id,
        spec_tag: `${defaults.universeTag}-mediacloud`,
        discovery_provider: "mediacloud",
        discovery_config_json: JSON.stringify({
          query,
          start_date: form.start_date,
          end_date: form.end_date,
          collection_ids,
          source_ids,
          page_size,
        }),
        hydrator_kind: "url_fetch",
        hydrator_config_json: JSON.stringify({
          fetch_strategy: "direct_url_v1",
        }),
        active: true,
      });

      const { acquisition_run_id } = await createAcquisitionRun({
        acquisition_spec_id,
      });

      const started = await startAcquisitionRun({
        acquisition_run_id,
      });

      toast.success("Evidence universe created.", {
        description:
          `Acquisition queued as ${started.workflow_id}. Review the run on the evidence page and snapshot it into an evidence set after completion.`,
      });
      router.push(`/evidence/${universe_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Media Cloud query failed.", {
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border bg-card/80">
      <CardHeader>
        <p className="text-[10px] uppercase tracking-widest opacity-50">
          Evidence Acquisition
        </p>
        <CardTitle className="text-base" style={{ fontFamily: "var(--font-1-serif)" }}>
          Media Cloud Query
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Universe Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Democratic erosion scan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="universe_tag">Universe Tag</Label>
              <Input
                id="universe_tag"
                value={form.universe_tag}
                onChange={(event) => setField("universe_tag", event.target.value)}
                placeholder={defaults.universeTag}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="Reusable Media Cloud universe for V4 evidence review"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="query">Media Cloud Query</Label>
            <Input
              id="query"
              value={form.query}
              onChange={(event) => setField("query", event.target.value)}
              placeholder="democratic erosion OR illiberal democracy"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(event) => setField("start_date", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(event) => setField("end_date", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="collection_ids">Collection IDs</Label>
              <Input
                id="collection_ids"
                value={form.collection_ids}
                onChange={(event) => setField("collection_ids", event.target.value)}
                placeholder="34412234,123456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source_ids">Source IDs</Label>
              <Input
                id="source_ids"
                value={form.source_ids}
                onChange={(event) => setField("source_ids", event.target.value)}
                placeholder="Optional source ids"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="page_size">Candidate Page Size</Label>
            <Input
              id="page_size"
              value={form.page_size}
              onChange={(event) => setField("page_size", event.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full text-[10px] uppercase tracking-widest"
            disabled={submitting}
          >
            {submitting ? "Launching Acquisition..." : "Create Universe + Launch Acquisition"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
