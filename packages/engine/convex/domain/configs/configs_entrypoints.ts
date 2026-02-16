import z from "zod";
import { zMutation } from "../../platform/utils";
import { internal } from "../../_generated/api";
import {
  ConfigTemplateBodyInputSchema,
  ConfigTemplatesTableSchema,
} from "../../models/configs";
import { normalizeConfigTemplateBody } from "../../utils/config_normalizer";
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
  }),
  handler: async (ctx: MutationCtx, args) => {
    const normalized = normalizeConfigTemplateBody(args.config_body);

    const existing: z.infer<typeof ConfigTemplatesTableSchema> | null =
      await ctx.runQuery(
      internal.domain.configs.configs_repo.getConfigTemplate,
      {
        template_id: args.template_id,
        version: args.version,
      },
    );

    if (existing) {
      return {
        template_id: existing.template_id,
        version: existing.version,
        created: false,
      };
    }

    await ctx.runMutation(internal.domain.configs.configs_repo.createConfigTemplate, {
      template_id: args.template_id,
      version: args.version,
      schema_version: args.schema_version,
      config_body: normalized,
      created_at: Date.now(),
      created_by: args.created_by,
      notes: args.notes,
    });

    return {
      template_id: args.template_id,
      version: args.version,
      created: true,
    };
  },
});
