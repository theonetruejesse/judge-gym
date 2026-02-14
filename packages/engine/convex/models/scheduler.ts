import { zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineTable } from "convex/server";
import z from "zod";

export const SchedulerStateTableSchema = z.object({
  key: z.string(),
  locked_until: z.number().optional(),
  next_tick_at: z.number().optional(),
  updated_at: z.number(),
});

export const SchedulerState = defineTable(
  zodOutputToConvex(SchedulerStateTableSchema),
);
