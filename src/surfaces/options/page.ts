/**
 * Options surface entry point. Coordinates DOM wiring, rule editing helpers, preview updates, and
 * persistence so the giant template can stay modular.
 */
import {
  normalizeStoredOptions,
  type OptionsPayload,
  type TitleRule,
  type UrlRule,
} from "../../options-schema.js";
import { createOptionsContext } from "./context.js";
import { clearValidationState, loadDom } from "./dom.js";
import { type PreviewRulesAdapter, resetPreviewSample, updatePreview } from "./preview.js";
import { buildRuleConfigs } from "./rules-config.js";
import {
  createCheckboxCell,
  createHandleCell,
  createInputCell,
  createRemoveCell,
} from "./rules-dom.js";
import {
  filteredRulesInternal,
  handleRuleInputChangeFor,
  moveRule,
  readRuleField,
  validateRulesFor,
} from "./rules-logic.js";
import type { DragScope, RuleConfig, RuleWithFlags } from "./rules-types.js";
import {
  cloneOptions,
  createDraft,
  DEFAULT_PREVIEW_SAMPLE,
  DEFAULT_TEMPLATE,
  normalizeFormat,
  OPTIONS_VERSION,
} from "./state.js";
import { hideStatus, showStatus } from "./status.js";

interface DragState {
  scope: DragScope;
  fromIndex: number;
  row: HTMLTableRowElement;
}

interface RuleDirtyState {
  title: boolean;
  url: boolean;
}

interface RuleSavingState {
  title: boolean;
  url: boolean;
}

type ClearConfirmationTimers = Partial<Record<DragScope, ReturnType<typeof setTimeout>>>;
const CLEAR_CONFIRMATION_TIMEOUT_MS = 5000;

