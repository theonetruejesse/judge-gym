import { ExperimentSettings } from "./helpers/types";

// Update this file to change the experimental settings.

export const EXPERIMENT_SETTINGS: ExperimentSettings[] = [
  {
    window: {
      startDate: "2026-01-01",
      endDate: "2026-01-07",
      country: "USA",
      concept: "fascism",
    },
    experiment: {
      experimentTag: "ecc-fascism-usa-trial-gpt-4.1",
      modelId: "gpt-4.1",
      taskType: "ecc",
      config: {
        scaleSize: 4,
        randomizations: ["anon-label", "rubric-order-shuffle"],
        evidenceView: "neutralized",
        scoringMethod: "freeform-suffix-subset",
        promptOrdering: "rubric-first",
        abstainEnabled: true,
        freshWindowProbe: true,
      },
    },
    evidenceLimit: 15,
    sampleCount: 10,
  },
  {
    window: {
      startDate: "2026-01-01",
      endDate: "2026-01-07",
      country: "USA",
      concept: "fascism",
    },
    experiment: {
      experimentTag: "ecc-fascism-usa-trial-gemini-3.0-flash",
      modelId: "gemini-3.0-flash",
      taskType: "ecc",
      config: {
        scaleSize: 4,
        randomizations: ["anon-label", "rubric-order-shuffle"],
        evidenceView: "neutralized",
        scoringMethod: "freeform-suffix-subset",
        promptOrdering: "rubric-first",
        abstainEnabled: true,
        freshWindowProbe: true,
      },
    },
    evidenceLimit: 15,
    sampleCount: 10,
  },
];
