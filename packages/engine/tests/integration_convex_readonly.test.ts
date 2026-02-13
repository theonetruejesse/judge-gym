import { describe, expect, test } from "bun:test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL;
const shouldRun = Boolean(CONVEX_URL);

describe("convex read-only integration", () => {
  test(
    "listExperimentsByTaskType returns arrays for each task type",
    async () => {
      if (!shouldRun) return;
      const client = new ConvexHttpClient(CONVEX_URL!);
      const [ecc, control, benchmark] = await Promise.all([
        client.query(api.domain.experiments.data.listExperimentsByTaskType, { task_type: "ecc" }),
        client.query(api.domain.experiments.data.listExperimentsByTaskType, {
          task_type: "control",
        }),
        client.query(api.domain.experiments.data.listExperimentsByTaskType, {
          task_type: "benchmark",
        }),
      ]);

      expect(Array.isArray(ecc)).toBe(true);
      expect(Array.isArray(control)).toBe(true);
      expect(Array.isArray(benchmark)).toBe(true);
    },
  );

  if (!shouldRun) {
    test("skipped: CONVEX_URL not set", () => {
      expect(CONVEX_URL).toBeUndefined();
    });
  }
});
