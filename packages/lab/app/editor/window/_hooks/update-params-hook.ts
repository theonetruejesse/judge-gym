"use client";

import { useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { usePathname, useRouter } from "next/navigation";
import type { WindowFormValues } from "../_utils/window-form-schema";

interface UseUpdateWindowFormParamsOptions {
  delayMs?: number;
}

const WINDOW_FORM_KEYS: Array<keyof WindowFormValues> = [
  "query",
  "country",
  "start_date",
  "end_date",
  "model",
  "evidence_limit",
];

function toParamValue(
  value: WindowFormValues[keyof WindowFormValues] | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildSearchParams(values: Partial<WindowFormValues>) {
  const params = new URLSearchParams(window.location.search);

  for (const key of WINDOW_FORM_KEYS) {
    const nextValue = toParamValue(values[key]);
    if (!nextValue) {
      params.delete(key);
      continue;
    }
    params.set(key, nextValue);
  }

  return params;
}

export function useUpdateWindowFormParams({
  delayMs = 400,
}: UseUpdateWindowFormParamsOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const updateParamsImmediate = useCallback(
    (values: Partial<WindowFormValues>) => {
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