/** Bootstraps the options UI and returns a disposer for tests/HMR. */
export function initializeOptions(): () => void {
  const dom = loadDom();
  if (!dom) {
    return () => {};
  }

  const storageArea = globalThis.chrome?.storage?.sync;
  const context = createOptionsContext(dom, storageArea, createDraft());
  let draft = context.draft;

  const ruleConfigs = buildRuleConfigs(context);
  const abortController = new AbortController();
  const { signal } = abortController;

  const dirtyState: RuleDirtyState = { title: false, url: false };
  const savingState: RuleSavingState = { title: false, url: false };
  const clearTimers: ClearConfirmationTimers = {};
  let draggingState: DragState | undefined;

  const rulesAdapter: PreviewRulesAdapter = {
    filtered: filteredRules,
  };

  const hasAnimationFrame = typeof window.requestAnimationFrame === "function";
  let previewFrameHandle: number | undefined;

  function updatePreviewView(): void {
    updatePreview(context, rulesAdapter);

    if (!hasAnimationFrame) {
      return;
    }

    if (previewFrameHandle !== undefined) {
      window.cancelAnimationFrame(previewFrameHandle);
    }

    previewFrameHandle = window.requestAnimationFrame(() => {
      previewFrameHandle = undefined;
      updatePreview(context, rulesAdapter);
    });
  }

  function setDirty(scope: DragScope, dirty: boolean): void {
    dirtyState[scope] = dirty;
    const config = scope === "title" ? ruleConfigs.title : ruleConfigs.url;
    config.unsavedIndicator.hidden = !dirty;
    if (!savingState[scope]) {
      config.saveButton.disabled = !dirty;
    }
  }

  function markDirty(scope: DragScope): void {
    if (!dirtyState[scope]) {
      setDirty(scope, true);
    }
  }

  function setSaving(scope: DragScope | undefined, saving: boolean): void {
    if (!scope) {
      setSaving("title", saving);
      setSaving("url", saving);
      return;
    }

    savingState[scope] = saving;
    const config = scope === "title" ? ruleConfigs.title : ruleConfigs.url;
    if (saving) {
      config.saveButton.dataset.loading = "true";
      config.saveButton.disabled = true;
      config.saveButton.textContent = "Saving…";
    } else {
      delete config.saveButton.dataset.loading;
      config.saveButton.textContent = config.saveButton.dataset.label ?? "Save changes";
      config.saveButton.disabled = !dirtyState[scope];
    }
  }

  function rememberSaveButtonLabels(): void {
    (["title", "url"] as DragScope[]).forEach((scope) => {
      const config = scope === "title" ? ruleConfigs.title : ruleConfigs.url;
      if (!config.saveButton.dataset.label) {
        config.saveButton.dataset.label = config.saveButton.textContent ?? "Save changes";
      }
    });
  }

  function setClearStatus(scope: DragScope, message: string): void {
    const { clearStatusElement } = scope === "title" ? ruleConfigs.title : ruleConfigs.url;
    if (!message) {
      clearStatusElement.textContent = "";
      clearStatusElement.hidden = true;
      return;
    }

    clearStatusElement.textContent = message;
    clearStatusElement.hidden = false;
  }

  function resetClearConfirmation(scope: DragScope): void {
    const config = scope === "title" ? ruleConfigs.title : ruleConfigs.url;
    const timer = clearTimers[scope];
    if (timer) {
      clearTimeout(timer);
      clearTimers[scope] = undefined;
    }

    config.clearButton.hidden = false;
    config.confirmClearButton.hidden = true;
  }

  function filteredRules(scope: "title"): TitleRule[];
  function filteredRules(scope: "url"): UrlRule[];
  function filteredRules(scope: DragScope): TitleRule[] | UrlRule[] {
    return scope === "title"
      ? filteredRulesInternal(ruleConfigs.title)
      : filteredRulesInternal(ruleConfigs.url);
  }

  function renderRules(scope: DragScope): void {
    if (scope === "title") {
      renderRulesFor(ruleConfigs.title);
    } else {
      renderRulesFor(ruleConfigs.url);
    }
  }

  function renderRulesFor<TRule extends RuleWithFlags>(config: RuleConfig<TRule>): void {
    const rules = config.getRules();
    config.body.replaceChildren();

    rules.forEach((rule, index) => {
      const row = document.createElement("tr");
      row.dataset.index = String(index);
      row.classList.toggle("rule-disabled", rule.enabled === false);

      const fieldCells = config.fields.map((descriptor) =>
        createInputCell(
          descriptor.key,
          index,
          readRuleField(rule, descriptor.key),
          descriptor.placeholder,
        ),
      );

      row.append(
        createHandleCell(config.scope, index),
        ...fieldCells,
        createCheckboxCell("enabled", index, rule.enabled !== false, "Rule enabled"),
        createCheckboxCell("continueMatching", index, !rule.continueMatching, "Break after match"),
        createRemoveCell(index, config.scope),
      );

      config.body.append(row);
      attachRowDragHandlers(row, config.scope);
    });

    resetClearConfirmation(config.scope);
    setClearStatus(config.scope, "");
    updatePreviewView();
  }

  function attachRowDragHandlers(row: HTMLTableRowElement, scope: DragScope): void {
    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    if (!handle) {
      return;
    }

    handle.addEventListener(
      "dragstart",
      (event) => {
        const index = Number.parseInt(row.dataset.index ?? "", 10);
        if (Number.isNaN(index)) {
          event.preventDefault();
          return;
        }

        draggingState = { scope, fromIndex: index, row };
        if (event.dataTransfer) {
          event.dataTransfer.setData("text/plain", String(index));
          event.dataTransfer.setDragImage(row, 0, 0);
          event.dataTransfer.effectAllowed = "move";
        }
        row.classList.add("dragging");
      },
      { signal },
    );

    handle.addEventListener(
      "dragend",
      () => {
        row.classList.remove("dragging");
        draggingState = undefined;
      },
      { signal },
    );

    row.addEventListener(
      "dragenter",
      (event) => {
        if (!draggingState || draggingState.scope !== scope) {
          return;
        }
        event.preventDefault();
        row.classList.add("drag-over");
      },
      { signal },
    );

    row.addEventListener(
      "dragover",
      (event) => {
        if (!draggingState || draggingState.scope !== scope) {
          return;
        }
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
      },
      { signal },
    );

    row.addEventListener(
      "dragleave",
      () => {
        row.classList.remove("drag-over");
      },
      { signal },
    );

    row.addEventListener(
      "drop",
      (event) => {
        if (!draggingState || draggingState.scope !== scope) {
          return;
        }
        event.preventDefault();

        const targetIndex = Number.parseInt(row.dataset.index ?? "", 10);
        if (Number.isNaN(targetIndex)) {
          row.classList.remove("drag-over");
          return;
        }

        const fromIndex = draggingState.fromIndex;
        row.classList.remove("drag-over");
        draggingState.row.classList.remove("dragging");

        if (scope === "title") {
          moveRule(draft.titleRules, fromIndex, targetIndex);
        } else {
          moveRule(draft.urlRules, fromIndex, targetIndex);
        }

        draggingState = undefined;
        renderRules(scope);
        if (fromIndex !== targetIndex) {
          markDirty(scope);
        }
      },
      { signal },
    );
  }

  function handleRuleInputChange(scope: DragScope, input: HTMLInputElement): void {
    const changed =
      scope === "title"
        ? handleRuleInputChangeFor(ruleConfigs.title, input)
        : handleRuleInputChangeFor(ruleConfigs.url, input);
    updatePreviewView();
    if (changed) {
      markDirty(scope);
    }
  }

  function addRule(scope: DragScope): void {
    if (scope === "title") {
      const config = ruleConfigs.title;
      config.getRules().push(config.createEmpty());
      renderRulesFor(config);
      focusFirstField(config);
    } else {
      const config = ruleConfigs.url;
      config.getRules().push(config.createEmpty());
      renderRulesFor(config);
      focusFirstField(config);
    }

    markDirty(scope);
  }

  function focusFirstField<TRule extends RuleWithFlags>(config: RuleConfig<TRule>): void {
    const firstField = config.fields[0]?.key;
    if (!firstField) {
      return;
    }
    const selector = `tr:last-child input[data-field="${firstField}"]`;
    config.body.querySelector<HTMLInputElement>(selector)?.focus();
  }

  function removeRule(scope: DragScope, index: number): void {
    if (scope === "title") {
      const config = ruleConfigs.title;
      if (removeRuleInternal(config, index)) {
        markDirty("title");
      }
    } else {
      const config = ruleConfigs.url;
      if (removeRuleInternal(config, index)) {
        markDirty("url");
      }
    }
  }

  function removeRuleInternal<TRule extends RuleWithFlags>(
    config: RuleConfig<TRule>,
    index: number,
  ): boolean {
    const rules = config.getRules();
    if (index < 0 || index >= rules.length) {
      return false;
    }

    rules.splice(index, 1);
    renderRulesFor(config);
    showStatus(context, config.messages.removed);
    return true;
  }

  function promptClearRules(scope: DragScope): void {
    if (scope === "title") {
      promptClearRulesFor(ruleConfigs.title);
    } else {
      promptClearRulesFor(ruleConfigs.url);
    }
  }

  function promptClearRulesFor<TRule extends RuleWithFlags>(config: RuleConfig<TRule>): void {
    setClearStatus(config.scope, "");
    const timer = clearTimers[config.scope];
    if (timer) {
      clearTimeout(timer);
      clearTimers[config.scope] = undefined;
    }

    config.clearButton.hidden = true;
    config.confirmClearButton.hidden = false;
    config.confirmClearButton.focus();

    clearTimers[config.scope] = setTimeout(() => {
      resetClearConfirmation(config.scope);
    }, CLEAR_CONFIRMATION_TIMEOUT_MS);
  }

  function confirmClearRules(scope: DragScope): void {
    if (scope === "title") {
      confirmClearRulesFor(ruleConfigs.title);
    } else {
      confirmClearRulesFor(ruleConfigs.url);
    }
  }

  function confirmClearRulesFor<TRule extends RuleWithFlags>(config: RuleConfig<TRule>): void {
    resetClearConfirmation(config.scope);
    config.setRules([]);
    renderRulesFor(config);
    setClearStatus(config.scope, config.messages.cleared);
    showStatus(context, config.messages.cleared);
    markDirty(config.scope);
  }

  function validateRules(scope: DragScope) {
    return scope === "title"
      ? validateRulesFor(ruleConfigs.title)
      : validateRulesFor(ruleConfigs.url);
  }

  function collectPayload(): OptionsPayload {
    return {
      version: OPTIONS_VERSION,
      format: normalizeFormat(context.dom.templateField, draft),
      titleRules: filteredRules("title"),
      urlRules: filteredRules("url"),
    };
  }

  async function persistOptions(scope?: DragScope): Promise<boolean> {
    setSaving(scope, true);

    clearValidationState(context.dom.titleRulesBody);
    clearValidationState(context.dom.urlRulesBody);
    context.dom.templateField?.removeAttribute("aria-invalid");

    const templateField = context.dom.templateField;
    if (templateField) {
      const templateValue = templateField.value.trim();
      if (!templateValue) {
        templateField.setAttribute("aria-invalid", "true");
        showStatus(context, "Template cannot be empty.", "error");
        setSaving(scope, false);
        return false;
      }
    }

    const titleValidation = validateRules("title");
    if (!titleValidation.valid) {
      showStatus(context, titleValidation.message ?? "Title rule validation failed.", "error");
      setSaving(scope, false);
      return false;
    }

    const urlValidation = validateRules("url");
    if (!urlValidation.valid) {
      showStatus(context, urlValidation.message ?? "URL rule validation failed.", "error");
      setSaving(scope, false);
      return false;
    }

    const payload = collectPayload();

    if (!context.storage) {
      showStatus(context, "Chrome storage is unavailable; unable to save changes.", "error");
      setSaving(scope, false);
      return false;
    }

    try {
      await context.storage.set({
        options: payload,
        format: payload.format ?? DEFAULT_TEMPLATE,
        titleRules: payload.titleRules,
        urlRules: payload.urlRules,
      });

      const message = scope
        ? scope === "title"
          ? "Title rules saved."
          : "URL rules saved."
        : "Options saved successfully.";
      showStatus(context, message, "success");
      context.draft = cloneOptions(payload);
      draft = context.draft;
      renderRules("title");
      renderRules("url");
      setDirty("title", false);
      setDirty("url", false);
      return true;
    } catch (error) {
      console.error("Failed to save options.", error);
      showStatus(context, "Failed to save options.", "error");
      return false;
    } finally {
      setSaving(scope, false);
    }
  }

  async function saveOptions(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    await persistOptions();
  }

  async function loadOptions(): Promise<void> {
    if (!context.storage) {
      showStatus(context, "Chrome storage is unavailable; using defaults.", "error");
      context.draft = createDraft();
      draft = context.draft;
      if (context.dom.templateField) {
        context.dom.templateField.value = draft.format;
      }
      renderRules("title");
      renderRules("url");
      applyDefaultPreviewSamples();
      setDirty("title", false);
      setDirty("url", false);
      return;
    }

    try {
      const snapshot = await context.storage.get([
        "options",
        "format",
        "titleRules",
        "urlRules",
        "linkRules",
        "rules",
      ]);
      context.draft = cloneOptions(normalizeStoredOptions(snapshot));
      draft = context.draft;
      if (context.dom.templateField) {
        context.dom.templateField.value = draft.format;
      }
      renderRules("title");
      renderRules("url");
      applyDefaultPreviewSamples();
      setDirty("title", false);
      setDirty("url", false);
      showStatus(context, "Options loaded.");
    } catch (error) {
      console.error("Failed to load options; fallback to defaults.", error);
      context.draft = createDraft();
      draft = context.draft;
      if (context.dom.templateField) {
        context.dom.templateField.value = draft.format;
      }
      renderRules("title");
      renderRules("url");
      applyDefaultPreviewSamples();
      setDirty("title", false);
      setDirty("url", false);
      showStatus(context, "Failed to load saved options; defaults restored.", "error");
    }
  }

  function applyDefaultPreviewSamples(): void {
    resetPreviewSample(context);
    updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, "wikipedia");
    updateUrlSample(DEFAULT_PREVIEW_SAMPLE.url, "amazon");
  }

  function updateTitleSample(nextTitle: string, preset?: string): void {
    context.previewSample.title = nextTitle;
    context.dom.sampleTitleInput.value = context.previewSample.title;
    if (preset) {
      context.dom.titleSamplePresetSelect.value = preset;
    }
    updatePreviewView();
  }

  function updateUrlSample(nextUrl: string, preset?: string): void {
    context.previewSample.url = nextUrl;
    context.dom.sampleUrlInput.value = context.previewSample.url;
    if (preset) {
      context.dom.urlSamplePresetSelect.value = preset;
    }
    updatePreviewView();
  }

  rememberSaveButtonLabels();
  setDirty("title", false);
  setDirty("url", false);

  context.dom.titleSamplePresetSelect.addEventListener(
    "change",
    () => {
      const selected = context.dom.titleSamplePresetSelect.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === "custom") {
        updateTitleSample(context.dom.sampleTitleInput.value, "custom");
        return;
      }

      const nextTitle = selected.dataset.title ?? DEFAULT_PREVIEW_SAMPLE.title;
      updateTitleSample(nextTitle, selected.value);
    },
    { signal },
  );

  context.dom.sampleTitleInput.addEventListener(
    "input",
    () => {
      updateTitleSample(context.dom.sampleTitleInput.value, "custom");
    },
    { signal },
  );

  context.dom.urlSamplePresetSelect.addEventListener(
    "change",
    () => {
      const selected = context.dom.urlSamplePresetSelect.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === "custom") {
        updateUrlSample(context.dom.sampleUrlInput.value.trim(), "custom");
        return;
      }

      const nextUrl = selected.dataset.url ?? DEFAULT_PREVIEW_SAMPLE.url;
      updateUrlSample(nextUrl, selected.value);
    },
    { signal },
  );

  context.dom.sampleUrlInput.addEventListener(
    "input",
    () => {
      updateUrlSample(context.dom.sampleUrlInput.value.trim(), "custom");
    },
    { signal },
  );

  context.dom.titleRulesBody.addEventListener(
    "input",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        handleRuleInputChange("title", event.target);
      }
    },
    { signal },
  );

  context.dom.titleRulesBody.addEventListener(
    "change",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        handleRuleInputChange("title", event.target);
      }
    },
    { signal },
  );

  context.dom.urlRulesBody.addEventListener(
    "input",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        handleRuleInputChange("url", event.target);
      }
    },
    { signal },
  );

  context.dom.urlRulesBody.addEventListener(
    "change",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        handleRuleInputChange("url", event.target);
      }
    },
    { signal },
  );

  context.dom.titleRulesBody.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (target.dataset.action === "remove") {
        const scope = target.dataset.scope as DragScope | undefined;
        if (scope === "title") {
          const index = Number.parseInt(target.dataset.index ?? "", 10);
          if (!Number.isNaN(index)) {
            removeRule("title", index);
          }
        }
      }
    },
    { signal },
  );

  context.dom.urlRulesBody.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (target.dataset.action === "remove") {
        const scope = target.dataset.scope as DragScope | undefined;
        if (scope === "url") {
          const index = Number.parseInt(target.dataset.index ?? "", 10);
          if (!Number.isNaN(index)) {
            removeRule("url", index);
          }
        }
      }
    },
    { signal },
  );

  context.dom.addTitleRuleButton.addEventListener(
    "click",
    () => {
      addRule("title");
    },
    { signal },
  );

  context.dom.addUrlRuleButton.addEventListener(
    "click",
    () => {
      addRule("url");
    },
    { signal },
  );

  context.dom.saveTitleRuleButton.addEventListener(
    "click",
    () => {
      if (savingState.title || !dirtyState.title) {
        return;
      }
      void persistOptions("title");
    },
    { signal },
  );

  context.dom.saveUrlRuleButton.addEventListener(
    "click",
    () => {
      if (savingState.url || !dirtyState.url) {
        return;
      }
      void persistOptions("url");
    },
    { signal },
  );

  context.dom.clearTitleRulesButton.addEventListener(
    "click",
    () => {
      promptClearRules("title");
    },
    { signal },
  );

  context.dom.confirmClearTitleRulesButton.addEventListener(
    "click",
    () => {
      confirmClearRules("title");
    },
    { signal },
  );

  context.dom.clearUrlRulesButton.addEventListener(
    "click",
    () => {
      promptClearRules("url");
    },
    { signal },
  );

  context.dom.confirmClearUrlRulesButton.addEventListener(
    "click",
    () => {
      confirmClearRules("url");
    },
    { signal },
  );

  if (context.dom.templateField) {
    context.dom.templateField.addEventListener(
      "input",
      () => {
        draft.format = context.dom.templateField?.value ?? draft.format;
        updatePreviewView();
      },
      { signal },
    );
  }

  context.dom.restoreTemplateButton?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      if (context.dom.templateField) {
        context.dom.templateField.value = DEFAULT_TEMPLATE;
      }
      draft.format = DEFAULT_TEMPLATE;
      updatePreviewView();
      showStatus(context, "Template restored to default.");
    },
    { signal },
  );

  context.dom.form.addEventListener(
    "submit",
    (event) => {
      void saveOptions(event);
    },
    { signal },
  );

  void loadOptions();

  return () => {
    abortController.abort();
    if (context.statusTimeout) {
      clearTimeout(context.statusTimeout);
      context.statusTimeout = undefined;
    }
    Object.values(clearTimers).forEach((timer) => {
      if (timer) {
        clearTimeout(timer);
      }
    });
    hideStatus(context);
    context.draft = createDraft();
    draft = context.draft;

    if (previewFrameHandle !== undefined && hasAnimationFrame) {
      window.cancelAnimationFrame(previewFrameHandle);
      previewFrameHandle = undefined;
    }
  };
}
