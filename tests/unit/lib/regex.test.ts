import { afterEach, describe, expect, it, vi } from "vitest";

import {
  compileRegex,
  isPatternAllowed,
  MAX_REGEX_PATTERN_LENGTH,
} from "../../../src/lib/regex.js";
import { SAFE_REGEX_ALLOWLIST } from "../../../src/options-schema.js";

describe("regex helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows patterns in the safe allowlist", () => {
    const pattern = "allowlisted";
    SAFE_REGEX_ALLOWLIST.add(pattern);
    expect(isPatternAllowed(pattern)).toBe(true);
    SAFE_REGEX_ALLOWLIST.delete(pattern);
  });

  it("rejects unsafe patterns", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(compileRegex("[[[", () => {})).toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("respects the maximum pattern length boundary", () => {
    const allowed = "a".repeat(MAX_REGEX_PATTERN_LENGTH);
    const disallowed = `${allowed}b`;

    expect(compileRegex(allowed, () => {})).toBeInstanceOf(RegExp);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(compileRegex(disallowed, () => {})).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Regex pattern exceeds maximum length.",
      expect.objectContaining({ length: MAX_REGEX_PATTERN_LENGTH + 1 }),
    );
    consoleSpy.mockRestore();
  });
});
