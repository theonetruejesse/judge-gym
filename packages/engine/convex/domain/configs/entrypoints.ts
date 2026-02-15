import z from "zod";
import { zMutation } from "../../platform/utils";
import { internal } from "../../_generated/api";
import {
  ConfigTemplateBodyInputSchema,
  ConfigTemplatesTableSchema,
} from "../../models/configs";
import { normalizeConfigTemplateBody } from "../../utils/config_normalizer";
import { ENGINE_SETTINGS } from "../../settings";
import { buildExperimentSpecSignature } from "../../utils/spec_signature";
import type { MutationCtx } from "../../_generated/server";

export const seedConfigTemplate: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    template_id: z.string(),
    version: z.number().int().min(1),
    schema_version: z.number().int().min(1),
    config_body: ConfigTemplateBodyInputSchema,
    created_by: z.string().optional(),
    notes: z.string().optional(),
  }),
  returns: z.object({
    template_id: z.string(),
    version: z.number(),
    created: z.boolean(),
    spec_signature: z.string(),
  }),
  handler: async (ctx: MutationCtx, args) => {
    const normalized = normalizeConfigTemplateBody(args.config_body);
    const normalizedWithPolicy = {
      ...normalized,
      policies: { global: ENGINE_SETTINGS.run_policy },
    };
    const spec_signature = buildExperimentSpecSignature({
      evidence_window: normalizedWithPolicy.evidence_window,
      experiment: normalizedWithPolicy.experiment,
    });

    const existing: z.infer<typeof ConfigTemplatesTableSchema> | null =
      await ctx.runQuery(
      internal.domain.configs.repo.getConfigTemplate,
      {
        template_id: args.template_id,
        version: args.version,
      },
    );

    if (existing) {
      if (existing.spec_signature !== spec_signature) {
        throw new Error(
          `Config template mismatch for ${args.template_id} v${args.version}`,
        );
      }
      return {
        template_id: existing.template_id,
        version: existing.version,
        created: false,
        spec_signature: existing.spec_signature,
      };
    }

    await ctx.runMutation(internal.domain.configs.repo.createConfigTemplate, {
      template_id: args.template_id,
      version: args.version,
      schema_version: args.schema_version,
      config_body: normalizedWithPolicy,
      created_at: Date.now(),
      created_by: args.created_by,
      notes: args.notes,
      spec_signature,
    });

    return {
      template_id: args.template_id,
      version: args.version,
      created: true,
      spec_signature,
    };
  },
});
