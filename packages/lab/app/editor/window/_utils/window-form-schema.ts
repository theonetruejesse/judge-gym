import * as z from "zod";
import { MODEL_OPTIONS } from "@/lib/ui-maps";
import type { ModelType } from "@judge-gym/engine";

const modelOptions = MODEL_OPTIONS as [ModelType, ...ModelType[]];

export const windowFormSchema = z
  .object({
    query: z.string().min(1, "Query is required."),
    country: z.string().min(1, "Country is required."),
    start_date: z.string().min(1, "Start date is required."),
    end_date: z.string().min(1, "End date is required."),
    model: z.enum(modelOptions),
    evidence_limit: z.coerce
      .number({ required_error: "Starting count is required." })
      .int("Starting count must be a whole number.")
      .min(1, "Starting count must be at least 1."),
  })
  .superRefine(({ start_date, end_date }, ctx) => {
    if (!start_date || !end_date) return;

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return;
    }

    if (endDate < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "End date cannot be before start date.",
      });
    }
  });

export type WindowFormValues = z.infer<typeof windowFormSchema>;
export type WindowFormDefaults = Partial<WindowFormValues>;
export type WindowFormSearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_WINDOW_FORM_VALUES: WindowFormValues = {
  query: "",
  country: "",
  start_date: "",
  end_date: "",
  model: modelOptions[0],
  evidence_limit: 5,
};

export function mergeWindowFormDefaults(
  defaults?: WindowFormDefaults,
): WindowFormValues {
  return { ...DEFAULT_WINDOW_FORM_VALUES, ...defaults };
}

function readParam(
  searchParams: WindowFormSearchParams,
  key: keyof WindowFormValues,
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

function parseModel(value: string | undefined): ModelType | undefined {
  if (!value) return undefined;
  return MODEL_OPTIONS.includes(value as ModelType)
    ? (value as ModelType)
    : undefined;
}

export function getWindowFormDefaultsFromSearchParams(
  searchParams: WindowFormSearchParams,
): WindowFormDefaults {
  const query = parseString(readParam(searchParams, "query"));
  const country = parseString(readParam(searchParams, "country"));
  const start_date = parseString(readParam(searchParams, "start_date"));
  const end_date = parseString(readParam(searchParams, "end_date"));
  const model = parseModel(readParam(searchParams, "model"));
  const evidence_limit = parseNumber(readParam(searchParams, "evidence_limit"));

  return {
    ...(query ? { query } : {}),
    ...(country ? { country } : {}),
    ...(start_date ? { start_date } : {}),
    ...(end_date ? { end_date } : {}),
    ...(model ? { model } : {}),
    ...(evidence_limit ? { evidence_limit } : {}),
  };
}
