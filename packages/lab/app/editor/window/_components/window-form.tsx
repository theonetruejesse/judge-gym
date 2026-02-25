"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MODEL_OPTIONS } from "@/lib/ui-maps";
import { isValid, parseISO } from "date-fns";
import { useEffect } from "react";
import { useWindowForm } from "../_hooks/window-form-hook";
import { useUpdateWindowFormParams } from "../_hooks/update-params-hook";
import type {
  WindowFormDefaults,
  WindowFormValues,
} from "../_utils/window-form-schema";
import {
  WindowCalendarField,
  WindowInputField,
  WindowSelectField,
} from "./window-fields";

interface WindowFormProps {
  defaultValues?: WindowFormDefaults;
}

function WindowFormParamsSync({ values }: { values: WindowFormValues }) {
  const updateParams = useUpdateWindowFormParams({ delayMs: 400 });

  useEffect(() => {
    updateParams(values);
  }, [updateParams, values]);

  return null;
}

function WindowFormDateRangeSync({
  form,
  values,
}: {
  form: ReturnType<typeof useWindowForm>;
  values: WindowFormValues;
}) {
  useEffect(() => {
    if (!values.start_date || !values.end_date) return;

    const startDate = parseISO(values.start_date);
    const endDate = parseISO(values.end_date);
    if (!isValid(startDate) || !isValid(endDate)) return;

    if (startDate > endDate) {
      form.setFieldValue("end_date", "");
    }
  }, [form, values.end_date, values.start_date]);

  return null;
}

export function WindowForm({ defaultValues }: WindowFormProps) {
  const form = useWindowForm({ defaultValues });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Evidence Window
        </CardTitle>
        <CardDescription>
          Define the evidence time window, starting count, and scraping model.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <>
                <WindowFormParamsSync values={values} />
                <WindowFormDateRangeSync form={form} values={values} />
              </>
            )}
          </form.Subscribe>
          <WindowInputField form={form} name="query" label="Query" />
          <WindowInputField form={form} name="country" label="Country" />

          <div className="grid grid-cols-2 gap-4">
            <WindowCalendarField
              form={form}
              name="start_date"
              label="Start Date"
            />
            <form.Subscribe selector={(state) => state.values.start_date}>
              {(startDate) => (
                <WindowCalendarField
                  form={form}
                  name="end_date"
                  label="End Date"
                  disabled={
                    startDate ? [{ before: parseISO(startDate as string) }] : []
                  }
                />
              )}
            </form.Subscribe>
          </div>

          <WindowSelectField
            form={form}
            name="model"
            label="Evidence Model"
            options={MODEL_OPTIONS}
            placeholder="Select model"
          />

          <WindowInputField
            form={form}
            name="evidence_limit"
            label="Starting Count"
            type="number"
            parse={(value) => Number(value)}
          />

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([, isSubmitting]) => (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-fit uppercase tracking-wider"
              >
                {isSubmitting ? "Creating..." : "Create Window & Collect"}
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
              // todo, color not displaying
              return (
                <p className="text-sm text-destructive">
                  {messages.join(", ")}
                </p>
              );
            }}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
