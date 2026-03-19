"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { api } from "@judge-gym/engine-convex";
import { useRouter } from "next/navigation";
import {
  experimentFormSchema,
  mergeExperimentFormDefaults,
  type ExperimentFormDefaults,
  type ExperimentFormValues,
} from "../_utils/experiment-form-schema";

interface UseExperimentFormProps {
  defaultValues?: ExperimentFormDefaults;
  selectedEvidenceIds: string[];
  onStatusChange?: (status: string | null) => void;
}

export function useExperimentForm({
  defaultValues,
  selectedEvidenceIds,
  onStatusChange,
}: UseExperimentFormProps) {
  const router = useRouter();
  const createPool = useMutation(api.packages.lab.createPool);
  const initExperiment = useMutation(api.packages.lab.initExperiment);

  const form = useForm({
    defaultValues: mergeExperimentFormDefaults(defaultValues),
    validators: {
      onSubmit: ({ value }) => {
        const result = experimentFormSchema.safeParse(value);
        if (!result.success) {
          const fields: Partial<Record<keyof ExperimentFormValues, string>> = {};

          for (const issue of result.error.issues) {
            const key = issue.path[0];
            if (typeof key !== "string") continue;
            const fieldName = key as keyof ExperimentFormValues;
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
      onStatusChange?.(null);
      if (selectedEvidenceIds.length === 0) {
        onStatusChange?.("Select at least one evidence item.");
        return;
      }

      try {
        const pool = await createPool({
          evidence_ids: selectedEvidenceIds,
        });
        const result = await initExperiment({
          experiment_config: {
            rubric_config: {
              model: value.rubric_model,
              scale_size: value.scale_size,
              concept: value.concept,
            },
            scoring_config: {
              model: value.scoring_model,
              method: value.method,
              abstain_enabled: value.abstain_enabled,
              evidence_view: value.evidence_view,
              randomizations: value.randomizations,
            },
          },
          pool_id: pool.pool_id,
        });
        onStatusChange?.("Experiment created.");
        router.replace(`/experiment/${result.experiment_id}`);
      } catch (error) {
        onStatusChange?.(
          error instanceof Error
            ? error.message
            : "Failed to create experiment.",
        );
      }
    },
  });

  return form;
}

export type { ExperimentFormValues };
