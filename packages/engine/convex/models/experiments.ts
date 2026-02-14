import { zid, zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineTable } from "convex/server";
import z from "zod";
import {
  ExperimentConfigSchema,
  ExperimentConfigInputSchema,
  ExperimentStatusSchema,
  GroundTruthSchema,
  ParseStatusSchema,
  TaskTypeSchema,
  modelTypeSchema,
} from "./core";

export const ExperimentSpecSchema = z.object({
  experiment_tag: z.string(),
  task_type: TaskTypeSchema,
  ground_truth: GroundTruthSchema.optional(),
  config: ExperimentConfigSchema,
  hypothetical_frame: z.string().optional(),
  label_neutralization_mode: z
    .enum(["none", "mask", "generic"])
    .optional(),
});

export const ExperimentSpecInputSchema = ExperimentSpecSchema.extend({
  config: ExperimentConfigInputSchema,
});

export const ExperimentsTableSchema = ExperimentSpecSchema.extend({
  window_id: zid("windows"),
  spec_signature: z.string(),
  status: ExperimentStatusSchema,
  config_template_id: z.string(),
  config_template_version: z.number(),
  active_run_id: zid("runs").optional(),
});

export const WindowsTableSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  country: z.string(),
  concept: z.string(),
});

export const EvidencesTableSchema = z.object({
  window_id: zid("windows"),
  title: z.string(),
  url: z.string(),
  raw_content: z.string(),
  cleaned_content: z.string().optional(),
  neutralized_content: z.string().optional(),
  abstracted_content: z.string().optional(),
});

const StageSchema = z.object({
  label: z.string().describe("Concise label for this stage"),
  criteria: z.array(z.string()).describe("Observable indicators"),
});

export const RubricsTableSchema = z.object({
  experiment_id: zid("experiments"),
  model_id: modelTypeSchema,
  concept: z.string(),
  scale_size: z.number(),
  stages: z.array(StageSchema),
  rubricer_message_id: zid("llm_messages").optional(),
  rubricer_output: z.string().optional(),
  rubric_critic_message_id: zid("llm_messages").optional(),
  rubric_critic_output: z.string().optional(),
  rubric_critic_reasoning: z.string().optional(),
  quality_stats: z
    .object({
      observability_score: z.number(),
      discriminability_score: z.number(),
    })
    .optional(),
  parse_error: z.string().optional(),
  parse_status: ParseStatusSchema.optional(),
  attempt_count: z.number().optional(),
});

export const SamplesTableSchema = z.object({
  experiment_id: zid("experiments"),
  model_id: modelTypeSchema,
  rubric_id: zid("rubrics"),
  label_mapping: z.record(z.string(), z.number()).optional(),
  display_seed: z.number().optional(),
});

export const ScoresTableSchema = z.object({
  sample_id: zid("samples"),
  experiment_id: zid("experiments"),
  model_id: modelTypeSchema,
  rubric_id: zid("rubrics"),
  evidence_id: zid("evidences"),
  abstained: z.boolean(),
  score_message_id: zid("llm_messages").optional(),
  raw_verdict: z.string().nullable().optional(),
  decoded_scores: z.array(z.number()).nullable().optional(),
  score_critic_message_id: zid("llm_messages").optional(),
  score_critic_output: z.string().optional(),
  score_critic_reasoning: z.string().optional(),
  expert_agreement_prob: z.number().optional(),
  parse_error: z.string().optional(),
  parse_status: ParseStatusSchema.optional(),
  attempt_count: z.number().optional(),
});

export const Experiments = defineTable(zodOutputToConvex(ExperimentsTableSchema));
export const Windows = defineTable(zodOutputToConvex(WindowsTableSchema));
export const Evidences = defineTable(zodOutputToConvex(EvidencesTableSchema));
export const Rubrics = defineTable(zodOutputToConvex(RubricsTableSchema));
export const Samples = defineTable(zodOutputToConvex(SamplesTableSchema));
export const Scores = defineTable(zodOutputToConvex(ScoresTableSchema));
