export const STATUS_COLORS: Record<string, string> = {
  running: "#ff6b35",
  complete: "#22c55e",
  paused: "#f59e0b",
  pending: "#3b82f6",
  canceled: "#6b7280",
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
