import { describe, expect, test } from "bun:test";
import { computeStageStatus } from "../convex/domain/runs/workflows/runs_run_state";

describe("run_state computeStageStatus", () => {
  test("pending when total is zero", () => {
    expect(computeStageStatus({ total: 0, completed: 0, failed: 0 }))
      .toBe("pending");
  });

  test("running when work remains", () => {
    expect(computeStageStatus({ total: 10, completed: 3, failed: 1 }))
      .toBe("running");
  });

  test("complete when all finished without failures", () => {
    expect(computeStageStatus({ total: 5, completed: 5, failed: 0 }))
      .toBe("complete");
  });

  test("failed when all finished with failures", () => {
    expect(computeStageStatus({ total: 5, completed: 3, failed: 2 }))
      .toBe("failed");
  });
});
