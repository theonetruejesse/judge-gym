import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../platform/utils";
import {
  ConfigTemplatesTableSchema,
  RunConfigsTableSchema,
  RunConfigValidationStatusSchema,
} from "../../models/configs";

export const getConfigTemplate = zInternalQuery({
  args: z.object({
    template_id: z.string(),
    version: z.number(),
  }),
  handler: async (ctx, { template_id, version }) => {
    return ctx.db
      .query("config_templates")
      .withIndex("by_template_version", (q) =>
        q.eq("template_id", template_id).eq("version", version),
      )
      .unique();
  },
});

export const createConfigTemplate = zInternalMutation({
  args: ConfigTemplatesTableSchema,
  handler: async (ctx, args) => ctx.db.insert("config_templates", args),
});

export const getRunConfig = zInternalQuery({
  args: z.object({ run_config_id: zid("run_configs") }),
  handler: async (ctx, { run_config_id }) => {
    const runConfig = await ctx.db.get(run_config_id);
    if (!runConfig) throw new Error("Run config not found");
    return runConfig;
  },
});

export const createRunConfig = zInternalMutation({
  args: RunConfigsTableSchema,
  handler: async (ctx, args) => {
    const run_config_id = await ctx.db.insert("run_configs", args);
    await ctx.db.patch(run_config_id, { run_config_id });
    return run_config_id;
  },
});

export const createRunConfigFromTemplate = zInternalMutation({
  args: z.object({
    template_id: z.string(),
    version: z.number(),
    git_sha: z.string(),
    validation_status: RunConfigValidationStatusSchema.optional(),
  }),
  handler: async (ctx, { template_id, version, git_sha, validation_status }) => {
    const template = await ctx.db
      .query("config_templates")
      .withIndex("by_template_version", (q) =>
        q.eq("template_id", template_id).eq("version", version),
      )
      .unique();
    if (!template) throw new Error("Config template not found");

    const now = Date.now();
    const run_config_id = await ctx.db.insert("run_configs", {
      run_config_id: undefined,
      template_id,
      version,
      config_body: template.config_body,
      created_at: now,
      git_sha,
      spec_signature: template.spec_signature,
      validation_status: validation_status ?? "valid",
    });
    await ctx.db.patch(run_config_id, { run_config_id });
    return run_config_id;
  },
});
