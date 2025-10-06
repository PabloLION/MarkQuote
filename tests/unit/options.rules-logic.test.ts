import { describe, expect, it } from "vitest";
import {
  filteredRulesInternal,
  handleRuleInputChangeFor,
  moveRule,
  validateRulesFor,
} from "../../src/surfaces/options/rules-logic.js";
import type { RuleConfig } from "../../src/surfaces/options/rules-types.js";

type FakeRule = {
  pattern: string;
  search: string;
  replace: string;
  continueMatching: boolean;
  enabled: boolean;
};

const createConfig = (rules: FakeRule[]): RuleConfig<FakeRule> => {
  const body = document.createElement("tbody");
  rules.forEach((_rule, index) => {
    const row = document.createElement("tr");
    row.dataset.index = String(index);
    const patternInput = document.createElement("input");
    patternInput.dataset.field = "pattern";
    const searchInput = document.createElement("input");
    searchInput.dataset.field = "search";
    const replaceInput = document.createElement("input");
    replaceInput.dataset.field = "replace";
    row.append(patternInput, searchInput, replaceInput);
    body.append(row);
  });

  const config: RuleConfig<FakeRule> = {
    scope: "title",
    getRules: () => rules,
    setRules: (next: FakeRule[]) => {
      rules.splice(0, rules.length, ...next);
    },
    body,
    clearButton: document.createElement("button"),
    confirmClearButton: document.createElement("button"),
    clearStatusElement: document.createElement("div"),
    saveButton: document.createElement("button"),
    unsavedIndicator: document.createElement("span"),
    fields: [
      { key: "pattern", placeholder: "pattern" },
      { key: "search", placeholder: "search" },
      { key: "replace", placeholder: "replace" },
    ],
    fieldKeys: {
      pattern: "pattern",
      search: "search",
      replace: "replace",
    },
    createEmpty: () => ({
      pattern: "",
      search: "",
      replace: "",
      continueMatching: false,
      enabled: true,
    }),
    sanitize: (rule) => rule,
    hasContent: (rule) => rule.pattern.trim().length > 0,
    messages: {
      missingPattern: "Missing pattern",
      invalidPattern: "Invalid pattern",
      missingSearchForReplace: "Missing search",
      invalidSearch: "Invalid search",
      cleared: "cleared",
      removed: "removed",
    },
  } satisfies RuleConfig<FakeRule>;

  return config;
};

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

  it("ignores moves when indices are equal", () => {
    const rules = ["a", "b", "c"];
    moveRule(rules, 1, 1);
    expect(rules).toEqual(["a", "b", "c"]);
  });

  it("ignores moves with negative indices", () => {
    const rules = ["a", "b", "c"];
    moveRule(rules, -1, 1);
    moveRule(rules, 1, -2);
    expect(rules).toEqual(["a", "b", "c"]);
  });

  it("clamps target index when it exceeds list length", () => {
    const rules = ["a", "b", "c"];
    moveRule(rules, 0, 10);
    expect(rules).toEqual(["a", "b", "c"]);
  });

  it("filters rules and trims them", () => {
    const rules: FakeRule[] = [
      {
        pattern: " value",
        search: "",
        replace: "",
        continueMatching: true,
        enabled: true,
      },
    ];
    const config = {
      ...createConfig(rules),
      sanitize: (rule: FakeRule) => ({
        ...rule,
        pattern: rule.pattern.trim(),
      }),
      hasContent: (rule: FakeRule) => Boolean(rule.pattern),
    } satisfies RuleConfig<FakeRule>;

    const filtered = filteredRulesInternal(config);
    expect(filtered[0].pattern).toBe("value");
  });

  it("updates checkbox fields via handleRuleInputChange", () => {
    const rules: FakeRule[] = [
      {
        pattern: "value",
        search: "a",
        replace: "b",
        continueMatching: false,
        enabled: true,
      },
    ];
    const config = createConfig(rules);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.index = "0";
    checkbox.dataset.field = "enabled";
    checkbox.checked = false;

    const changed = handleRuleInputChangeFor(config, checkbox);
    expect(changed).toBe(true);
    expect(rules[0].enabled).toBe(false);

    const invalid = document.createElement("input");
    invalid.dataset.index = "9";
    invalid.dataset.field = "enabled";
    expect(handleRuleInputChangeFor(config, invalid)).toBe(false);
  });

  it("returns false when field descriptor is missing", () => {
    const rules: FakeRule[] = [
      { pattern: "value", search: "", replace: "", continueMatching: false, enabled: true },
    ];
    const config = createConfig(rules);
    const input = document.createElement("input");
    input.dataset.index = "0";
    input.dataset.field = "unknown";
    input.value = "next";

    expect(handleRuleInputChangeFor(config, input)).toBe(false);
  });

  it("toggles continueMatching checkbox state", () => {
    const rules: FakeRule[] = [
      { pattern: "value", search: "", replace: "", continueMatching: false, enabled: true },
    ];
    const config = createConfig(rules);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = false;
    checkbox.dataset.index = "0";
    checkbox.dataset.field = "continueMatching";

    const changed = handleRuleInputChangeFor(config, checkbox);
    expect(changed).toBe(true);
    expect(rules[0].continueMatching).toBe(true);
  });

  it("respects trimLeading=false descriptors", () => {
    const rules: FakeRule[] = [
      { pattern: "value", search: "", replace: "", continueMatching: false, enabled: true },
    ];
    const config = {
      ...createConfig(rules),
      fields: [
        { key: "pattern", placeholder: "pattern" },
        { key: "search", placeholder: "search", trimLeading: false },
        { key: "replace", placeholder: "replace" },
      ],
    } satisfies RuleConfig<FakeRule>;

    const input = document.createElement("input");
    input.dataset.index = "0";
    input.dataset.field = "search";
    input.value = "    spaced";

    const changed = handleRuleInputChangeFor(config, input);
    expect(changed).toBe(true);
    expect(rules[0].search).toBe("    spaced");
  });

  it("validates rule fields and marks invalid inputs", () => {
    const rules: FakeRule[] = [
      {
        pattern: "",
        search: "unsafe[[[",
        replace: "value",
        continueMatching: false,
        enabled: true,
      },
    ];
    const config = {
      ...createConfig(rules),
      hasContent: () => true,
    } satisfies RuleConfig<FakeRule>;
    const { valid, message } = validateRulesFor(config);
    expect(valid).toBe(false);
    expect(message).toBe("Missing pattern");
    expect(config.body.querySelector("[aria-invalid='true']")).not.toBeNull();
  });

  it("flags missing search when replace has content", () => {
    const rules: FakeRule[] = [
      {
        pattern: "pattern",
        search: "",
        replace: "value",
        continueMatching: false,
        enabled: true,
      },
    ];
    const config = {
      ...createConfig(rules),
      hasContent: () => true,
    } satisfies RuleConfig<FakeRule>;

    const { valid, message } = validateRulesFor(config);
    expect(valid).toBe(false);
    expect(message).toBe("Missing search");
    const searchInput = config.body.querySelector<HTMLInputElement>("input[data-field='search']");
    expect(searchInput?.getAttribute("aria-invalid")).toBe("true");
  });

  it("flags invalid search patterns", () => {
    const rules: FakeRule[] = [
      {
        pattern: "pattern",
        search: "unsafe[[[",
        replace: "value",
        continueMatching: false,
        enabled: true,
      },
    ];
    const config = {
      ...createConfig(rules),
      hasContent: () => true,
    } satisfies RuleConfig<FakeRule>;

    const { valid, message } = validateRulesFor(config);
    expect(valid).toBe(false);
    expect(message).toBe("Invalid search");
    const searchInput = config.body.querySelector<HTMLInputElement>("input[data-field='search']");
    expect(searchInput?.getAttribute("aria-invalid")).toBe("true");
  });
});
