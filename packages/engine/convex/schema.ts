import { zid, zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineSchema, defineTable } from "convex/server";
import z from "zod";

// --- Model types ---
export const modelTypeSchema = z.union([
  z.literal("gpt-4.1"),
  z.literal("gpt-4.1-mini"),
  z.literal("gpt-5.2"),
  z.literal("claude-sonnet-4.5"),
  z.literal("claude-haiku-4.5"),
  z.literal("gemini-3-flash"),
  z.literal("grok-4.1-fast"),
  z.literal("qwen3-235b"),
]);

export type ModelType = z.infer<typeof modelTypeSchema>;

// --- Task types ---
export const TaskTypeSchema = z.union([
  z.literal("ecc"), // Essentially Contested Concept — no ground truth
  z.literal("control"), // Low-contestation concept — expert proxy ground truth
  z.literal("benchmark"), // Known-answer task — provided ground truth
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

// --- Ground truth ---
export const GroundTruthSchema = z.object({
  source: z.string(),
  value: z.number().optional(),
  label: z.string().optional(),
});

// --- Experiment config (design space axes) ---
export const ExperimentConfigSchema = z.object({
  scaleSize: z.number(),
  randomizeLabels: z.boolean(),
  neutralizeEvidence: z.boolean(),
  scoringMethod: z.union([
    z.literal("freeform-suffix-single"),
    z.literal("freeform-suffix-subset"),
    z.literal("structured-json"),
  ]),
  promptOrdering: z.union([
    z.literal("rubric-first"),
    z.literal("evidence-first"),
  ]),
  abstainEnabled: z.boolean(),
  freshWindowProbe: z.boolean(),
});

export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;

// --- Table schemas ---
export const ExperimentsTableSchema = z.object({
  experimentId: z.string(),
  windowId: zid("windows"),
  modelId: modelTypeSchema,
  taskType: TaskTypeSchema,
  concept: z.string(),
  groundTruth: GroundTruthSchema.optional(),
  config: ExperimentConfigSchema,
  status: z.union([
    z.literal("pending"),
    z.literal("evidence-done"),
    z.literal("rubric-done"),
    z.literal("scoring"),
    z.literal("probing"),
    z.literal("complete"),
  ]),
});

export const WindowsTableSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  country: z.string(),
});

export const EvidenceTableSchema = z.object({
  windowId: zid("windows"),
  title: z.string(),
  url: z.string(),
  rawContent: z.string(),
  neutralizedContent: z.string().optional(),
});

const StageSchema = z.object({
  label: z.string().describe("Concise label for this stage"),
  criteria: z.array(z.string()).describe("Observable indicators"),
});

export const RubricsTableSchema = z.object({
  experimentId: z.string(),
  modelId: modelTypeSchema,
  concept: z.string(),
  scaleSize: z.number(),
  stages: z.array(StageSchema),
  reasoning: z.string(),
  qualityStats: z.object({
    observabilityScore: z.number(),
    discriminabilityScore: z.number(),
  }),
});

export const SamplesTableSchema = z.object({
  experimentId: z.string(),
  modelId: modelTypeSchema,
  rubricId: zid("rubrics"),
  evidenceId: zid("evidence"),
  threadId: z.string(),
  isSwap: z.boolean(),
  labelMapping: z.record(z.string(), z.number()).optional(),
  displaySeed: z.number().optional(),
  abstained: z.boolean(),
  rawVerdict: z.string().nullable(),
  decodedScores: z.array(z.number()).nullable(),
});

export const ProbesTableSchema = z.object({
  sampleId: zid("samples"),
  modelId: modelTypeSchema,
  threadId: z.string(),
  promptedStageLabel: z.string(),
  expertAgreementProb: z.number(),
});

export const UsageTableSchema = z.object({
  threadId: z.string(),
  agentName: z.string(),
  model: z.string(),
  provider: z.string(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
});

// --- Schema definition ---
export default defineSchema({
  experiments: defineTable(zodOutputToConvex(ExperimentsTableSchema))
    .index("by_experiment_id", ["experimentId"])
    .index("by_task_type", ["taskType"]),
  windows: defineTable(zodOutputToConvex(WindowsTableSchema)),
  evidence: defineTable(zodOutputToConvex(EvidenceTableSchema)).index(
    "by_window_id",
    ["windowId"],
  ),
  rubrics: defineTable(zodOutputToConvex(RubricsTableSchema)).index(
    "by_experiment_model",
    ["experimentId", "modelId"],
  ),
  samples: defineTable(zodOutputToConvex(SamplesTableSchema))
    .index("by_experiment", ["experimentId"])
    .index("by_rubric", ["rubricId"]),
  probes: defineTable(zodOutputToConvex(ProbesTableSchema)).index("by_sample", [
    "sampleId",
  ]),
  usage: defineTable(zodOutputToConvex(UsageTableSchema)).index("by_provider", [
    "provider",
  ]),
});
