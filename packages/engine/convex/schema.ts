import { zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineSchema, defineTable } from "convex/server";
import { LlmBatchesTableSchema, LlmRequestsTableSchema, LlmWorkflowsTableSchema } from "./models/llm_calls";
import { EvidencesTableSchema, WindowsTableSchema } from "./models/window";
import { ExperimentEvidencesTableSchema, ExperimentsTableSchema, RunsTableSchema } from "./models/experiments";
import { SamplesTableSchema, RubricsTableSchema, RubricCriticsTableSchema, ScoresTableSchema, ScoreCriticsTableSchema } from "./models/samples";

// --- Schema definition ---
export default defineSchema({
  llm_batches: defineTable(zodOutputToConvex(LlmBatchesTableSchema)),
  llm_workflows: defineTable(zodOutputToConvex(LlmWorkflowsTableSchema)),
  llm_requests: defineTable(zodOutputToConvex(LlmRequestsTableSchema)),
  windows: defineTable(zodOutputToConvex(WindowsTableSchema)),
  evidences: defineTable(zodOutputToConvex(EvidencesTableSchema))
    .index("by_window_id", ["window_id"]),
  experiments: defineTable(zodOutputToConvex(ExperimentsTableSchema)),
  experiment_evidence: defineTable(zodOutputToConvex(ExperimentEvidencesTableSchema))
    .index("by_experiment", ["experiment_id"]),
  runs: defineTable(zodOutputToConvex(RunsTableSchema))
    .index("by_experiment", ["experiment_id"]),
  samples: defineTable(zodOutputToConvex(SamplesTableSchema)).index("by_run", ["run_id"]),
  rubrics: defineTable(zodOutputToConvex(RubricsTableSchema)).index("by_sample", ["sample_id"]),
  rubric_critics: defineTable(zodOutputToConvex(RubricCriticsTableSchema)).index("by_sample", ["sample_id"]),
  scores: defineTable(zodOutputToConvex(ScoresTableSchema)).index("by_sample", ["sample_id"]),
  score_critics: defineTable(zodOutputToConvex(ScoreCriticsTableSchema)).index("by_sample", ["sample_id"]),
});
