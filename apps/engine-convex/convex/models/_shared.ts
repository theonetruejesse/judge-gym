import z from "zod";
import {
  BundleStrategySchema,
  type BundleStrategy,
  EvidencePresentationSchema,
  type EvidencePresentation,
  RubricStageConfigSchema,
  ScoringStageConfigSchema,
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
  EvidencePresentationSchema,
  RubricStageConfigSchema,
  ScoringStageConfigSchema,
};

export type {
  BundleStrategy,
  EvidencePresentation,
};
