"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useWindowForm } from "../_hooks/window-form-hook";

const FieldError = ({ errors }: { errors: Array<string | undefined> }) => {
  const messages = errors.filter((error): error is string => Boolean(error));
  if (messages.length === 0) return null;
  return <p className="text-sm text-destructive">{messages.join(", ")}</p>;
};

type WindowForm = ReturnType<typeof useWindowForm>;
type WindowFormValues = WindowForm["state"]["values"];

interface WindowInputFieldProps<Name extends keyof WindowFormValues> {
  form: WindowForm;
  name: Name;
  label: string;
  type?: React.ComponentProps<typeof Input>["type"];
  parse?: (value: string) => WindowFormValues[Name];
}

export function WindowInputField<Name extends keyof WindowFormValues>({
  form,
  name,
  label,
  type = "text",
  parse,
}: WindowInputFieldProps<Name>) {
  return (
    <form.Field name={name}>
      {(field) => (
        <div className="flex flex-col gap-2">
          <Label htmlFor={field.name}>{label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type={type}
            value={(field.state.value ?? "") as string | number}
            onBlur={field.handleBlur}
            onChange={(event) => {
              const rawValue = event.target.value;
              const nextValue = parse
                ? parse(rawValue)
                : (rawValue as WindowFormValues[Name]);
              field.handleChange(nextValue as typeof field.state.value);
            }}
          />
          <FieldError errors={field.state.meta.errors} />
        </div>
      )}
    </form.Field>
  );
}

interface WindowCalendarFieldProps<Name extends keyof WindowFormValues> {
  form: WindowForm;
  name: Name;
  label: string;
  disabled?: React.ComponentProps<typeof Calendar>["disabled"];
}

export function WindowCalendarField<Name extends keyof WindowFormValues>({
  form,
  name,
  label,
  disabled,
}: WindowCalendarFieldProps<Name>) {
  const parseDateValue = (value: unknown) =>
    typeof value === "string" && value ? parseISO(value) : undefined;

  return (
    <form.Field name={name}>
      {(field) => (
        <div className="flex flex-col gap-2">
          <Label>{label}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !field.state.value && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {field.state.value
                  ? format(parseISO(field.state.value as string), "PPP")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
            >
              <Calendar
                mode="single"
                className="w-full"
                classNames={{
                  root: "w-full",
                  today: "text-foreground",
                }}
                disabled={disabled}
                selected={parseDateValue(field.state.value)}
                onSelect={(date) => {
                  const nextValue = (
                    date ? format(date, "yyyy-MM-dd") : ""
                  ) as typeof field.state.value;
                  field.handleChange(nextValue);
                }}
              />
            </PopoverContent>
          </Popover>
          <FieldError errors={field.state.meta.errors} />
        </div>
      )}
    </form.Field>
  );
}

interface WindowSelectFieldProps<Name extends keyof WindowFormValues> {
  form: WindowForm;
  name: Name;
  label: string;
  options: Array<WindowFormValues[Name]>;
  placeholder?: string;
}

export function WindowSelectField<Name extends keyof WindowFormValues>({
  form,
  name,
  label,
  options,
  placeholder = "Select option",
}: WindowSelectFieldProps<Name>) {
  return (
    <form.Field name={name}>
      {(field) => (
        <div className="flex flex-col gap-2">
          <Label>{label}</Label>
          <Select
            value={field.state.value as string}
            onValueChange={(value) =>
              field.handleChange(value as typeof field.state.value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={field.state.meta.errors} />
        </div>
      )}
    </form.Field>
  );
}
