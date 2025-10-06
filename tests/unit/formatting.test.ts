import { describe, expect, it, vi } from "vitest";

import { applyTitleRules, applyUrlRules, formatWithOptions } from "../../src/formatting.js";
import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
  DEFAULT_CHATGPT_UTM_TRAILING_SEARCH,
  DEFAULT_CHATGPT_UTM_URL_PATTERN,
  DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE,
  DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH,
  type OptionsPayload,
  SAFE_REGEX_ALLOWLIST,
  type TitleRule,
  type UrlRule,
} from "../../src/options-schema.js";

describe("formatWithOptions", () => {
  it("applies title and URL transforms when URL matches", () => {
    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: "> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})",
      titleRules: [
        {
          urlPattern: "example.com",
          titleSearch: "Example",
          titleReplace: "Sample",
          comment: "",
          continueMatching: false,
          enabled: true,
        },
      ],
      urlRules: [
        {
          urlPattern: "example.com",
          urlSearch: "http",
          urlReplace: "https",
          comment: "",
          continueMatching: false,
          enabled: true,
        },
      ],
    };

    const result = formatWithOptions(options, {
      text: "Quote",
      title: "Example Article",
      url: "http://example.com",
    });

    expect(result).toContain("[Sample Article](https://example.com)");
  });

  it("preserves indentation for multiline text replacements", () => {
    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: "> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})",
      titleRules: [],
      urlRules: [],
    };

    const output = formatWithOptions(options, {
      text: "First line\nSecond line",
      title: "Article",
      url: "https://example.com",
    });

    expect(output).toContain("> First line");
    expect(output).toContain("\n> Second line");
  });

  it("returns transformed title and URL independently of template", () => {
    const titleRules: TitleRule[] = [
      {
        urlPattern: "nytimes",
        titleSearch: "Opinion",
        titleReplace: "Column",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const urlRules: UrlRule[] = [
      {
        urlPattern: "nytimes",
        urlSearch: "http",
        urlReplace: "https",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const transformedTitle = applyTitleRules(
      titleRules,
      "Opinion Piece",
      "http://nytimes.com/story",
    );
    const transformedUrl = applyUrlRules(urlRules, "http://nytimes.com/story");
    expect(transformedTitle).toBe("Column Piece");
    expect(transformedUrl).toBe("https://nytimes.com/story");
  });

  it("stops applying subsequent title rules when continueMatching is false", () => {
    const rules: TitleRule[] = [
      {
        urlPattern: "",
        titleSearch: "First",
        titleReplace: "Second",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
      {
        urlPattern: "",
        titleSearch: "Second",
        titleReplace: "Third",
        comment: "",
        continueMatching: true,
        enabled: true,
      },
    ];

    const result = applyTitleRules(rules, "First Article", "https://example.com");
    expect(result).toBe("Second Article");
  });

  it("continues applying URL rules when continueMatching is true", () => {
    const rules: UrlRule[] = [
      {
        urlPattern: "",
        urlSearch: "^http://",
        urlReplace: "https://",
        comment: "",
        continueMatching: true,
        enabled: true,
      },
      {
        urlPattern: "",
        urlSearch: "example",
        urlReplace: "sample",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const result = applyUrlRules(rules, "http://example.com/article");
    expect(result).toBe("https://sample.com/article");
  });

  it("continues applying title rules when continueMatching is true", () => {
    const rules: TitleRule[] = [
      {
        urlPattern: "",
        titleSearch: "First",
        titleReplace: "Second",
        comment: "",
        continueMatching: true,
        enabled: true,
      },
      {
        urlPattern: "",
        titleSearch: "Second",
        titleReplace: "Third",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const result = applyTitleRules(rules, "First Article", "https://example.com");
    expect(result).toBe("Third Article");
  });

  it("skips disabled title rules", () => {
    const rules: TitleRule[] = [
      {
        urlPattern: "example.com",
        titleSearch: "Example",
        titleReplace: "Sample",
        comment: "",
        continueMatching: false,
        enabled: false,
      },
      {
        urlPattern: "example.com",
        titleSearch: "Article",
        titleReplace: "Post",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const result = applyTitleRules(rules, "Example Article", "https://example.com");
    expect(result).toBe("Example Post");
  });

  it("skips disabled URL rules", () => {
    const rules: UrlRule[] = [
      {
        urlPattern: "example.com",
        urlSearch: "http",
        urlReplace: "https",
        comment: "",
        continueMatching: false,
        enabled: false,
      },
      {
        urlPattern: "example.com",
        urlSearch: "example",
        urlReplace: "sample",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const result = applyUrlRules(rules, "http://example.com");
    expect(result).toBe("http://sample.com");
  });

  it("removes chatgpt utm query parameters via chained defaults", () => {
    const rules: UrlRule[] = [
      {
        urlPattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
        urlSearch: DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH,
        urlReplace: DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE,
        comment: "",
        continueMatching: true,
        enabled: true,
      },
      {
        urlPattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
        urlSearch: DEFAULT_CHATGPT_UTM_TRAILING_SEARCH,
        urlReplace: DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
        comment: "",
        continueMatching: true,
        enabled: true,
      },
    ];

    const chainedResult = applyUrlRules(
      rules,
      "https://example.com/article?utm_source=chatgpt.com&ref=home&utm_source=chatgpt.com",
    );
    expect(chainedResult).toBe("https://example.com/article?ref=home");

    const soloResult = applyUrlRules(rules, "https://example.com/article?utm_source=chatgpt.com");
    expect(soloResult).toBe("https://example.com/article");
  });

  it("skips unsafe regex patterns and logs errors", () => {
    const rules: TitleRule[] = [
      {
        urlPattern: "",
        titleSearch: "[[[",
        titleReplace: "Unsafe",
        comment: "",
        continueMatching: true,
        enabled: true,
      },
    ];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = applyTitleRules(rules, "Example", "https://example.com");
    expect(result).toBe("Example");
    const [, details] = consoleSpy.mock.calls[0] ?? [];
    expect(details?.preview).toContain("[[[");
    consoleSpy.mockRestore();
  });

  it("skips invalid regex patterns and preserves original text", () => {
    const rules: TitleRule[] = [
      {
        urlPattern: "",
        titleSearch: "(unbalanced",
        titleReplace: "Broken",
        comment: "",
        continueMatching: true,
        enabled: true,
      },
    ];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = applyTitleRules(rules, "Example", "https://example.com");
    expect(result).toBe("Example");
    const patternCalls = consoleSpy.mock.calls
      .map(([, details]) => details?.pattern?.preview ?? details?.preview)
      .filter(Boolean);
    expect(patternCalls[0]).toContain("(unbalanced");
    consoleSpy.mockRestore();
  });

  it("skips url rules when regex compilation fails", () => {
    const rules: UrlRule[] = [
      {
        urlPattern: "",
        urlSearch: "(unbalanced",
        urlReplace: "value",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = applyUrlRules(rules, "https://example.com");
    expect(result).toBe("https://example.com");
    const patternCalls = consoleSpy.mock.calls
      .map(([, details]) => details?.pattern?.preview ?? details?.preview)
      .filter(Boolean);
    expect(patternCalls[0]).toContain("(unbalanced");
    consoleSpy.mockRestore();
  });

  it("treats empty title search as a match and short-circuits the chain", () => {
    const rules: TitleRule[] = [
      {
        urlPattern: "",
        titleSearch: "",
        titleReplace: "unused",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
      {
        urlPattern: "",
        titleSearch: "Original",
        titleReplace: "Modified",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const result = applyTitleRules(rules, "Original", "https://example.com");
    expect(result).toBe("Original");
  });

  it("treats empty url search as a match and short-circuits", () => {
    const rules: UrlRule[] = [
      {
        urlPattern: "",
        urlSearch: "",
        urlReplace: "unused",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
      {
        urlPattern: "",
        urlSearch: "example",
        urlReplace: "sample",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const result = applyUrlRules(rules, "https://example.com");
    expect(result).toBe("https://example.com");
  });

  it("logs and skips invalid regex replacements", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalRegExp = globalThis.RegExp;
    const failingRegExp = vi.fn(() => {
      throw new Error("RegExp failure");
    }) as unknown as RegExpConstructor;
    globalThis.RegExp = failingRegExp;

    const pattern = "(.+)+";
    const wasAllowlisted = SAFE_REGEX_ALLOWLIST.has(pattern);
    SAFE_REGEX_ALLOWLIST.add(pattern);

    try {
      const rules: TitleRule[] = [
        {
          urlPattern: "",
          titleSearch: pattern,
          titleReplace: "ignored",
          comment: "",
          continueMatching: false,
          enabled: true,
        },
      ];

      const result = applyTitleRules(rules, "Title", "https://example.com");

      expect(result).toBe("Title");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to apply regex replacement.",
        expect.objectContaining({ pattern: expect.objectContaining({ preview: pattern }) }),
      );
    } finally {
      globalThis.RegExp = originalRegExp;
      if (!wasAllowlisted) {
        SAFE_REGEX_ALLOWLIST.delete(pattern);
      }
      consoleSpy.mockRestore();
    }
  });

  it("logs and skips invalid URL pattern matches", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalRegExp = globalThis.RegExp;
    const failingRegExp = vi.fn(() => {
      throw new Error("RegExp failure");
    }) as unknown as RegExpConstructor;
    globalThis.RegExp = failingRegExp;

    const pattern = "allowlisted";
    const wasAllowlisted = SAFE_REGEX_ALLOWLIST.has(pattern);
    SAFE_REGEX_ALLOWLIST.add(pattern);

    try {
      const rules: UrlRule[] = [
        {
          urlPattern: pattern,
          urlSearch: "a",
          urlReplace: "b",
          comment: "",
          continueMatching: false,
          enabled: true,
        },
      ];

      const result = applyUrlRules(rules, "https://example.com");

      expect(result).toBe("https://example.com");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Invalid URL pattern; skipping rule.",
        expect.objectContaining({ pattern: expect.objectContaining({ preview: pattern }) }),
      );
    } finally {
      globalThis.RegExp = originalRegExp;
      if (!wasAllowlisted) {
        SAFE_REGEX_ALLOWLIST.delete(pattern);
      }
      consoleSpy.mockRestore();
    }
  });

  it("allows explicit bypass for vetted complex regex patterns", () => {
    const pattern = "(.+)+";
    const wasAllowlisted = SAFE_REGEX_ALLOWLIST.has(pattern);
    SAFE_REGEX_ALLOWLIST.add(pattern);

    const rules: TitleRule[] = [
      {
        urlPattern: "",
        titleSearch: pattern,
        titleReplace: "ok",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ];

    const output = applyTitleRules(rules, "value", "https://example.com");
    expect(output).toBe("ok");

    if (!wasAllowlisted) {
      SAFE_REGEX_ALLOWLIST.delete(pattern);
    }
  });
});
