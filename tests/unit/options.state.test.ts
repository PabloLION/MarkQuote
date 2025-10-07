import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPTIONS,
  SAFE_REGEX_ALLOWLIST,
  type TitleRule,
  type UrlRule,
} from "../../src/options-schema.js";
import {
  cloneOptions,
  cloneTitleRule,
  cloneUrlRule,
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

  it("clones individual rules without mutating the source", () => {
    const malformedTitle = {
      urlPattern: undefined,
      titleSearch: undefined,
      titleReplace: undefined,
      comment: undefined,
      continueMatching: undefined,
      enabled: undefined,
    } as unknown as TitleRule;
    const titleClone = cloneTitleRule(malformedTitle);
    titleClone.comment = "patched";
    expect(malformedTitle.comment).toBeUndefined();

    const malformedUrl = {
      urlPattern: undefined,
      urlSearch: undefined,
      urlReplace: undefined,
      comment: undefined,
      continueMatching: undefined,
      enabled: undefined,
    } as unknown as UrlRule;
    const urlClone = cloneUrlRule(malformedUrl);
    urlClone.comment = "patched";
    expect(malformedUrl.comment).toBeUndefined();
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
    expect(validateRegex("")).toBe(false);
    consoleSpy.mockRestore();
  });

  it("logs when regex compilation throws", () => {
    const originalRegExp = globalThis.RegExp;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    SAFE_REGEX_ALLOWLIST.add("safe pattern");
    globalThis.RegExp = vi.fn(() => {
      throw new Error("boom");
    }) as unknown as RegExpConstructor;

    try {
      expect(validateRegex("safe pattern")).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Invalid regex pattern.",
        expect.objectContaining({
          pattern: expect.objectContaining({ preview: expect.any(String) }),
        }),
      );
    } finally {
      SAFE_REGEX_ALLOWLIST.delete("safe pattern");
      globalThis.RegExp = originalRegExp;
      consoleSpy.mockRestore();
    }
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
