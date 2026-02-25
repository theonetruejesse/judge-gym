"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { api } from "@judge-gym/engine";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DEFAULT_WINDOW_FORM_VALUES,
  mergeWindowFormDefaults,
  windowFormSchema,
  type WindowFormDefaults,
  type WindowFormValues,
} from "../_utils/window-form-schema";

interface UseWindowFormProps {
  defaultValues?: WindowFormDefaults;
}

export const useWindowForm = ({ defaultValues }: UseWindowFormProps) => {
  const router = useRouter();
  const createWindowForm = useMutation(api.packages.lab.createWindowForm);

  const form = useForm({
    defaultValues: mergeWindowFormDefaults(defaultValues),
    validators: {
      onSubmit: ({ value }) => {
        const result = windowFormSchema.safeParse(value);
        if (!result.success) {
          const fields: Partial<Record<keyof WindowFormValues, string>> = {};

          for (const issue of result.error.issues) {
            const key = issue.path[0];
            if (typeof key !== "string") continue;

            const fieldName = key as keyof WindowFormValues;
            if (!fields[fieldName]) {
              fields[fieldName] = issue.message;
            }
          }

          return { fields };
        }

        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const { evidence_limit, ...evidence_window } = value;
      const { window_id, window_tag } = await createWindowForm({
        evidence_window,
        evidence_limit,
      });
      toast("Window created.", {
        description: `Collecting evidence for ${window_tag}...`,
      });
      router.push(`/`);
    },
  });

  return form;
};

export type { WindowFormValues };
export { DEFAULT_WINDOW_FORM_VALUES };
