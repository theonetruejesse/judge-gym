import { z } from "zod";
import {
  CompatibilityModeSchema,
  EvidencePresentationSchema,
  OutputContractSchema,
  RubricSourceKindSchema,
  TaskContractSchema,
} from "./run/config";

export const PaperAuditPromptVariableSchema = z.enum([
  "evidence",
  "rubric_block",
  "label_block",
  "instructions_block",
  "item_count",
  "target_id",
  "package_tag",
]);

export type PaperAuditPromptVariable =
  z.infer<typeof PaperAuditPromptVariableSchema>;

export const PaperAuditPromptTemplateSchema = z.object({
  template_kind: z.literal("simple_v1"),
  system_prompt_template: z.string(),
  user_prompt_template: z.string(),
  required_variables: z.array(PaperAuditPromptVariableSchema).default(["evidence"]),
});

export type PaperAuditPromptTemplate =
  z.infer<typeof PaperAuditPromptTemplateSchema>;

export const PaperAuditRubricStageSchema = z.object({
  stage_number: z.number().int().positive(),
  label: z.string(),
  criteria: z.array(z.string()),
});

export const PaperAuditRubricSeedSchema = z.object({
  concept: z.string(),
  scale_size: z.number().int().positive(),
  justification: z.string(),
  stages: z.array(PaperAuditRubricStageSchema),
  label_mapping: z.record(z.string(), z.number().int().positive()),
});

export type PaperAuditRubricSeed =
  z.infer<typeof PaperAuditRubricSeedSchema>;

export const PaperAuditRubricCriticSeedSchema = z.object({
  justification: z.string(),
  observability_score: z.number().min(0).max(1),
  discriminability_score: z.number().min(0).max(1),
});

export type PaperAuditRubricCriticSeed =
  z.infer<typeof PaperAuditRubricCriticSeedSchema>;

export const PaperAuditPackageTargetSchema = z.enum([
  "gilardi",
  "zheng_mt_bench",
  "ziems",
  "custom",
]);

export type PaperAuditPackageTarget =
  z.infer<typeof PaperAuditPackageTargetSchema>;

export const PaperAuditPackageSchema = z.object({
  package_tag: z.string(),
  target_key: PaperAuditPackageTargetSchema,
  title: z.string(),
  description: z.string().nullable().optional(),
  default_compatibility_mode: CompatibilityModeSchema,
  default_evidence_view: EvidencePresentationSchema,
  rubric_source_kind: RubricSourceKindSchema,
  task_contract: TaskContractSchema,
  output_contract: OutputContractSchema,
  rubric_seed: PaperAuditRubricSeedSchema.nullable().optional(),
  rubric_critic_seed: PaperAuditRubricCriticSeedSchema.nullable().optional(),
  score_prompt: PaperAuditPromptTemplateSchema,
  provenance_json: z.string().nullable().optional(),
  metadata_json: z.string().nullable().optional(),
});

export type PaperAuditPackage =
  z.infer<typeof PaperAuditPackageSchema>;

const TEMPLATE_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderPaperAuditTemplate(args: {
  template: string;
  variables: Record<string, string>;
}) {
  return args.template.replace(TEMPLATE_TOKEN_RE, (_, rawKey: string) => {
    const key = rawKey.trim();
    if (!(key in args.variables)) {
      throw new Error(`Missing paper-audit template variable: ${key}`);
    }
    return args.variables[key] ?? "";
  });
}

export function renderPaperAuditRubricBlock(
  rubricSeed: PaperAuditRubricSeed | null | undefined,
) {
  if (!rubricSeed) {
    return "";
  }
  return rubricSeed.stages
    .slice()
    .sort((left, right) => left.stage_number - right.stage_number)
    .map((stage) => {
      const token = Object.entries(rubricSeed.label_mapping)
        .find(([, value]) => value === stage.stage_number)?.[0]
        ?? String(stage.stage_number);
      return `${token}: ${stage.label} :: ${stage.criteria.join("; ")}`;
    })
    .join("\n");
}

export function renderPaperAuditLabelBlock(
  rubricSeed: PaperAuditRubricSeed | null | undefined,
) {
  if (!rubricSeed) {
    return "";
  }
  return rubricSeed.stages
    .slice()
    .sort((left, right) => left.stage_number - right.stage_number)
    .map((stage) => {
      const token = Object.entries(rubricSeed.label_mapping)
        .find(([, value]) => value === stage.stage_number)?.[0]
        ?? String(stage.stage_number);
      return `${token}: ${stage.label}`;
    })
    .join("\n");
}

