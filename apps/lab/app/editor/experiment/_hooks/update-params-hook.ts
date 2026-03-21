"use client";

import { useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { usePathname, useRouter } from "next/navigation";
import type { ExperimentFormValues } from "../_utils/experiment-form-schema";

interface UseUpdateExperimentFormParamsOptions {
  delayMs?: number;
}

const EXPERIMENT_FORM_KEYS: Array<keyof ExperimentFormValues> = [
  "concept",
  "rubric_model",
  "scoring_model",
  "scale_size",
  "method",
  "evidence_view",
  "abstain_enabled",
  "randomizations",
];

function toParamValue(
  key: keyof ExperimentFormValues,
  value: ExperimentFormValues[keyof ExperimentFormValues] | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;

  if (key === "randomizations") {
    const list = value as ExperimentFormValues["randomizations"];
    return list.length > 0 ? list.join(",") : undefined;
  }

  if (typeof value === "boolean") {
    return value ? "true" : undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildSearchParams(values: Partial<ExperimentFormValues>) {
  const params = new URLSearchParams(window.location.search);

  for (const key of EXPERIMENT_FORM_KEYS) {
    const nextValue = toParamValue(key, values[key]);
    if (!nextValue) {
      params.delete(key);
      continue;
    }
    params.set(key, nextValue);
  }

  return params;
}

export function useUpdateExperimentFormParams({
  delayMs = 400,
}: UseUpdateExperimentFormParamsOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const updateParamsImmediate = useCallback(
    (values: Partial<ExperimentFormValues>) => {
      if (typeof window === "undefined") return;
      const params = buildSearchParams(values);
      const search = params.toString();
      const url = search ? `${pathname}?${search}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router],
  );

  const updateParams = useDebouncedCallback(updateParamsImmediate, delayMs);

  return updateParams;
}
