import { ExperimentSettings } from "./helpers/types";

// Update this file to change the experimental settings.

export const EXPERIMENT_SETTINGS: ExperimentSettings[] = [
  // {
  //   window: {
  //     startDate: "2026-01-01",
  //     endDate: "2026-01-07",
  //     country: "USA",
  //     concept: "fascism",
  //   },
  //   experiment: {
  //     experimentTag: "ecc-fascism-usa-trial-gpt-4.1",
  //     modelId: "gpt-4.1",
  //     taskType: "ecc",
  //     config: {
  //       scaleSize: 4,
  //       randomizations: ["anon-label", "rubric-order-shuffle"],
  //       evidenceView: "neutralized",
  //       scoringMethod: "freeform-suffix-subset",
  //       promptOrdering: "rubric-first",
  //       abstainEnabled: true,
  //     },
  //   },
  //   evidenceLimit: 9,
  //   sampleCount: 30,
  // },
  // {
  //   window: {
  //     startDate: "2026-01-01",
  //     endDate: "2026-01-07",
  //     country: "USA",
  //     concept: "fascism",
  //   },
  //   experiment: {
  //     experimentTag: "ecc-fascism-usa-trial-gemini-3.0-flash",
  //     modelId: "gemini-3.0-flash",
  //     taskType: "ecc",
  //     config: {
  //       scaleSize: 4,
  //       randomizations: ["anon-label", "rubric-order-shuffle"],
  //       evidenceView: "neutralized",
  //       scoringMethod: "freeform-suffix-subset",
  //       promptOrdering: "rubric-first",
  //       abstainEnabled: true,
  //     },
  //   },
  //   evidenceLimit: 9,
  //   sampleCount: 30,
  // },
  // {
  //   window: {
  //     startDate: "2026-01-01",
  //     endDate: "2026-01-07",
  //     country: "USA",
  //     concept: "fascism",
  //   },
  //   experiment: {
  //     experimentTag: "ecc-fascism-usa-trial-gpt-5.2-chat",
  //     modelId: "gpt-5.2-chat",
  //     taskType: "ecc",
  //     config: {
  //       scaleSize: 4,
  //       randomizations: ["anon-label", "rubric-order-shuffle"],
  //       evidenceView: "neutralized",
  //       scoringMethod: "freeform-suffix-subset",
  //       promptOrdering: "rubric-first",
  //       abstainEnabled: true,
  //     },
  //   },
  //   evidenceLimit: 9,
  //   sampleCount: 30,
  // },
  {
    window: {
      startDate: "2026-01-01",
      endDate: "2026-01-07",
      country: "USA",
      concept: "fascism",
    },
    experiment: {
      experimentTag: "ecc-fascism-usa-trial-qwen3-235b",
      modelId: "qwen3-235b",
      taskType: "ecc",
      config: {
        scaleSize: 4,
        randomizations: ["anon-label", "rubric-order-shuffle"],
        evidenceView: "neutralized",
        scoringMethod: "freeform-suffix-subset",
        promptOrdering: "rubric-first",
        abstainEnabled: true,
      },
    },
    evidenceLimit: 9,
    sampleCount: 30,
  },
];
