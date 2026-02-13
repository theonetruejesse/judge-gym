import { defineSchema } from "convex/server";
import {
  Experiments,
  Windows,
  Evidences,
  Rubrics,
  Samples,
  Scores,
} from "./models/experiments";
import { Runs, RunStages } from "./models/runs";
import {
  LlmRequests,
  LlmMessages,
  LlmBatches,
  LlmBatchItems,
} from "./models/llm_calls";

export default defineSchema({
  experiments: Experiments.index("by_experiment_tag", ["experiment_tag"]).index(
    "by_task_type",
    ["task_type"],
  ),
  windows: Windows.index("by_window_key", [
    "start_date",
    "end_date",
    "country",
    "concept",
  ]),
  evidences: Evidences.index("by_window_id", ["window_id"]),
  rubrics: Rubrics.index("by_experiment_model", ["experiment_id", "model_id"]),
  samples: Samples.index("by_experiment", ["experiment_id"]).index(
    "by_rubric",
    ["rubric_id"],
  ),
  scores: Scores.index("by_experiment", ["experiment_id"]).index(
    "by_sample",
    ["sample_id"],
  )
    .index("by_rubric", ["rubric_id"])
    .index("by_evidence", ["evidence_id"]),
  runs: Runs.index("by_experiment", ["experiment_id"]).index("by_status", [
    "status",
  ]),
  run_stages: RunStages.index("by_run", ["run_id"]).index("by_stage", [
    "stage",
  ]),
  llm_requests: LlmRequests.index("by_status", ["status"])
    .index("by_stage_status", ["stage", "status"])
    .index("by_identity", [
      "stage",
      "provider",
      "model",
      "experiment_id",
      "rubric_id",
      "sample_id",
      "evidence_id",
      "request_version",
    ]),
  llm_messages: LlmMessages.index("by_provider_model", [
    "provider",
    "model",
  ]),
  llm_batches: LlmBatches.index("by_status", ["status"]).index(
    "by_provider_model",
    ["provider", "model"],
  ),
  llm_batch_items: LlmBatchItems.index("by_batch", ["batch_id"]).index(
    "by_request",
    ["request_id"],
  ),
});
