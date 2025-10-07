import { describe, expect, it } from "vitest";
import {
  CURRENT_OPTIONS_VERSION,
  createDefaultTitleRules,
  createDefaultUrlRules,
  DEFAULT_AMAZON_URL_PATTERN,
  DEFAULT_AMAZON_URL_REPLACE,
  DEFAULT_AMAZON_URL_SEARCH,
  DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
  DEFAULT_OPTIONS,
  DEFAULT_TEMPLATE,
  DEFAULT_WIKI_TITLE_REPLACE,
  DEFAULT_WIKI_TITLE_SEARCH,
  DEFAULT_WIKI_URL_PATTERN,
  normalizeStoredOptions,
  validateOptionsPayload,
} from "../../src/options-schema.js";

describe("options-schema", () => {
  it("validates proper options payload", () => {
    expect(validateOptionsPayload(DEFAULT_OPTIONS)).toBe(true);
    expect(validateOptionsPayload(null)).toBe(false);
    expect(validateOptionsPayload({ version: 1 })).toBe(false);
    expect(
      validateOptionsPayload({
        version: CURRENT_OPTIONS_VERSION,
        format: DEFAULT_TEMPLATE,
        titleRules: ["invalid"],
        urlRules: [],
      }),
    ).toBe(false);
    expect(
      validateOptionsPayload({
        version: CURRENT_OPTIONS_VERSION,
        format: DEFAULT_TEMPLATE,
        titleRules: createDefaultTitleRules(),
        urlRules: [123],
      }),
    ).toBe(false);
  });

  it("normalizes current snapshot with direct fields", () => {
    const snapshot = {
      options: {
        version: 1,
        format: "Title: {{title}}\nUrl: {{link}}",
        titleRules: [
          {
            urlMatch: DEFAULT_WIKI_URL_PATTERN,
            titleMatch: DEFAULT_WIKI_TITLE_SEARCH,
            titleReplace: DEFAULT_WIKI_TITLE_REPLACE,
            comment: "wiki",
            continue: true,
            disabled: false,
          },
        ],
        urlRules: [],
        rules: [
          {
            urlPattern: DEFAULT_AMAZON_URL_PATTERN,
            urlSearch: DEFAULT_AMAZON_URL_SEARCH,
            urlReplace: DEFAULT_AMAZON_URL_REPLACE,
            comment: "amazon",
            continueMatching: false,
            enabled: true,
          },
        ],
      },
    };

    const normalized = normalizeStoredOptions(snapshot);

    expect(normalized.version).toBe(CURRENT_OPTIONS_VERSION);
    expect(normalized.format.startsWith("{{TEXT}}\nTitle")).toBe(true);
    expect(normalized.titleRules[0]).toMatchObject({
      urlPattern: DEFAULT_WIKI_URL_PATTERN,
      titleSearch: DEFAULT_WIKI_TITLE_SEARCH,
      continueMatching: true,
      enabled: true,
    });
    expect(normalized.urlRules[0]).toMatchObject({
      urlPattern: DEFAULT_AMAZON_URL_PATTERN,
      urlSearch: DEFAULT_AMAZON_URL_SEARCH,
      urlReplace: DEFAULT_AMAZON_URL_REPLACE,
    });
  });

  it("normalizes legacy snapshots with combined rules and aliases", () => {
    const snapshot = {
      format: "{{link}}",
      titleRules: [],
      linkRules: [],
      rules: [
        {
          urlPattern: DEFAULT_WIKI_URL_PATTERN,
          titleMatch: DEFAULT_WIKI_TITLE_SEARCH,
          titleReplace: DEFAULT_WIKI_TITLE_REPLACE,
          urlSearch: DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
          urlReplace: "$1",
          comment: "legacy",
          fallthrough: "true",
          disabled: 0,
        },
      ],
    };

    const normalized = normalizeStoredOptions(snapshot);

    expect(normalized.titleRules).toHaveLength(1);
    expect(normalized.urlRules).toHaveLength(1);
    expect(normalized.format.startsWith("> {{TEXT}}\n")).toBe(true);
  });

  it("drops empty title rules and replaces them with defaults", () => {
    const snapshot = {
      titleRules: [
        {
          comment: "empty",
          continueMatching: "true",
          enabled: "true",
        },
        {
          urlPattern: "   ",
          titleSearch: "  ",
          titleReplace: "  ",
        },
      ],
    };

    const normalized = normalizeStoredOptions(snapshot);

    expect(normalized.titleRules).toEqual(createDefaultTitleRules());
  });

  it("drops empty combined rules when normalizing legacy snapshots", () => {
    const snapshot = {
      rules: [null, { comment: "only comment" }],
    };

    const normalized = normalizeStoredOptions(snapshot);

    expect(normalized.titleRules).toEqual(createDefaultTitleRules());
    expect(normalized.urlRules).toEqual(createDefaultUrlRules());
  });

  it("ignores url rules that are not objects", () => {
    const snapshot = {
      options: {
        version: CURRENT_OPTIONS_VERSION,
        format: DEFAULT_TEMPLATE,
        titleRules: createDefaultTitleRules(),
        urlRules: [123, null],
      },
    };

    const normalized = normalizeStoredOptions(snapshot);

    expect(normalized.urlRules).toEqual(createDefaultUrlRules());
  });

  it("drops url rules that provide no matching fields", () => {
    const snapshot = {
      options: {
        version: CURRENT_OPTIONS_VERSION,
        format: DEFAULT_TEMPLATE,
        titleRules: createDefaultTitleRules(),
        urlRules: [
          {
            comment: "noop",
            continueMatching: false,
            enabled: true,
          },
          {
            urlPattern: " ",
            urlSearch: " ",
            urlReplace: " ",
          },
        ],
      },
    };

    const normalized = normalizeStoredOptions(snapshot);

    expect(normalized.urlRules).toEqual(createDefaultUrlRules());
  });

  it("ensures default rules are present when inputs empty", () => {
    const snapshot = { options: { version: 1, format: "" } };
    const normalized = normalizeStoredOptions(snapshot);
    expect(normalized.titleRules).toEqual(createDefaultTitleRules());
    expect(normalized.urlRules).toEqual(createDefaultUrlRules());
  });

  it("creates default rule collections", () => {
    expect(createDefaultTitleRules()).toEqual([
      expect.objectContaining({ urlPattern: DEFAULT_WIKI_URL_PATTERN }),
    ]);
    expect(createDefaultUrlRules()).toHaveLength(3);
  });
});
