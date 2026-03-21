import z from "zod";
import {
  BundleStrategySchema,
  type BundleStrategy,
  RubricStageConfigSchema,
  ScoringStageConfigSchema,
  SemanticLevelSchema,
  type SemanticLevel,
} from "@judge-gym/engine-prompts/run";

export const StateStatusSchema = z.enum([
  "start",
  "queued",
  "running",
  "paused",
  "completed",
  "error",
  "canceled",
]);

export type StateStatus = z.infer<typeof StateStatusSchema>;

export {
  BundleStrategySchema,
  RubricStageConfigSchema,
  ScoringStageConfigSchema,
  SemanticLevelSchema,
};

export type {
  BundleStrategy,
  SemanticLevel,
};
