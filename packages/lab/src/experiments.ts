import { ExperimentSettings } from "./helpers/types";

// Update this file to change the experimental settings.

export const EXPERIMENT_SETTINGS: ExperimentSettings[] = [
  {
    window: {
      start_date: "2026-01-01",
      end_date: "2026-01-07",
      country: "USA",
      concept: "fascism",
    },
    experiment: {
      experiment_tag: "ecc-fascism-usa-trial-gpt-4.1-mini",
      task_type: "ecc",
      config: {
        scale_size: 4,
        rubric_model_id: "gpt-4.1-mini",
        scoring_model_id: "gpt-4.1-mini",
        randomizations: ["anon-label", "rubric-order-shuffle"],
        evidence_view: "neutralized",
        scoring_method: "freeform-suffix-subset",
        prompt_ordering: "rubric-first",
        abstain_enabled: true,
      },
      hypothetical_frame:
        "Evaluate evidence as if the concept were defined by an expert panel.",
      label_neutralization_mode: "mask",
    },
    evidence_limit: 9,
    sample_count: 30,
  },
];
