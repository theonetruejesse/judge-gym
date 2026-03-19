import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zQuery } from "../utils/custom_fns";
import { internal } from "../_generated/api";
import {
  AnalysisPaginationArgsSchema,
  AnalysisExperimentSummarySchema,
  AnalysisManifestSchema,
  AnalysisResponseRowSchema,
  AnalysisRubricRowSchema,
  AnalysisEvidenceRowSchema,
  AnalysisSampleRowSchema,
  analysisPageResultSchema,
} from "../domain/analysis/export";

const AnalysisResponsesPageSchema = analysisPageResultSchema(AnalysisResponseRowSchema);
const AnalysisRubricsPageSchema = analysisPageResultSchema(AnalysisRubricRowSchema);
const AnalysisEvidencePageSchema = analysisPageResultSchema(AnalysisEvidenceRowSchema);
const AnalysisSamplesPageSchema = analysisPageResultSchema(AnalysisSampleRowSchema);

export const listAnalysisExperiments: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(AnalysisExperimentSummarySchema),
  handler: async (ctx): Promise<z.infer<typeof AnalysisExperimentSummarySchema>[]> => {
    return ctx.runQuery(
      internal.domain.analysis.export.listAnalysisExperiments,
      {},
    );
  },
});

export const getAnalysisManifest: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    experiment_tag: z.string().optional(),
    run_id: zid("runs").optional(),
  }),
  returns: AnalysisManifestSchema,
  handler: async (ctx, args): Promise<z.infer<typeof AnalysisManifestSchema>> => {
    return ctx.runQuery(
      internal.domain.analysis.export.getAnalysisManifest,
      args,
    );
  },
});

export const listAnalysisResponses: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    run_id: zid("runs"),
    pagination: AnalysisPaginationArgsSchema.optional(),
  }),
  returns: AnalysisResponsesPageSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof AnalysisResponsesPageSchema>> => {
    return ctx.runQuery(
      internal.domain.analysis.export.listAnalysisResponses,
      args,
    );
  },
});

export const listAnalysisRubrics: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    run_id: zid("runs"),
    pagination: AnalysisPaginationArgsSchema.optional(),
  }),
  returns: AnalysisRubricsPageSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof AnalysisRubricsPageSchema>> => {
    return ctx.runQuery(
      internal.domain.analysis.export.listAnalysisRubrics,
      args,
    );
  },
});

export const listAnalysisEvidence: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    run_id: zid("runs"),
    pagination: AnalysisPaginationArgsSchema.optional(),
  }),
  returns: AnalysisEvidencePageSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof AnalysisEvidencePageSchema>> => {
    return ctx.runQuery(
      internal.domain.analysis.export.listAnalysisEvidence,
      args,
    );
  },
});

export const listAnalysisSamples: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    run_id: zid("runs"),
    pagination: AnalysisPaginationArgsSchema.optional(),
  }),
  returns: AnalysisSamplesPageSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof AnalysisSamplesPageSchema>> => {
    return ctx.runQuery(
      internal.domain.analysis.export.listAnalysisSamples,
      args,
    );
  },
});
