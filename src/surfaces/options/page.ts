import { applyTitleRules, applyUrlRules, formatWithOptions } from "../../formatting.js";
import {
  normalizeStoredOptions,
  type OptionsPayload,
  type TitleRule,
  type UrlRule,
} from "../../options-schema.js";
import { clearValidationState, loadDom, markInvalidField } from "./dom.js";
import type {
  DragScope,
  RuleConfig,
  RuleFieldDescriptor,
  RuleFieldKeys,
  RuleMessages,
  RuleWithFlags,
  StringFieldKey,
} from "./rules-types.js";
import {
  cloneOptions,
  cloneTitleRule,
  cloneUrlRule,
  createDraft,
  DEFAULT_PREVIEW_SAMPLE,
  DEFAULT_TEMPLATE,
  normalizeFormat,
  OPTIONS_VERSION,
  STATUS_TIMEOUT_MS,
  sanitizeTitleRule,
  sanitizeUrlRule,
  validateRegex,
} from "./state.js";

interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function initializeOptions(): () => void {
  const dom = loadDom();
  if (!dom) {
    return () => {};
  }

  const {
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
  } = dom;

  const ruleConfigs = {
    title: {
      scope: "title" as const,
      getRules: () => draft.titleRules,
      setRules: (next: TitleRule[]) => {
        draft.titleRules = next;
      },
      body: titleRulesBody,
      clearButton: clearTitleRulesButton,
      confirmClearButton: confirmClearTitleRulesButton,
      clearStatusElement: titleClearStatusElement,
      saveButton: saveTitleRuleButton,
      unsavedIndicator: titleUnsavedIndicator,
      fields: [
        { key: "urlPattern", placeholder: "URL pattern" },
        { key: "titleSearch", placeholder: "Title search" },
        { key: "titleReplace", placeholder: "Title replace", trimLeading: false },
        { key: "comment", placeholder: "Comment (optional)", trimLeading: false },
      ] satisfies RuleFieldDescriptor<TitleRule>[],
      fieldKeys: {
        pattern: "urlPattern",
        search: "titleSearch",
        replace: "titleReplace",
      } satisfies RuleFieldKeys<TitleRule>,
      createEmpty: (): TitleRule => ({
        urlPattern: "",
        titleSearch: "",
        titleReplace: "",
        comment: "",
        continueMatching: false,
        enabled: true,
      }),
      sanitize: sanitizeTitleRule,
      hasContent: (rule: TitleRule) =>
        Boolean(rule.urlPattern || rule.titleSearch || rule.titleReplace),
      messages: {
        missingPattern: "URL pattern is required when defining a title rule.",
        invalidPattern: "One or more title rule URL patterns are invalid regex expressions.",
        missingSearchForReplace:
          "Provide a title search pattern before specifying a title replacement.",
        invalidSearch: "One or more title search patterns are invalid regex expressions.",
        cleared: "All title rules cleared.",
        removed: "Title rule removed.",
      } satisfies RuleMessages,
    } satisfies RuleConfig<TitleRule>,
    url: {
      scope: "url" as const,
      getRules: () => draft.urlRules,
      setRules: (next: UrlRule[]) => {
        draft.urlRules = next;
      },
      body: urlRulesBody,
      clearButton: clearUrlRulesButton,
      confirmClearButton: confirmClearUrlRulesButton,
      clearStatusElement: urlClearStatusElement,
      saveButton: saveUrlRuleButton,
      unsavedIndicator: urlUnsavedIndicator,
      fields: [
        { key: "urlPattern", placeholder: "URL pattern" },
        { key: "urlSearch", placeholder: "URL search" },
        { key: "urlReplace", placeholder: "URL replace", trimLeading: false },
        { key: "comment", placeholder: "Comment (optional)", trimLeading: false },
      ] satisfies RuleFieldDescriptor<UrlRule>[],
      fieldKeys: {
        pattern: "urlPattern",
        search: "urlSearch",
        replace: "urlReplace",
      } satisfies RuleFieldKeys<UrlRule>,
      createEmpty: (): UrlRule => ({
        urlPattern: "",
        urlSearch: "",
        urlReplace: "",
        comment: "",
        continueMatching: false,
        enabled: true,
      }),
      sanitize: sanitizeUrlRule,
      hasContent: (rule: UrlRule) => Boolean(rule.urlPattern || rule.urlSearch || rule.urlReplace),
      messages: {
        missingPattern: "URL pattern is required when defining a URL rule.",
        invalidPattern: "One or more URL rule URL patterns are invalid regex expressions.",
        missingSearchForReplace:
          "Provide a URL search pattern before specifying a URL replacement.",
        invalidSearch: "One or more URL search patterns are invalid regex expressions.",
        cleared: "All URL rules cleared.",
        removed: "URL rule removed.",
      } satisfies RuleMessages,
    } satisfies RuleConfig<UrlRule>,
  } as const;

  type RuleConfigsMap = typeof ruleConfigs;

  const saveButtonLabels = {
    title: saveTitleRuleButton.textContent ?? "Save changes",
    url: saveUrlRuleButton.textContent ?? "Save changes",
  } as const;

  const dirtyState: Record<DragScope, boolean> = {
    title: false,
    url: false,
  };

  const savingState: Record<DragScope, boolean> = {
    title: false,
    url: false,
  };

  function getRuleConfig<TScope extends keyof RuleConfigsMap>(
    scope: TScope,
  ): RuleConfigsMap[TScope] {
    return ruleConfigs[scope];
  }

  function setDirty(scope: DragScope, dirty: boolean): void {
    dirtyState[scope] = dirty;
    const config = getRuleConfig(scope);
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
    const config = getRuleConfig(scope);
    if (saving) {
      config.saveButton.dataset.loading = "true";
      config.saveButton.disabled = true;
      config.saveButton.textContent = "Saving…";
    } else {
      config.saveButton.textContent = saveButtonLabels[scope];
      config.saveButton.disabled = !dirtyState[scope];
      delete config.saveButton.dataset.loading;
    }
  }

  setDirty("title", false);
  setDirty("url", false);

  const storageArea = globalThis.chrome?.storage?.sync;

  const abortController = new AbortController();
  const { signal } = abortController;

  let statusTimeout: ReturnType<typeof setTimeout> | undefined;

  let draft: OptionsPayload = createDraft();
  const previewSample = {
    title: DEFAULT_PREVIEW_SAMPLE.title,
    url: DEFAULT_PREVIEW_SAMPLE.url,
  };

  let draggingState:
    | {
        scope: DragScope;
        fromIndex: number;
        row: HTMLTableRowElement;
      }
    | undefined;

  const clearTimeouts: Partial<Record<DragScope, ReturnType<typeof setTimeout>>> = {};

  function scheduleStatusClear(): void {
    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }

    if (!statusElement.textContent) {
      return;
    }

    statusTimeout = setTimeout(() => {
      statusElement.textContent = "";
      statusElement.removeAttribute("data-variant");
    }, STATUS_TIMEOUT_MS);
  }

  function setStatus(message: string, variant: "success" | "error" = "success"): void {
    statusElement.textContent = message;
    statusElement.setAttribute("data-variant", variant);
    scheduleStatusClear();
  }

  function setClearStatus(scope: DragScope, message: string): void {
    const { clearStatusElement } = getRuleConfig(scope);
    if (!message) {
      clearStatusElement.textContent = "";
      clearStatusElement.hidden = true;
      return;
    }

    clearStatusElement.textContent = message;
    clearStatusElement.hidden = false;
  }

  function resetClearConfirmation(scope: DragScope): void {
    const { clearButton, confirmClearButton } = getRuleConfig(scope);
    const timeout = clearTimeouts[scope];
    if (timeout) {
      clearTimeout(timeout);
      clearTimeouts[scope] = undefined;
    }

    clearButton.hidden = false;
    confirmClearButton.hidden = true;
  }

  function filteredRulesInternal<TRule extends RuleWithFlags>(config: RuleConfig<TRule>): TRule[] {
    const rules = config.getRules();
    const normalized: TRule[] = [];

    rules.forEach((rule, index) => {
      const sanitized = config.sanitize(rule);
      rules[index] = sanitized;
      if (config.hasContent(sanitized)) {
        normalized.push(sanitized);
      }
    });

    return normalized;
  }

  function filteredRules(scope: "title"): TitleRule[];
  function filteredRules(scope: "url"): UrlRule[];
  function filteredRules(scope: DragScope): TitleRule[] | UrlRule[] {
    return scope === "title"
      ? filteredRulesInternal(ruleConfigs.title)
      : filteredRulesInternal(ruleConfigs.url);
  }

  function updatePreview(): void {
    const titleRules = filteredRules("title");
    const urlRules = filteredRules("url");

    const options: OptionsPayload = {
      version: OPTIONS_VERSION,
      format: normalizeFormat(templateField, draft),
      titleRules,
      urlRules,
    };

    previewElement.textContent = formatWithOptions(options, {
      text: DEFAULT_PREVIEW_SAMPLE.text,
      title: previewSample.title,
      url: previewSample.url,
    });

    const transformedTitle = applyTitleRules(titleRules, previewSample.title, previewSample.url);
    const transformedUrl = applyUrlRules(urlRules, previewSample.url);

    sampleOutputTitle.textContent = transformedTitle || "—";
    sampleOutputUrl.textContent = transformedUrl || "—";
  }

  function createInputCell(
    field: string,
    index: number,
    value: string,
    label: string,
  ): HTMLTableCellElement {
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.index = String(index);
    input.dataset.field = field;
    input.placeholder = label;
    input.value = value;
    cell.append(input);
    return cell;
  }

  function createHandleCell(scope: "title" | "url", index: number): HTMLTableCellElement {
    const cell = document.createElement("td");
    cell.classList.add("reorder-cell");

    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("drag-handle");
    button.draggable = true;
    button.setAttribute(
      "aria-label",
      scope === "title" ? "Drag to reorder title rule" : "Drag to reorder URL rule",
    );
    button.innerHTML = '<span aria-hidden="true">⋮⋮</span>';

    button.dataset.index = String(index);

    cell.append(button);
    return cell;
  }

  function createCheckboxCell(
    field: string,
    index: number,
    checked: boolean,
    label: string,
  ): HTMLTableCellElement {
    const cell = document.createElement("td");
    cell.classList.add("toggle-cell");

    const input = document.createElement("input");

    input.type = "checkbox";
    input.dataset.index = String(index);
    input.dataset.field = field;
    input.checked = checked;
    input.setAttribute("aria-label", label);

    cell.append(input);

    return cell;
  }

  function createRemoveCell(index: number, scope: "title" | "url"): HTMLTableCellElement {
    const cell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Remove";
    button.dataset.action = scope === "title" ? "remove-title" : "remove-url";
    button.dataset.index = String(index);
    cell.append(button);
    return cell;
  }

  function moveRule<T>(list: T[], fromIndex: number, toIndex: number): void {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= list.length ||
      toIndex >= list.length
    ) {
      return;
    }

    const [item] = list.splice(fromIndex, 1);
    let insertIndex = toIndex;
    if (fromIndex < toIndex) {
      insertIndex = Math.min(insertIndex, list.length);
    }
    if (insertIndex > list.length) {
      insertIndex = list.length;
    }
    list.splice(insertIndex, 0, item);
  }

  function readRuleField<TRule extends RuleWithFlags>(
    rule: TRule,
    key: StringFieldKey<TRule>,
  ): string {
    return (rule as Record<StringFieldKey<TRule>, string>)[key] ?? "";
  }

  function setRuleField<TRule extends RuleWithFlags>(
    rule: TRule,
    key: StringFieldKey<TRule>,
    value: string,
  ): void {
    (rule as Record<StringFieldKey<TRule>, string>)[key] = value;
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

  function renderRules(scope: DragScope): void {
    if (scope === "title") {
      renderRulesFor(ruleConfigs.title);
    } else {
      renderRulesFor(ruleConfigs.url);
    }
  }

  function renderRulesFor<TRule extends RuleWithFlags>(config: RuleConfig<TRule>): void {
    const rules = config.getRules();

    config.body.innerHTML = "";

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
    updatePreview();
  }

  function addRule(scope: DragScope): void {
    if (scope === "title") {
      addRuleFor(ruleConfigs.title);
    } else {
      addRuleFor(ruleConfigs.url);
    }
  }

  function addRuleFor<TRule extends RuleWithFlags>(config: RuleConfig<TRule>): void {
    config.getRules().push(config.createEmpty());
    renderRulesFor(config);

    const firstField = config.fields[0]?.key;
    if (firstField) {
      const selector = `tr:last-child input[data-field="${firstField}"]`;
      config.body.querySelector<HTMLInputElement>(selector)?.focus();
    }

    markDirty(config.scope);
  }

  function handleRuleInputChange(scope: DragScope, target: HTMLInputElement): void {
    if (scope === "title") {
      handleRuleInputChangeFor(ruleConfigs.title, target);
    } else {
      handleRuleInputChangeFor(ruleConfigs.url, target);
    }
  }

  function handleRuleInputChangeFor<TRule extends RuleWithFlags>(
    config: RuleConfig<TRule>,
    target: HTMLInputElement,
  ): void {
    const index = Number.parseInt(target.dataset.index ?? "", 10);
    const field = target.dataset.field;

    if (Number.isNaN(index) || !field) {
      return;
    }

    const rules = config.getRules();
    const rule = rules[index];
    if (!rule) {
      return;
    }

    let changed = false;

    if (field === "continueMatching") {
      const previous = rule.continueMatching;
      rule.continueMatching = !target.checked;
      changed = previous !== rule.continueMatching;
    } else if (field === "enabled") {
      const previous = rule.enabled !== false;
      const nextEnabled = target.checked;
      if (previous !== nextEnabled) {
        rule.enabled = nextEnabled;
        const row = target.closest<HTMLTableRowElement>("tr");
        row?.classList.toggle("rule-disabled", !nextEnabled);
        changed = true;
      }
    } else {
      const descriptor = config.fields.find((item) => item.key === field);
      if (!descriptor) {
        return;
      }

      const preserveLeadingWhitespace = descriptor.trimLeading === false;
      const nextValue = preserveLeadingWhitespace ? target.value : target.value.trimStart();
      const previousValue = readRuleField(rule, descriptor.key);
      if (previousValue !== nextValue) {
        setRuleField(rule, descriptor.key, nextValue);
        target.value = nextValue;
        changed = true;
      }
    }

    target.removeAttribute("aria-invalid");
    updatePreview();

    if (changed) {
      markDirty(config.scope);
    }
  }

  function removeRule(scope: DragScope, index: number): void {
    if (scope === "title") {
      removeRuleFor(ruleConfigs.title, index);
    } else {
      removeRuleFor(ruleConfigs.url, index);
    }
  }

  function removeRuleFor<TRule extends RuleWithFlags>(
    config: RuleConfig<TRule>,
    index: number,
  ): void {
    const rules = config.getRules();
    if (index < 0 || index >= rules.length) {
      return;
    }

    rules.splice(index, 1);
    renderRulesFor(config);
    setStatus(config.messages.removed);
    markDirty(config.scope);
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
    const existingTimeout = clearTimeouts[config.scope];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      clearTimeouts[config.scope] = undefined;
    }

    config.clearButton.hidden = true;
    config.confirmClearButton.hidden = false;
    config.confirmClearButton.focus();

    clearTimeouts[config.scope] = setTimeout(() => {
      resetClearConfirmation(config.scope);
    }, 5000);
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
    setStatus(config.messages.cleared);
    markDirty(config.scope);
  }

  function validateRules(scope: "title"): ValidationResult;
  function validateRules(scope: "url"): ValidationResult;
  function validateRules(scope: DragScope): ValidationResult {
    return scope === "title"
      ? validateRulesFor(ruleConfigs.title)
      : validateRulesFor(ruleConfigs.url);
  }

  function validateRulesFor<TRule extends RuleWithFlags>(
    config: RuleConfig<TRule>,
  ): ValidationResult {
    const rules = config.getRules();
    const { pattern, search, replace } = config.fieldKeys;

    let valid = true;
    let message: string | undefined;

    rules.forEach((rule, index) => {
      const row = config.body.querySelector(`tr[data-index="${index}"]`);
      if (!row) {
        return;
      }

      const sanitized = config.sanitize(rule);
      rules[index] = sanitized;

      if (!config.hasContent(sanitized)) {
        return;
      }

      const patternInput = row.querySelector<HTMLInputElement>(`input[data-field="${pattern}"]`);
      const searchInput = row.querySelector<HTMLInputElement>(`input[data-field="${search}"]`);
      const replaceInput = row.querySelector<HTMLInputElement>(`input[data-field="${replace}"]`);

      const patternValue = readRuleField(sanitized, pattern);
      const searchValue = readRuleField(sanitized, search);
      const replaceValue = readRuleField(sanitized, replace);

      if (!patternValue) {
        valid = false;
        message = message ?? config.messages.missingPattern;
        if (patternInput) {
          markInvalidField(patternInput);
        }
      } else if (!validateRegex(patternValue)) {
        valid = false;
        message = message ?? config.messages.invalidPattern;
        if (patternInput) {
          markInvalidField(patternInput);
        }
      }

      if (replaceValue && !searchValue) {
        valid = false;
        message = message ?? config.messages.missingSearchForReplace;
        if (searchInput) {
          markInvalidField(searchInput);
        }
      }

      if (searchValue && !validateRegex(searchValue)) {
        valid = false;
        message = message ?? config.messages.invalidSearch;
        if (searchInput) {
          markInvalidField(searchInput);
        }
      }

      replaceInput?.removeAttribute("aria-invalid");
    });

    return { valid, message };
  }

  function collectPayload(): OptionsPayload {
    const titleRules = filteredRules("title");
    const urlRules = filteredRules("url");

    return {
      version: OPTIONS_VERSION,
      format: normalizeFormat(templateField, draft),
      titleRules,
      urlRules,
    };
  }

  async function saveOptions(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    await persistOptions();
  }

  async function persistOptions(scope?: DragScope): Promise<boolean> {
    setSaving(scope, true);

    clearValidationState(titleRulesBody);
    clearValidationState(urlRulesBody);
    templateField?.removeAttribute("aria-invalid");

    const templateValidation = templateField
      ? (() => {
          if (!templateField.value.trim()) {
            templateField.setAttribute("aria-invalid", "true");
            return {
              valid: false,
              message: "Template cannot be empty.",
            } satisfies ValidationResult;
          }
          return { valid: true } satisfies ValidationResult;
        })()
      : ({ valid: true } satisfies ValidationResult);

    if (!templateValidation.valid) {
      setStatus(templateValidation.message ?? "Template validation failed.", "error");
      return false;
    }

    const titleValidation = validateRules("title");
    if (!titleValidation.valid) {
      setStatus(titleValidation.message ?? "Title rule validation failed.", "error");
      return false;
    }

    const urlValidation = validateRules("url");
    if (!urlValidation.valid) {
      setStatus(urlValidation.message ?? "URL rule validation failed.", "error");
      return false;
    }

    const payload = collectPayload();

    if (!storageArea) {
      setStatus("Chrome storage is unavailable; unable to save changes.", "error");
      return false;
    }

    try {
      await storageArea.set({
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
      setStatus(message);
      draft = cloneOptions(payload);
      renderRules("title");
      renderRules("url");
      setDirty("title", false);
      setDirty("url", false);
      return true;
    } catch (error) {
      console.error("Failed to save options.", error);
      setStatus("Failed to save options.", "error");
      return false;
    } finally {
      setSaving(scope, false);
    }
  }

  async function loadOptions(): Promise<void> {
    if (!storageArea) {
      setStatus("Chrome storage is unavailable; using defaults.", "error");
      draft = createDraft();
      if (templateField) {
        templateField.value = draft.format;
      }
      renderRules("title");
      renderRules("url");
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, "wikipedia");
      updateUrlSample(DEFAULT_PREVIEW_SAMPLE.url, "amazon");
      setDirty("title", false);
      setDirty("url", false);
      return;
    }

    try {
      const snapshot = await storageArea.get([
        "options",
        "format",
        "titleRules",
        "urlRules",
        "linkRules",
        "rules",
      ]);
      draft = cloneOptions(normalizeStoredOptions(snapshot));
      if (templateField) {
        templateField.value = draft.format;
      }
      renderRules("title");
      renderRules("url");
      setStatus("Options loaded.", "success");
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, "wikipedia");
      updateUrlSample(DEFAULT_PREVIEW_SAMPLE.url, "amazon");
      setDirty("title", false);
      setDirty("url", false);
    } catch (error) {
      console.error("Failed to load options; fallback to defaults.", error);
      draft = createDraft();
      if (templateField) {
        templateField.value = draft.format;
      }
      renderRules("title");
      renderRules("url");
      setStatus("Failed to load saved options; defaults restored.", "error");
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, "wikipedia");
      updateUrlSample(DEFAULT_PREVIEW_SAMPLE.url, "amazon");
      setDirty("title", false);
      setDirty("url", false);
    }
  }

  function updateTitleSample(nextTitle: string, preset?: string): void {
    previewSample.title = nextTitle;
    sampleTitleInput.value = previewSample.title;
    if (preset) {
      titleSamplePresetSelect.value = preset;
    }
    updatePreview();
  }

  function updateUrlSample(nextUrl: string, preset?: string): void {
    previewSample.url = nextUrl;
    sampleUrlInput.value = previewSample.url;
    if (preset) {
      urlSamplePresetSelect.value = preset;
    }
    updatePreview();
  }

  titleSamplePresetSelect?.addEventListener(
    "change",
    () => {
      const selected = titleSamplePresetSelect?.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === "custom") {
        updateTitleSample(sampleTitleInput?.value, "custom");
        return;
      }

      const nextTitle = selected.dataset.title ?? DEFAULT_PREVIEW_SAMPLE.title;
      updateTitleSample(nextTitle, selected.value);
    },
    { signal },
  );

  sampleTitleInput?.addEventListener(
    "input",
    () => {
      updateTitleSample(sampleTitleInput?.value, "custom");
    },
    { signal },
  );

  urlSamplePresetSelect?.addEventListener(
    "change",
    () => {
      const selected = urlSamplePresetSelect?.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === "custom") {
        updateUrlSample(sampleUrlInput?.value.trim(), "custom");
        return;
      }

      const nextUrl = selected.dataset.url ?? DEFAULT_PREVIEW_SAMPLE.url;
      updateUrlSample(nextUrl, selected.value);
    },
    { signal },
  );

  sampleUrlInput?.addEventListener(
    "input",
    () => {
      updateUrlSample(sampleUrlInput?.value.trim(), "custom");
    },
    { signal },
  );

  titleRulesBody?.addEventListener(
    "input",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        handleRuleInputChange("title", event.target);
      }
    },
    { signal },
  );

  titleRulesBody?.addEventListener(
    "change",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        handleRuleInputChange("title", event.target);
      }
    },
    { signal },
  );

  urlRulesBody?.addEventListener(
    "input",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        handleRuleInputChange("url", event.target);
      }
    },
    { signal },
  );

  urlRulesBody?.addEventListener(
    "change",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        handleRuleInputChange("url", event.target);
      }
    },
    { signal },
  );

  titleRulesBody?.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (target.dataset.action === "remove-title") {
        const index = Number.parseInt(target.dataset.index ?? "", 10);
        if (!Number.isNaN(index)) {
          removeRule("title", index);
        }
      }
    },
    { signal },
  );

  urlRulesBody?.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (target.dataset.action === "remove-url") {
        const index = Number.parseInt(target.dataset.index ?? "", 10);
        if (!Number.isNaN(index)) {
          removeRule("url", index);
        }
      }
    },
    { signal },
  );

  addTitleRuleButton.addEventListener(
    "click",
    () => {
      addRule("title");
    },
    { signal },
  );
  addUrlRuleButton.addEventListener(
    "click",
    () => {
      addRule("url");
    },
    { signal },
  );

  saveTitleRuleButton.addEventListener(
    "click",
    () => {
      if (savingState.title || !dirtyState.title) {
        return;
      }
      void persistOptions("title");
    },
    { signal },
  );

  saveUrlRuleButton.addEventListener(
    "click",
    () => {
      if (savingState.url || !dirtyState.url) {
        return;
      }
      void persistOptions("url");
    },
    { signal },
  );

  clearTitleRulesButton?.addEventListener(
    "click",
    () => {
      promptClearRules("title");
    },
    { signal },
  );

  confirmClearTitleRulesButton?.addEventListener(
    "click",
    () => {
      confirmClearRules("title");
    },
    { signal },
  );

  clearUrlRulesButton?.addEventListener(
    "click",
    () => {
      promptClearRules("url");
    },
    { signal },
  );

  confirmClearUrlRulesButton?.addEventListener(
    "click",
    () => {
      confirmClearRules("url");
    },
    { signal },
  );

  if (templateField) {
    templateField.addEventListener(
      "input",
      () => {
        draft.format = templateField.value;
        updatePreview();
      },
      { signal },
    );
  }

  restoreTemplateButton?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      if (templateField) {
        templateField.value = DEFAULT_TEMPLATE;
      }
      draft.format = DEFAULT_TEMPLATE;
      updatePreview();
      setStatus("Template restored to default.");
    },
    { signal },
  );

  form.addEventListener(
    "submit",
    (event) => {
      void saveOptions(event);
    },
    { signal },
  );

  void loadOptions();

  return () => {
    abortController.abort();
    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }
    Object.values(clearTimeouts).forEach((timeout) => {
      if (timeout) {
        clearTimeout(timeout);
      }
    });
    draft = createDraft();
  };
}
