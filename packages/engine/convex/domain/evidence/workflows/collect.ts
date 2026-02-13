import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction, zInternalMutation } from "../../../platform/utils";
import { internal } from "../../../_generated/api";
import { providerFor } from "../../../platform/utils";
import type { ModelType } from "../../../models/core";
import {
  EVIDENCE_CLEANING_INSTRUCTIONS,
  NEUTRALIZE_INSTRUCTIONS,
  STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
  abstractPrompt,
  cleanPrompt,
  neutralizePrompt,
} from "../prompts";

const DEFAULT_LIMIT = 15;
const EVIDENCE_MODEL: ModelType = "gpt-4.1";

type EvidenceSummary = { title: string; url: string };
type SearchResult = { title: string; url: string; raw_content: string };

export const collectEvidence: ReturnType<typeof zInternalAction> = zInternalAction({
  args: z.object({
    experiment_id: zid("experiments"),
    limit: z.number().optional(),
  }),
  returns: z.object({
    collected: z.number(),
    total: z.number(),
    queued_clean: z.number(),
    queued_neutralize: z.number(),
    queued_abstract: z.number(),
  }),
  handler: async (ctx, { experiment_id, limit }) => {
    const experiment = await ctx.runQuery(
      internal.domain.experiments.repo.getExperimentById,
      { experiment_id },
    );
    const window = await ctx.runQuery(internal.domain.experiments.repo.getWindow, {
      window_id: experiment.window_id,
    });

    const lim = limit ?? DEFAULT_LIMIT;
    const evidenceView = experiment.config.evidence_view;

    const existingPreview: EvidenceSummary[] = await ctx.runQuery(
      internal.domain.experiments.repo.listEvidenceByWindowSummary,
      { window_id: experiment.window_id, limit: lim },
    );

    let insertedCount = 0;

    if (existingPreview.length < lim) {
      const existingAll: EvidenceSummary[] = await ctx.runQuery(
        internal.domain.experiments.repo.listEvidenceByWindowSummary,
        { window_id: experiment.window_id },
      );
      const existingUrls = new Set(
        existingAll.map((row) => normalizeUrl(row.url)),
      );
      const remaining = Math.max(0, lim - existingAll.length);
      if (remaining > 0) {
        const results: SearchResult[] = await ctx.runAction(
          internal.domain.evidence.search.searchNews,
          {
            concept: window.concept,
            country: window.country,
            start_date: window.start_date,
            end_date: window.end_date,
            limit: remaining,
          },
        );

        const newResults = results.filter((result: SearchResult) => {
          const normalized = normalizeUrl(result.url);
          if (existingUrls.has(normalized)) return false;
          existingUrls.add(normalized);
          return true;
        });

        for (const result of newResults) {
          await ctx.runMutation(internal.domain.experiments.repo.createEvidence, {
            window_id: experiment.window_id,
            title: result.title,
            url: result.url,
            raw_content: result.raw_content,
          });
        }

        insertedCount = newResults.length;
      }
    }

    const evidence = await ctx.runQuery(
      internal.domain.experiments.repo.listEvidenceByWindow,
      { window_id: experiment.window_id },
    );

    const queueResult = await ctx.runMutation(
      internal.domain.evidence.workflows.collect.queueEvidenceProcessing,
      { window_id: experiment.window_id, evidence_view: evidenceView },
    );

    return {
      collected: insertedCount,
      total: evidence.length,
      queued_clean: queueResult.queued_clean,
      queued_neutralize: queueResult.queued_neutralize,
      queued_abstract: queueResult.queued_abstract,
    };
  },
});

export const queueEvidenceProcessing: ReturnType<typeof zInternalMutation> =
  zInternalMutation({
  args: z.object({
    window_id: zid("windows"),
    evidence_view: z.enum(["raw", "cleaned", "neutralized", "abstracted"]),
  }),
  returns: z.object({
    queued_clean: z.number(),
    queued_neutralize: z.number(),
    queued_abstract: z.number(),
  }),
  handler: async (ctx, { window_id, evidence_view }) => {
    const evidence = await ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("window_id", window_id))
      .collect();

    const needsClean = evidence_view !== "raw";
    const needsNeutralize =
      evidence_view === "neutralized" || evidence_view === "abstracted";
    const needsAbstract = evidence_view === "abstracted";

    let queuedClean = 0;
    let queuedNeutralize = 0;
    let queuedAbstract = 0;

    for (const row of evidence) {
      if (needsClean && !row.cleaned_content) {
        await ctx.runMutation(
          internal.domain.llm_calls.llm_requests.getOrCreateLlmRequest,
          {
            stage: "evidence_clean",
            provider: providerFor(EVIDENCE_MODEL),
            model: EVIDENCE_MODEL,
            system_prompt: EVIDENCE_CLEANING_INSTRUCTIONS,
            user_prompt: cleanPrompt(row.raw_content),
            experiment_id: null,
            rubric_id: null,
            sample_id: null,
            evidence_id: row._id,
            request_version: 1,
            temperature: 0.2,
            max_tokens: 1200,
          },
        );
        queuedClean += 1;
      }

      if (needsNeutralize && !row.neutralized_content) {
        const source = row.cleaned_content ?? row.raw_content;
        await ctx.runMutation(
          internal.domain.llm_calls.llm_requests.getOrCreateLlmRequest,
          {
            stage: "evidence_neutralize",
            provider: providerFor(EVIDENCE_MODEL),
            model: EVIDENCE_MODEL,
            system_prompt: NEUTRALIZE_INSTRUCTIONS,
            user_prompt: neutralizePrompt(source),
            experiment_id: null,
            rubric_id: null,
            sample_id: null,
            evidence_id: row._id,
            request_version: 1,
            temperature: 0.2,
            max_tokens: 1000,
          },
        );
        queuedNeutralize += 1;
      }

      if (needsAbstract && !row.abstracted_content) {
        const source =
          row.neutralized_content ?? row.cleaned_content ?? row.raw_content;
        await ctx.runMutation(
          internal.domain.llm_calls.llm_requests.getOrCreateLlmRequest,
          {
            stage: "evidence_abstract",
            provider: providerFor(EVIDENCE_MODEL),
            model: EVIDENCE_MODEL,
            system_prompt: STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
            user_prompt: abstractPrompt(source),
            experiment_id: null,
            rubric_id: null,
            sample_id: null,
            evidence_id: row._id,
            request_version: 1,
            temperature: 0.2,
            max_tokens: 1200,
          },
        );
        queuedAbstract += 1;
      }
    }

    return {
      queued_clean: queuedClean,
      queued_neutralize: queuedNeutralize,
      queued_abstract: queuedAbstract,
    };
  },
  });

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    const params = parsed.searchParams;
    const dropKeys = [
      "fbclid",
      "gclid",
      "dclid",
      "igshid",
      "mc_cid",
      "mc_eid",
    ];
    for (const key of dropKeys) params.delete(key);
    for (const key of Array.from(params.keys())) {
      if (key.startsWith("utm_")) params.delete(key);
    }
    parsed.search = params.toString() ? `?${params.toString()}` : "";
    const normalized = parsed.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return url.trim().toLowerCase();
  }
}
