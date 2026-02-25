"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MODEL_OPTIONS,
  RANDOMIZATION_LABELS,
  SCORING_METHOD_LABELS,
  VIEW_LABELS,
} from "@/lib/ui-maps";
import { useEffect } from "react";
import { useExperimentForm } from "../_hooks/experiment-form-hook";
import { useUpdateExperimentFormParams } from "../_hooks/update-params-hook";
import type {
  ExperimentFormDefaults,
  ExperimentFormValues,
} from "../_utils/experiment-form-schema";

interface ExperimentFormProps {
  defaultValues?: ExperimentFormDefaults;
  selectedEvidenceIds: string[];
  onStatusChange?: (status: string | null) => void;
}

function renderFieldError(error: unknown[] | string | undefined) {
  if (!error || (Array.isArray(error) && error.length === 0)) return null;
  const message = Array.isArray(error)
    ? error.filter((item): item is string => typeof item === "string").join(", ")
    : error;
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function ExperimentFormParamsSync({ values }: { values: ExperimentFormValues }) {
  const updateParams = useUpdateExperimentFormParams({ delayMs: 400 });

  useEffect(() => {
    updateParams(values);
  }, [updateParams, values]);

  return null;
}

export function ExperimentForm({
  defaultValues,
  selectedEvidenceIds,
  onStatusChange,
}: ExperimentFormProps) {
  const form = useExperimentForm({
    defaultValues,
    selectedEvidenceIds,
    onStatusChange,
  });

  return (
    <Card className="border-border bg-card/80">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Experiment Editor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-5"
        >
          <form.Subscribe selector={(state) => state.values}>
            {(values) => <ExperimentFormParamsSync values={values} />}
          </form.Subscribe>

          <form.Field name="concept">
            {(field) => (
              <div>
                <Input
                  placeholder="Experiment concept"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {renderFieldError(
                  field.state.meta.isTouched ? field.state.meta.errors : undefined,
                )}
              </div>
            )}
          </form.Field>

          <div className="grid gap-4 md:grid-cols-2">
            <form.Field name="rubric_model">
              {(field) => (
                <div>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value as typeof field.state.value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Rubric model" />
                    </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError(
                  field.state.meta.isTouched ? field.state.meta.errors : undefined,
                )}
              </div>
            )}
          </form.Field>

            <form.Field name="scoring_model">
              {(field) => (
                <div>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value as typeof field.state.value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Scoring model" />
                    </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError(
                  field.state.meta.isTouched ? field.state.meta.errors : undefined,
                )}
              </div>
            )}
          </form.Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <form.Field name="scale_size">
              {(field) => (
                <div>
                  <Input
                    type="number"
                    min={1}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(Number(event.target.value))
                    }
                  />
                  {renderFieldError(
                    field.state.meta.isTouched
                      ? field.state.meta.errors
                      : undefined,
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="method">
              {(field) => (
                <div>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value as typeof field.state.value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Scoring method" />
                    </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCORING_METHOD_LABELS).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                {renderFieldError(
                  field.state.meta.isTouched ? field.state.meta.errors : undefined,
                )}
              </div>
            )}
          </form.Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <form.Field name="evidence_view">
              {(field) => (
                <div>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value as typeof field.state.value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Evidence view" />
                    </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VIEW_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError(
                  field.state.meta.isTouched ? field.state.meta.errors : undefined,
                )}
              </div>
            )}
          </form.Field>

            <form.Field name="abstain_enabled">
              {(field) => (
                <div className="flex h-10 items-center gap-2">
                  <Checkbox
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(Boolean(checked))
                    }
                  />
                  <span className="text-xs">Abstain enabled</span>
                </div>
              )}
            </form.Field>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest opacity-50">
              Randomizations
            </p>
            <div className="grid gap-2">
              {Object.entries(RANDOMIZATION_LABELS).map(([key, label]) => (
                <form.Field key={key} name="randomizations">
                  {(field) => {
                    const value =
                      key as ExperimentFormValues["randomizations"][number];
                    return (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={field.state.value.includes(value)}
                          onCheckedChange={(checked) => {
                            const isChecked = Boolean(checked);
                            if (isChecked) {
                              field.handleChange([...field.state.value, value]);
                            } else {
                              field.handleChange(
                                field.state.value.filter((item) => item !== value),
                              );
                            }
                          }}
                        />
                        <span className="text-xs">{label}</span>
                      </div>
                    );
                  }}
                </form.Field>
              ))}
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-widest opacity-50">
            Form settings are shareable via the URL.
          </p>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([, isSubmitting]) => (
              <Button
                type="submit"
                className="w-full text-[10px] uppercase tracking-wider"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Experiment"}
              </Button>
            )}
          </form.Subscribe>

          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(submitError) => {
              if (!submitError || typeof submitError !== "object") return null;
              const fieldErrors =
                "fields" in submitError ? submitError.fields : null;
              if (!fieldErrors || typeof fieldErrors !== "object") return null;

              const messages = Object.values(fieldErrors).filter(
                (error): error is string =>
                  typeof error === "string" && error.length > 0,
              );
              if (messages.length === 0) return null;

              return (
                <p className="text-xs text-destructive">{messages.join(", ")}</p>
              );
            }}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
