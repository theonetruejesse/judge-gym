import { describe, expect, test } from "bun:test";
import { dempsterCombine, massFromVerdict } from "../convex/utils/dst";

describe("dst", () => {
  test("massFromVerdict normalizes the key", () => {
    const mass = massFromVerdict([2, 1]);
    expect([...mass.entries()]).toEqual([["1,2", 1]]);
  });

  test("dempsterCombine merges identical sets with no conflict", () => {
    const m1 = massFromVerdict([1]);
    const m2 = massFromVerdict([1]);
    const { combined, conflict } = dempsterCombine(m1, m2);

    expect(conflict).toBe(0);
    expect([...combined.entries()]).toEqual([["1", 1]]);
  });

  test("dempsterCombine reports full conflict for disjoint sets", () => {
    const m1 = massFromVerdict([1]);
    const m2 = massFromVerdict([2]);
    const { combined, conflict } = dempsterCombine(m1, m2);

    expect(conflict).toBe(1);
    expect([...combined.entries()]).toEqual([]);
  });

  test("dempsterCombine intersects overlapping sets", () => {
    const m1 = massFromVerdict([1, 2]);
    const m2 = massFromVerdict([2, 3]);
    const { combined, conflict } = dempsterCombine(m1, m2);

    expect(conflict).toBe(0);
    expect([...combined.entries()]).toEqual([["2", 1]]);
  });
});
