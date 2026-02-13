import { describe, expect, test } from "bun:test";
import { generateLabelMapping } from "../convex/platform/utils/randomize";

describe("randomize", () => {
  test("generateLabelMapping is deterministic with a seed", () => {
    const first = generateLabelMapping(4, 12345);
    const second = generateLabelMapping(4, 12345);
    expect(first).toEqual(second);
  });

  test("generateLabelMapping returns unique IDs and valid values", () => {
    const mapping = generateLabelMapping(5, 999);
    const keys = Object.keys(mapping);
    const values = Object.values(mapping);

    expect(keys.length).toBe(5);
    expect(new Set(keys).size).toBe(5);
    expect(new Set(values).size).toBe(5);
    expect(values.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});
