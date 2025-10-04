import { describe, expect, it, vi } from "vitest";
import { DEFAULT_OPTIONS } from "../../src/options-schema.js";
import {
  cloneOptions,
  createDraft,
  DEFAULT_PREVIEW_SAMPLE,
  normalizeFormat,
  sanitizeTitleRule,
  sanitizeUrlRule,
  validateRegex,
} from "../../src/surfaces/options/state.js";

const createTextarea = (value: string | null) => {
  if (value === null) {
    return null;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  return textarea;
};

describe("options/state", () => {
  it("clones options deeply", () => {
    const draft = cloneOptions(DEFAULT_OPTIONS);
    draft.titleRules[0].comment = "Changed";
    expect(DEFAULT_OPTIONS.titleRules[0].comment).not.toBe("Changed");
  });

  it("creates draft from defaults", () => {
    const draft = createDraft();
    expect(draft.format).toBe(DEFAULT_OPTIONS.format);
    expect(draft.titleRules).not.toBe(DEFAULT_OPTIONS.titleRules);
  });

  it("sanitizes title rules and url rules", () => {
    const title = sanitizeTitleRule({
      urlPattern: " example.com ",
      titleSearch: " First",
      titleReplace: "Second",
      comment: " note ",
      continueMatching: 0 as unknown as boolean,
      enabled: false,
    });

    expect(title.urlPattern).toBe("example.com");
    expect(title.titleSearch).toBe("First");
    expect(title.comment).toBe("note");
    expect(title.continueMatching).toBe(false);
    expect(title.enabled).toBe(false);

    const url = sanitizeUrlRule({
      urlPattern: " example.com ",
      urlSearch: " First",
      urlReplace: "Second",
      comment: " note ",
      continueMatching: 1 as unknown as boolean,
      enabled: 0 as unknown as boolean,
    });

    expect(url.urlPattern).toBe("example.com");
    expect(url.urlSearch).toBe("First");
    expect(url.comment).toBe("note");
    expect(url.continueMatching).toBe(true);
    expect(url.enabled).toBe(true);
  });

  it("validates safe regex and rejects unsafe patterns", () => {
    expect(validateRegex("^example$")).toBe(true);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(validateRegex("[[[")).toBe(false);
    expect(validateRegex("(unbalanced")).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("normalizes format from textarea or fallback", () => {
    const draft = createDraft();
    const textarea = createTextarea("Custom format");
    expect(normalizeFormat(textarea, draft)).toBe("Custom format");
    expect(normalizeFormat(null, draft)).toBe(draft.format);
  });

  it("resets preview sample to defaults", () => {
    const draft = createDraft();
    const textarea = createTextarea(null);
    expect(normalizeFormat(textarea, draft)).toBe(draft.format);
    expect(DEFAULT_PREVIEW_SAMPLE.title).toBe("Markdown - Wikipedia");
  });
});
