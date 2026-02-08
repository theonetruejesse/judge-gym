import z from "zod";
import { ExperimentsTableSchema, WindowsTableSchema } from "../convex/schema";

const ExperimentInputSchema = ExperimentsTableSchema.omit({
  status: true,
  windowId: true,
});

export type WindowInput = z.infer<typeof WindowsTableSchema>;
export type ExperimentInput = z.infer<typeof ExperimentInputSchema>;

// UPDATE THIS TO YOUR OWN EXPERIMENT CONFIGURATION
// types are automatically inferred from the schema.
export const TRIAL = {
  window: {
    startDate: "2026-01-01",
    endDate: "2026-01-07",
    country: "USA",
    concept: "fascism",
  },
  experiment: {
    experimentTag: "ecc-fascism-usa-trial",
    modelId: "gpt-4.1",
    taskType: "ecc",
    config: {
      scaleSize: 4,
      randomizations: ["anon-label", "rubric-order-shuffle"],
      neutralizeEvidence: true,
      scoringMethod: "freeform-suffix-subset",
      promptOrdering: "rubric-first",
      abstainEnabled: true,
      freshWindowProbe: true,
    },
  },
  evidenceLimit: 15,
  sampleCount: 10,
} satisfies {
  window: WindowInput;
  experiment: ExperimentInput;
  evidenceLimit: number;
  sampleCount: number;
};
