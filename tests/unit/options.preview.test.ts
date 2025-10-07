import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../../src/options-schema.js";
import type { OptionsContext } from "../../src/surfaces/options/context.js";
import {
  type PreviewRulesAdapter,
  resetPreviewSample,
  updatePreview,
} from "../../src/surfaces/options/preview.js";
import { DEFAULT_PREVIEW_SAMPLE } from "../../src/surfaces/options/state.js";

const createContext = (): OptionsContext => {
  const previewElement = document.createElement("pre");
  const sampleTitle = document.createElement("span");
  const sampleUrl = document.createElement("span");
  const templateField = document.createElement("textarea");
  templateField.value = DEFAULT_OPTIONS.format;

  return {
    draft: structuredClone(DEFAULT_OPTIONS),
    dom: {
      form: document.createElement("form"),
      templateField,
      restoreTemplateButton: document.createElement("button"),
      previewElement,
      statusElement: document.createElement("div"),
      titleSamplePresetSelect: document.createElement("select"),
      urlSamplePresetSelect: document.createElement("select"),
      sampleTitleInput: document.createElement("input"),
      sampleUrlInput: document.createElement("input"),
      sampleOutputTitle: sampleTitle,
      sampleOutputUrl: sampleUrl,
      titleRulesBody: document.createElement("tbody"),
      addTitleRuleButton: document.createElement("button"),
      clearTitleRulesButton: document.createElement("button"),
      confirmClearTitleRulesButton: document.createElement("button"),
      titleClearStatusElement: document.createElement("div"),
      saveTitleRuleButton: document.createElement("button"),
      titleUnsavedIndicator: document.createElement("span"),
      urlRulesBody: document.createElement("tbody"),
      addUrlRuleButton: document.createElement("button"),
      clearUrlRulesButton: document.createElement("button"),
      confirmClearUrlRulesButton: document.createElement("button"),
      urlClearStatusElement: document.createElement("div"),
      saveUrlRuleButton: document.createElement("button"),
      urlUnsavedIndicator: document.createElement("span"),
    },
    storage: undefined,
    previewSample: { title: "Original", url: "https://example.com" },
  };
};

function filteredRules(scope: "title"): typeof DEFAULT_OPTIONS.titleRules;
function filteredRules(scope: "url"): typeof DEFAULT_OPTIONS.urlRules;
function filteredRules(scope: "title" | "url") {
  if (scope === "title") {
    return DEFAULT_OPTIONS.titleRules;
  }
  return DEFAULT_OPTIONS.urlRules;
}

const rulesAdapter: PreviewRulesAdapter = {
  filtered: filteredRules,
};

describe("options preview", () => {
  it("updates preview content and transformed samples", () => {
    const context = createContext();
    updatePreview(context, rulesAdapter);

    expect(context.dom.previewElement.textContent).toContain("Original");
    expect(context.dom.sampleOutputTitle.textContent).not.toBe("");
    expect(context.dom.sampleOutputUrl.textContent).not.toBe("");
  });

  it("resets preview sample to defaults", () => {
    const context = createContext();
    context.previewSample.title = "changed";
    context.previewSample.url = "https://modified";
    resetPreviewSample(context);
    expect(context.previewSample.title).not.toBe("changed");
    expect(context.previewSample.url).toBe(DEFAULT_PREVIEW_SAMPLE.url);
  });
});
