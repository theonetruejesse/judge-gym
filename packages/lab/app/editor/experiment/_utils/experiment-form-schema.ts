import * as z from "zod";
import {
  MODEL_OPTIONS,
  RANDOMIZATION_LABELS,
  SCORING_METHOD_LABELS,
  VIEW_LABELS,
} from "@/lib/ui-maps";
import type { ModelType } from "@judge-gym/engine-convex";
const methodOptions = Object.keys(SCORING_METHOD_LABELS) as [
  "single",
  "subset",
];
const viewOptions = Object.keys(VIEW_LABELS) as [
  "l0_raw",
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
];
const randomizationOptions = Object.keys(RANDOMIZATION_LABELS) as [
  "anonymize_stages",
  "shuffle_rubric_order",
  "hide_label_text",
];

export const experimentFormSchema = z.object({
  concept: z.string().min(1, "Concept is required."),
  rubric_model: z
    .string()
    .min(1, "Rubric model is required.")
    .refine(
      (value) =>
        MODEL_OPTIONS.includes(value as (typeof MODEL_OPTIONS)[number]),
      "Invalid rubric model.",
    ),
  scoring_model: z
    .string()
    .min(1, "Scoring model is required.")
    .refine(
      (value) =>
        MODEL_OPTIONS.includes(value as (typeof MODEL_OPTIONS)[number]),
      "Invalid scoring model.",
    ),
  scale_size: z.coerce
    .number()
    .int("Scale size must be a whole number.")
    .min(1, "Scale size must be at least 1."),
  method: z.enum(methodOptions),
  evidence_view: z.enum(viewOptions),
  abstain_enabled: z.boolean(),
  randomizations: z.array(z.enum(randomizationOptions)),
});

export type ExperimentFormValues = z.infer<typeof experimentFormSchema>;
export type ExperimentFormDefaults = Partial<ExperimentFormValues>;
export type ExperimentFormSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const DEFAULT_EXPERIMENT_FORM_VALUES: ExperimentFormValues = {
  concept: "",
  rubric_model: "",
  scoring_model: "",
  scale_size: 5,
  method: "single",
  evidence_view: "l0_raw",
  abstain_enabled: false,
  randomizations: [],
};

export function mergeExperimentFormDefaults(
  defaults?: ExperimentFormDefaults,
): ExperimentFormValues {
  return { ...DEFAULT_EXPERIMENT_FORM_VALUES, ...defaults };
}

function readParam(
  searchParams: ExperimentFormSearchParams,
  key: keyof ExperimentFormValues,
): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseModel(value: string | undefined): ModelType | undefined {
  if (!value) return undefined;
  return MODEL_OPTIONS.includes(value as ModelType)
    ? (value as ModelType)
    : undefined;
}

function parseMethod(
  value: string | undefined,
): ExperimentFormValues["method"] | undefined {
  if (!value) return undefined;
  return methodOptions.includes(value as ExperimentFormValues["method"])
    ? (value as ExperimentFormValues["method"])
    : undefined;
}

function parseEvidenceView(
  value: string | undefined,
): ExperimentFormValues["evidence_view"] | undefined {
  if (!value) return undefined;
  return viewOptions.includes(value as ExperimentFormValues["evidence_view"])
    ? (value as ExperimentFormValues["evidence_view"])
    : undefined;
}

function parseRandomizations(
  value: string | undefined,
): ExperimentFormValues["randomizations"] | undefined {
  if (!value) return undefined;
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(
      (item): item is ExperimentFormValues["randomizations"][number] =>
        randomizationOptions.includes(
          item as ExperimentFormValues["randomizations"][number],
        ),
    );
  return parsed.length > 0 ? parsed : undefined;
}

export function getExperimentFormDefaultsFromSearchParams(
  searchParams: ExperimentFormSearchParams,
): ExperimentFormDefaults {
  const concept = parseString(readParam(searchParams, "concept"));
  const rubric_model = parseModel(readParam(searchParams, "rubric_model"));
  const scoring_model = parseModel(readParam(searchParams, "scoring_model"));
  const scale_size = parseNumber(readParam(searchParams, "scale_size"));
  const method = parseMethod(readParam(searchParams, "method"));
  const evidence_view = parseEvidenceView(
    readParam(searchParams, "evidence_view"),
  );
  const abstain_enabled = parseBoolean(
    readParam(searchParams, "abstain_enabled"),
  );
  const randomizations = parseRandomizations(
    readParam(searchParams, "randomizations"),
  );

  return {
    ...(concept ? { concept } : {}),
    ...(rubric_model ? { rubric_model } : {}),
    ...(scoring_model ? { scoring_model } : {}),
    ...(scale_size ? { scale_size } : {}),
    ...(method ? { method } : {}),
    ...(evidence_view ? { evidence_view } : {}),
    ...(abstain_enabled !== undefined ? { abstain_enabled } : {}),
    ...(randomizations ? { randomizations } : {}),
  };
}
