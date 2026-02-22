import { modelTypeSchema, type ModelType } from "@judge-gym/engine";

export const MODEL_OPTIONS = modelTypeSchema.options.map(
  (option) => option.valueOf(),
) as ModelType[];

export const STATUS_COLORS: Record<string, string> = {
  running: "#22c55e",
  complete: "#3b82f6",
  paused: "#8b5cf6",
  pending: "#6b7280",
  canceled: "#ef4444",
};

export const STATUS_COLORS_MUTED: Record<string, string> = {
  running: "#3f8f5b",
  complete: "#3b6ea5",
  paused: "#6b4aa5",
  pending: "#7b8190",
  canceled: "#a44545",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  ecc: "ECC",
  control: "Control",
  benchmark: "Benchmark",
};

export const VIEW_LABELS: Record<string, string> = {
  l0_raw: "L0 Raw",
  l1_cleaned: "L1 Cleaned",
  l2_neutralized: "L2 Neutralized",
  l3_abstracted: "L3 Abstracted",
};

export const SCORING_METHOD_LABELS: Record<string, string> = {
  single: "Single",
  subset: "Subset",
};

export const RANDOMIZATION_LABELS: Record<string, string> = {
  anonymize_labels: "Anonymize Labels",
  shuffle_rubric_order: "Shuffle Rubric Order",
  hide_label_text: "Hide Label Text",
};

export const NORMALIZATION_LEVELS: Array<{ key: string; label: string }> =
  Object.entries(VIEW_LABELS).map(([key, label]) => ({
    key,
    label,
  }));
