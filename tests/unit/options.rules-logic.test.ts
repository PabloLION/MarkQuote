import { describe, expect, it } from "vitest";
import { moveRule } from "../../src/surfaces/options/rules-logic.js";

describe("options/rules-logic moveRule", () => {
  it("reorders rules when moving upward", () => {
    const rules = ["a", "b", "c"];
    moveRule(rules, 2, 0);
    expect(rules).toEqual(["c", "a", "b"]);
  });

  it("reorders rules when moving downward", () => {
    const rules = ["a", "b", "c", "d"];
    moveRule(rules, 0, 2);
    expect(rules).toEqual(["b", "c", "a", "d"]);
  });

  it("ignores moves with out-of-range indices", () => {
    const rules = ["a", "b"];
    moveRule(rules, 5, 1);
    expect(rules).toEqual(["a", "b"]);
  });
});
