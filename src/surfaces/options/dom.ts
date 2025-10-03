export interface OptionsDom {
  form: HTMLFormElement;
  templateField: HTMLTextAreaElement | null;
  restoreTemplateButton: HTMLButtonElement | null;
  previewElement: HTMLElement;
  statusElement: HTMLElement;
  titleSamplePresetSelect: HTMLSelectElement;
  urlSamplePresetSelect: HTMLSelectElement;
  sampleTitleInput: HTMLInputElement;
  sampleUrlInput: HTMLInputElement;
  sampleOutputTitle: HTMLElement;
  sampleOutputUrl: HTMLElement;
  titleRulesBody: HTMLTableSectionElement;
  addTitleRuleButton: HTMLButtonElement;
  clearTitleRulesButton: HTMLButtonElement;
  confirmClearTitleRulesButton: HTMLButtonElement;
  titleClearStatusElement: HTMLElement;
  saveTitleRuleButton: HTMLButtonElement;
  titleUnsavedIndicator: HTMLElement;
  urlRulesBody: HTMLTableSectionElement;
  addUrlRuleButton: HTMLButtonElement;
  clearUrlRulesButton: HTMLButtonElement;
  confirmClearUrlRulesButton: HTMLButtonElement;
  urlClearStatusElement: HTMLElement;
  saveUrlRuleButton: HTMLButtonElement;
  urlUnsavedIndicator: HTMLElement;
}

export function loadDom(): OptionsDom | null {
  const form = requireElement<HTMLFormElement>("options-form");
  const templateField = optionalElement<HTMLTextAreaElement>("format-template");
  const restoreTemplateButton = optionalElement<HTMLButtonElement>("restore-template");
  const previewElement = requireElement<HTMLElement>("format-preview");
  const statusElement = requireElement<HTMLElement>("status");

  const titleSamplePresetSelect = requireElement<HTMLSelectElement>("title-sample-preset");
  const urlSamplePresetSelect = requireElement<HTMLSelectElement>("url-sample-preset");
  const sampleTitleInput = requireElement<HTMLInputElement>("sample-title");
  const sampleUrlInput = requireElement<HTMLInputElement>("sample-url");
  const sampleOutputTitle = requireElement<HTMLElement>("sample-output-title");
  const sampleOutputUrl = requireElement<HTMLElement>("sample-output-url");

  const titleRulesBody = requireElement<HTMLTableSectionElement>("title-rules-body");
  const addTitleRuleButton = requireElement<HTMLButtonElement>("add-title-rule");
  const clearTitleRulesButton = requireElement<HTMLButtonElement>("clear-title-rules");
  const confirmClearTitleRulesButton = requireElement<HTMLButtonElement>(
    "confirm-clear-title-rules",
  );
  const titleClearStatusElement = requireElement<HTMLElement>("title-clear-status");
  const saveTitleRuleButton = requireElement<HTMLButtonElement>("save-title-rules");
  const titleUnsavedIndicator = requireElement<HTMLElement>("title-unsaved-indicator");

  const urlRulesBody = requireElement<HTMLTableSectionElement>("url-rules-body");
  const addUrlRuleButton = requireElement<HTMLButtonElement>("add-url-rule");
  const clearUrlRulesButton = requireElement<HTMLButtonElement>("clear-url-rules");
  const confirmClearUrlRulesButton = requireElement<HTMLButtonElement>("confirm-clear-url-rules");
  const urlClearStatusElement = requireElement<HTMLElement>("url-clear-status");
  const saveUrlRuleButton = requireElement<HTMLButtonElement>("save-url-rules");
  const urlUnsavedIndicator = requireElement<HTMLElement>("url-unsaved-indicator");

  const requiredElements = [
    form,
    previewElement,
    statusElement,
    titleSamplePresetSelect,
    urlSamplePresetSelect,
    sampleTitleInput,
    sampleUrlInput,
    sampleOutputTitle,
    sampleOutputUrl,
    titleRulesBody,
    addTitleRuleButton,
    clearTitleRulesButton,
    confirmClearTitleRulesButton,
    titleClearStatusElement,
    saveTitleRuleButton,
    titleUnsavedIndicator,
    urlRulesBody,
    addUrlRuleButton,
    clearUrlRulesButton,
    confirmClearUrlRulesButton,
    urlClearStatusElement,
    saveUrlRuleButton,
    urlUnsavedIndicator,
  ];

  if (requiredElements.some((element) => !element)) {
    console.warn("Options UI is missing expected elements; aborting initialization.");
    return null;
  }

  return {
    form,
    templateField,
    restoreTemplateButton,
    previewElement,
    statusElement,
    titleSamplePresetSelect,
    urlSamplePresetSelect,
    sampleTitleInput,
    sampleUrlInput,
    sampleOutputTitle,
    sampleOutputUrl,
    titleRulesBody,
    addTitleRuleButton,
    clearTitleRulesButton,
    confirmClearTitleRulesButton,
    titleClearStatusElement,
    saveTitleRuleButton,
    titleUnsavedIndicator,
    urlRulesBody,
    addUrlRuleButton,
    clearUrlRulesButton,
    confirmClearUrlRulesButton,
    urlClearStatusElement,
    saveUrlRuleButton,
    urlUnsavedIndicator,
  } satisfies OptionsDom;
}

export function clearValidationState(container: HTMLElement): void {
  container.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
    element.removeAttribute("aria-invalid");
  });
}

export function markInvalidField(input: HTMLInputElement): void {
  input.setAttribute("aria-invalid", "true");
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Options page is missing required element: #${id}`);
  }
  return element as T;
}

function optionalElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}
