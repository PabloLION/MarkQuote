import { describe, expect, it } from "vitest";
import type { TitleRule, UrlRule } from "../../src/options-schema.js";
import { createRuleChangeTracker } from "../../src/surfaces/options/helpers/rule-change-tracker.js";
import type {
  DragScope,
  RuleConfig,
  RuleWithFlags,
} from "../../src/surfaces/options/rules-types.js";

function createRuleConfig<T extends RuleWithFlags>(
  scope: DragScope,
  overrides: Partial<RuleConfig<T>> = {},
): RuleConfig<T> {
  const body = document.createElement("tbody");
  const clearButton = document.createElement("button");
  const confirmClearButton = document.createElement("button");
  const clearStatusElement = document.createElement("div");
  const saveButton = document.createElement("button");
  const unsavedIndicator = document.createElement("span");

  const baseRule = { continueMatching: true, enabled: true } as T;

  const config: RuleConfig<T> = {
    scope,
    getRules: () => [],
    setRules: () => {},
    body,
    clearButton,
    confirmClearButton,
    clearStatusElement,
    saveButton,
    unsavedIndicator,
    fields: [],
    fieldKeys: {
      pattern: "pattern" as never,
      search: "search" as never,
      replace: "replace" as never,
    },
    createEmpty: () => baseRule,
    sanitize: (rule) => rule,
    hasContent: () => false,
    messages: {
      missingPattern: "",
      invalidPattern: "",
      missingSearchForReplace: "",
      invalidSearch: "",
      cleared: "",
      removed: "",
    },
    ...overrides,
  };

  return config;
}

describe("options rule change tracker", () => {
  it("marks scope dirty once and reveals unsaved indicator", () => {
    const titleConfig = createRuleConfig<TitleRule>("title");
    const urlConfig = createRuleConfig<UrlRule>("url");
    const tracker = createRuleChangeTracker({ title: titleConfig, url: urlConfig });

    tracker.rememberSaveButtonLabels();
    tracker.markDirty("title");

    expect(tracker.isDirty("title")).toBe(true);
    expect(titleConfig.unsavedIndicator.hidden).toBe(false);
    expect(titleConfig.saveButton.disabled).toBe(false);

    tracker.markDirty("title");
    expect(tracker.isDirty("title")).toBe(true);
  });

  it("resets dirty state and disables button when cleared", () => {
    const titleConfig = createRuleConfig<TitleRule>("title");
    const urlConfig = createRuleConfig<UrlRule>("url");
    const tracker = createRuleChangeTracker({ title: titleConfig, url: urlConfig });

    tracker.rememberSaveButtonLabels();
    tracker.markDirty("url");
    tracker.setDirty("url", false);

    expect(tracker.isDirty("url")).toBe(false);
    expect(urlConfig.unsavedIndicator.hidden).toBe(true);
    expect(urlConfig.saveButton.disabled).toBe(true);
  });

  it("disables save buttons while saving and restores state afterwards", () => {
    const titleConfig = createRuleConfig<TitleRule>("title");
    const urlConfig = createRuleConfig<UrlRule>("url");
    titleConfig.saveButton.textContent = "Save title";
    urlConfig.saveButton.textContent = "Save url";

    const tracker = createRuleChangeTracker({ title: titleConfig, url: urlConfig });
    tracker.rememberSaveButtonLabels();

    tracker.markDirty("title");
    tracker.markDirty("url");
    tracker.setSaving(undefined, true);

    expect(tracker.isSaving("title")).toBe(true);
    expect(tracker.isSaving("url")).toBe(true);
    expect(titleConfig.saveButton.disabled).toBe(true);
    expect(urlConfig.saveButton.disabled).toBe(true);
    expect(titleConfig.saveButton.dataset.loading).toBe("true");
    expect(titleConfig.saveButton.textContent).toBe("Saving…");

    tracker.setSaving(undefined, false);

    expect(tracker.isSaving("title")).toBe(false);
    expect(tracker.isSaving("url")).toBe(false);
    expect(titleConfig.saveButton.dataset.loading).toBeUndefined();
    expect(titleConfig.saveButton.disabled).toBe(false);
    expect(urlConfig.saveButton.disabled).toBe(false);
    expect(titleConfig.saveButton.textContent).toBe("Save title");
    expect(urlConfig.saveButton.textContent).toBe("Save url");
  });

  it("remembers button labels when missing dataset entries", () => {
    const titleConfig = createRuleConfig<TitleRule>("title");
    const urlConfig = createRuleConfig<UrlRule>("url");
    titleConfig.saveButton.textContent = "Store Title";
    urlConfig.saveButton.textContent = "Store URL";

    const tracker = createRuleChangeTracker({ title: titleConfig, url: urlConfig });
    tracker.rememberSaveButtonLabels();

    expect(titleConfig.saveButton.dataset.label).toBe("Store Title");
    expect(urlConfig.saveButton.dataset.label).toBe("Store URL");
  });

  it("restores dirty state after overlapping saves complete", () => {
    const titleConfig = createRuleConfig<TitleRule>("title");
    titleConfig.saveButton.textContent = "Save Title";
    const urlConfig = createRuleConfig<UrlRule>("url");

    const tracker = createRuleChangeTracker({ title: titleConfig, url: urlConfig });
    tracker.rememberSaveButtonLabels();

    tracker.markDirty("title");
    tracker.markDirty("url");

    tracker.setSaving("title", true);
    tracker.setDirty("title", true);

    expect(tracker.isSaving("title")).toBe(true);
    expect(titleConfig.saveButton.dataset.loading).toBe("true");
    expect(titleConfig.saveButton.disabled).toBe(true);

    tracker.setSaving("title", false);

    expect(tracker.isSaving("title")).toBe(false);
    expect(tracker.isDirty("title")).toBe(true);
    expect(titleConfig.saveButton.disabled).toBe(false);
    expect(urlConfig.saveButton.disabled).toBe(false);
  });
});
