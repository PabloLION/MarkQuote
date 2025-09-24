import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_AMAZON_SAMPLE_URL,
  DEFAULT_OPTIONS,
  DEFAULT_TEMPLATE,
  normalizeStoredOptions,
  type LinkRule,
  type OptionsPayload,
  type TitleRule,
} from './options-schema.js';
import { applyLinkRules, applyTitleRules, formatWithOptions } from './formatting.js';

const DEFAULT_PREVIEW_SAMPLE = {
  text: 'Markdown is a lightweight markup language for creating formatted text using a plain-text editor.',
  title: 'Markdown - Wikipedia',
  link: DEFAULT_AMAZON_SAMPLE_URL,
};

const STATUS_TIMEOUT_MS = 3000;

interface ValidationResult {
  valid: boolean;
  message?: string;
}

function cloneTitleRule(rule: TitleRule): TitleRule {
  return { ...rule };
}

function cloneLinkRule(rule: LinkRule): LinkRule {
  return { ...rule };
}

function cloneOptions(options: OptionsPayload): OptionsPayload {
  return {
    version: CURRENT_OPTIONS_VERSION,
    format: options.format,
    titleRules: options.titleRules.map((rule) => cloneTitleRule(rule)),
    linkRules: options.linkRules.map((rule) => cloneLinkRule(rule)),
  };
}

function sanitizeTitleRule(rule: TitleRule): TitleRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    titleSearch: rule.titleSearch.trim(),
    titleReplace: rule.titleReplace,
  };
}

function sanitizeLinkRule(rule: LinkRule): LinkRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    linkSearch: rule.linkSearch.trim(),
    linkReplace: rule.linkReplace,
  };
}

function clearValidationState(container: HTMLElement): void {
  container.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
    element.removeAttribute('aria-invalid');
  });
}

function markInvalidField(input: HTMLInputElement): void {
  input.setAttribute('aria-invalid', 'true');
}

function validateRegex(pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  try {
    new RegExp(pattern);
    return true;
  } catch (error) {
    console.error('Invalid regex pattern.', { pattern, error });
    return false;
  }
}

export function initializeOptions(): () => void {
  const form = document.getElementById('options-form');
  const templateField = document.getElementById('format-template');
  const restoreTemplateButton = document.getElementById('restore-template');
  const previewElement = document.getElementById('format-preview');
  const statusElement = document.getElementById('status');

  const titleSamplePresetSelect = document.getElementById('title-sample-preset');
  const linkSamplePresetSelect = document.getElementById('link-sample-preset');
  const sampleTitleInput = document.getElementById('sample-title');
  const sampleUrlInput = document.getElementById('sample-url');
  const sampleOutputTitle = document.getElementById('sample-output-title');
  const sampleOutputUrl = document.getElementById('sample-output-url');

  const titleRulesBody = document.getElementById('title-rules-body');
  const addTitleRuleButton = document.getElementById('add-title-rule');
  const clearTitleRulesButton = document.getElementById('clear-title-rules');
  const confirmClearTitleRulesButton = document.getElementById('confirm-clear-title-rules');
  const titleClearStatusElement = document.getElementById('title-clear-status');

  const linkRulesBody = document.getElementById('link-rules-body');
  const addLinkRuleButton = document.getElementById('add-link-rule');
  const clearLinkRulesButton = document.getElementById('clear-link-rules');
  const confirmClearLinkRulesButton = document.getElementById('confirm-clear-link-rules');
  const linkClearStatusElement = document.getElementById('link-clear-status');

  if (
    !(form instanceof HTMLFormElement) ||
    !(templateField instanceof HTMLTextAreaElement) ||
    !(restoreTemplateButton instanceof HTMLButtonElement) ||
    !(previewElement instanceof HTMLElement) ||
    !(statusElement instanceof HTMLElement) ||
    !(titleSamplePresetSelect instanceof HTMLSelectElement) ||
    !(linkSamplePresetSelect instanceof HTMLSelectElement) ||
    !(sampleTitleInput instanceof HTMLInputElement) ||
    !(sampleUrlInput instanceof HTMLInputElement) ||
    !(sampleOutputTitle instanceof HTMLElement) ||
    !(sampleOutputUrl instanceof HTMLElement) ||
    !(titleRulesBody instanceof HTMLTableSectionElement) ||
    !(addTitleRuleButton instanceof HTMLButtonElement) ||
    !(clearTitleRulesButton instanceof HTMLButtonElement) ||
    !(confirmClearTitleRulesButton instanceof HTMLButtonElement) ||
    !(titleClearStatusElement instanceof HTMLElement) ||
    !(linkRulesBody instanceof HTMLTableSectionElement) ||
    !(addLinkRuleButton instanceof HTMLButtonElement) ||
    !(clearLinkRulesButton instanceof HTMLButtonElement) ||
    !(confirmClearLinkRulesButton instanceof HTMLButtonElement) ||
    !(linkClearStatusElement instanceof HTMLElement)
  ) {
    console.warn('Options UI is missing expected elements; aborting initialization.');
    return () => {};
  }

  const storageArea = globalThis.chrome?.storage?.sync;

  const abortController = new AbortController();
  const { signal } = abortController;

  let statusTimeout: ReturnType<typeof setTimeout> | undefined;
  let titleClearTimeout: ReturnType<typeof setTimeout> | undefined;
  let linkClearTimeout: ReturnType<typeof setTimeout> | undefined;

  let draft: OptionsPayload = cloneOptions(DEFAULT_OPTIONS);
  const previewSample = {
    title: DEFAULT_PREVIEW_SAMPLE.title,
    link: DEFAULT_PREVIEW_SAMPLE.link,
  };

  function scheduleStatusClear(): void {
    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }

    if (!statusElement.textContent) {
      return;
    }

    statusTimeout = setTimeout(() => {
      statusElement.textContent = '';
      statusElement.removeAttribute('data-variant');
    }, STATUS_TIMEOUT_MS);
  }

  function setStatus(message: string, variant: 'success' | 'error' = 'success'): void {
    statusElement.textContent = message;
    statusElement.setAttribute('data-variant', variant);
    scheduleStatusClear();
  }

  function showTitleClearStatus(message: string): void {
    if (!message) {
      titleClearStatusElement.textContent = '';
      titleClearStatusElement.hidden = true;
      return;
    }

    titleClearStatusElement.textContent = message;
    titleClearStatusElement.hidden = false;
  }

  function showLinkClearStatus(message: string): void {
    if (!message) {
      linkClearStatusElement.textContent = '';
      linkClearStatusElement.hidden = true;
      return;
    }

    linkClearStatusElement.textContent = message;
    linkClearStatusElement.hidden = false;
  }

  function resetTitleClearConfirmation(): void {
    if (titleClearTimeout) {
      clearTimeout(titleClearTimeout);
      titleClearTimeout = undefined;
    }

    clearTitleRulesButton.hidden = false;
    confirmClearTitleRulesButton.hidden = true;
  }

  function resetLinkClearConfirmation(): void {
    if (linkClearTimeout) {
      clearTimeout(linkClearTimeout);
      linkClearTimeout = undefined;
    }

    clearLinkRulesButton.hidden = false;
    confirmClearLinkRulesButton.hidden = true;
  }

  function filteredTitleRules(): TitleRule[] {
    return draft.titleRules
      .map((rule) => sanitizeTitleRule(rule))
      .filter((rule) => rule.urlPattern || rule.titleSearch || rule.titleReplace);
  }

  function filteredLinkRules(): LinkRule[] {
    return draft.linkRules
      .map((rule) => sanitizeLinkRule(rule))
      .filter((rule) => rule.urlPattern || rule.linkSearch || rule.linkReplace);
  }

  function updatePreview(): void {
    const titleRules = filteredTitleRules();
    const linkRules = filteredLinkRules();

    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: templateField.value,
      titleRules,
      linkRules,
    };

    previewElement.textContent = formatWithOptions(options, {
      text: DEFAULT_PREVIEW_SAMPLE.text,
      title: previewSample.title,
      link: previewSample.link,
    });

    const transformedTitle = applyTitleRules(titleRules, previewSample.title, previewSample.link);
    const transformedLink = applyLinkRules(linkRules, previewSample.link);

    sampleOutputTitle.textContent = transformedTitle || '—';
    sampleOutputUrl.textContent = transformedLink || '—';
  }

  function createInputCell(
    field: string,
    index: number,
    value: string,
    label: string,
  ): HTMLTableCellElement {
    const cell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.index = String(index);
    input.dataset.field = field;
    input.placeholder = label;
    input.value = value;
    cell.append(input);
    return cell;
  }

  function createRemoveCell(index: number, scope: 'title' | 'link'): HTMLTableCellElement {
    const cell = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Remove';
    button.dataset.action = scope === 'title' ? 'remove-title' : 'remove-link';
    button.dataset.index = String(index);
    cell.append(button);
    return cell;
  }

  function renderTitleRules(): void {
    titleRulesBody.innerHTML = '';

    draft.titleRules.forEach((rule, index) => {
      const row = document.createElement('tr');
      row.dataset.index = String(index);

      row.append(
        createInputCell('urlPattern', index, rule.urlPattern, 'URL pattern'),
        createInputCell('titleSearch', index, rule.titleSearch, 'Title search'),
        createInputCell('titleReplace', index, rule.titleReplace, 'Title replace'),
        createRemoveCell(index, 'title'),
      );

      titleRulesBody.append(row);
    });

    resetTitleClearConfirmation();
    showTitleClearStatus('');
    updatePreview();
  }

  function renderLinkRules(): void {
    linkRulesBody.innerHTML = '';

    draft.linkRules.forEach((rule, index) => {
      const row = document.createElement('tr');
      row.dataset.index = String(index);

      row.append(
        createInputCell('urlPattern', index, rule.urlPattern, 'URL pattern'),
        createInputCell('linkSearch', index, rule.linkSearch, 'Link search'),
        createInputCell('linkReplace', index, rule.linkReplace, 'Link replace'),
        createRemoveCell(index, 'link'),
      );

      linkRulesBody.append(row);
    });

    resetLinkClearConfirmation();
    showLinkClearStatus('');
    updatePreview();
  }

  function addTitleRule(): void {
    draft.titleRules.push({
      urlPattern: '',
      titleSearch: '',
      titleReplace: '',
    });
    renderTitleRules();

    const lastRowInput = titleRulesBody.querySelector<HTMLInputElement>('tr:last-child input[data-field="urlPattern"]');
    lastRowInput?.focus();
  }

  function addLinkRule(): void {
    draft.linkRules.push({
      urlPattern: '',
      linkSearch: '',
      linkReplace: '',
    });
    renderLinkRules();

    const lastRowInput = linkRulesBody.querySelector<HTMLInputElement>('tr:last-child input[data-field="urlPattern"]');
    lastRowInput?.focus();
  }

  function applyTitleInputChange(target: HTMLInputElement): void {
    const index = Number.parseInt(target.dataset.index ?? '', 10);
    const field = target.dataset.field as keyof TitleRule | undefined;

    if (Number.isNaN(index) || field === undefined) {
      return;
    }

    const rule = draft.titleRules[index];
    if (!rule) {
      return;
    }

    if (field === 'titleReplace') {
      rule[field] = target.value;
    } else {
      rule[field] = target.value.trimStart();
    }
    target.removeAttribute('aria-invalid');
    updatePreview();
  }

  function applyLinkInputChange(target: HTMLInputElement): void {
    const index = Number.parseInt(target.dataset.index ?? '', 10);
    const field = target.dataset.field as keyof LinkRule | undefined;

    if (Number.isNaN(index) || field === undefined) {
      return;
    }

    const rule = draft.linkRules[index];
    if (!rule) {
      return;
    }

    if (field === 'linkReplace') {
      rule[field] = target.value;
    } else {
      rule[field] = target.value.trimStart();
    }
    target.removeAttribute('aria-invalid');
    updatePreview();
  }

  function validateTitleRules(): ValidationResult {
    let valid = true;
    let message: string | undefined;

    draft.titleRules.forEach((rule, index) => {
      const row = titleRulesBody.querySelector(`tr[data-index="${index}"]`);
      if (!row) {
        return;
      }

      const urlInput = row.querySelector<HTMLInputElement>('input[data-field="urlPattern"]');
      const titleSearchInput = row.querySelector<HTMLInputElement>('input[data-field="titleSearch"]');
      const titleReplaceInput = row.querySelector<HTMLInputElement>('input[data-field="titleReplace"]');

      const sanitized = sanitizeTitleRule(rule);
      draft.titleRules[index] = sanitized;

      const hasRule = Boolean(sanitized.urlPattern || sanitized.titleSearch || sanitized.titleReplace);
      if (!hasRule) {
        return;
      }

      if (!sanitized.urlPattern) {
        valid = false;
        message = message ?? 'URL pattern is required when defining a title rule.';
        urlInput?.setAttribute('aria-invalid', 'true');
      } else if (!validateRegex(sanitized.urlPattern)) {
        valid = false;
        message = message ?? 'One or more title rule URL patterns are invalid regex expressions.';
        urlInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.titleReplace && !sanitized.titleSearch) {
        valid = false;
        message = message ?? 'Provide a title search pattern before specifying a title replacement.';
        titleSearchInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.titleSearch && !validateRegex(sanitized.titleSearch)) {
        valid = false;
        message = message ?? 'One or more title search patterns are invalid regex expressions.';
        titleSearchInput?.setAttribute('aria-invalid', 'true');
      }

      titleReplaceInput?.removeAttribute('aria-invalid');
    });

    return { valid, message };
  }

  function validateLinkRules(): ValidationResult {
    let valid = true;
    let message: string | undefined;

    draft.linkRules.forEach((rule, index) => {
      const row = linkRulesBody.querySelector(`tr[data-index="${index}"]`);
      if (!row) {
        return;
      }

      const urlInput = row.querySelector<HTMLInputElement>('input[data-field="urlPattern"]');
      const linkSearchInput = row.querySelector<HTMLInputElement>('input[data-field="linkSearch"]');
      const linkReplaceInput = row.querySelector<HTMLInputElement>('input[data-field="linkReplace"]');

      const sanitized = sanitizeLinkRule(rule);
      draft.linkRules[index] = sanitized;

      const hasRule = Boolean(sanitized.urlPattern || sanitized.linkSearch || sanitized.linkReplace);
      if (!hasRule) {
        return;
      }

      if (!sanitized.urlPattern) {
        valid = false;
        message = message ?? 'URL pattern is required when defining a link rule.';
        urlInput?.setAttribute('aria-invalid', 'true');
      } else if (!validateRegex(sanitized.urlPattern)) {
        valid = false;
        message = message ?? 'One or more link rule URL patterns are invalid regex expressions.';
        urlInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.linkReplace && !sanitized.linkSearch) {
        valid = false;
        message = message ?? 'Provide a link search pattern before specifying a link replacement.';
        linkSearchInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.linkSearch && !validateRegex(sanitized.linkSearch)) {
        valid = false;
        message = message ?? 'One or more link search patterns are invalid regex expressions.';
        linkSearchInput?.setAttribute('aria-invalid', 'true');
      }

      linkReplaceInput?.removeAttribute('aria-invalid');
    });

    return { valid, message };
  }

  function collectPayload(): OptionsPayload {
    const titleRules = filteredTitleRules();
    const linkRules = filteredLinkRules();

    return {
      version: CURRENT_OPTIONS_VERSION,
      format: templateField.value,
      titleRules,
      linkRules,
    };
  }

  async function saveOptions(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    clearValidationState(titleRulesBody);
    clearValidationState(linkRulesBody);
    templateField.removeAttribute('aria-invalid');

    const templateValidation = (() => {
      if (!templateField.value.trim()) {
        templateField.setAttribute('aria-invalid', 'true');
        return { valid: false, message: 'Template cannot be empty.' } satisfies ValidationResult;
      }
      return { valid: true } satisfies ValidationResult;
    })();

    if (!templateValidation.valid) {
      setStatus(templateValidation.message ?? 'Template validation failed.', 'error');
      return;
    }

    const titleValidation = validateTitleRules();
    if (!titleValidation.valid) {
      setStatus(titleValidation.message ?? 'Title rule validation failed.', 'error');
      return;
    }

    const linkValidation = validateLinkRules();
    if (!linkValidation.valid) {
      setStatus(linkValidation.message ?? 'Link rule validation failed.', 'error');
      return;
    }

    const payload = collectPayload();

    if (!storageArea) {
      setStatus('Chrome storage is unavailable; unable to save changes.', 'error');
      return;
    }

    try {
      await storageArea.set({
        options: payload,
        format: payload.format,
        titleRules: payload.titleRules,
        linkRules: payload.linkRules,
      });
      setStatus('Options saved successfully.');
      draft = cloneOptions(payload);
      renderTitleRules();
      renderLinkRules();
    } catch (error) {
      console.error('Failed to save options.', error);
      setStatus('Failed to save options.', 'error');
    }
  }

  async function loadOptions(): Promise<void> {
    if (!storageArea) {
      setStatus('Chrome storage is unavailable; using defaults.', 'error');
      draft = cloneOptions(DEFAULT_OPTIONS);
      templateField.value = draft.format;
      renderTitleRules();
      renderLinkRules();
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, 'wikipedia');
      updateLinkSample(DEFAULT_PREVIEW_SAMPLE.link, 'amazon');
      return;
    }

    try {
      const snapshot = await storageArea.get(['options', 'format', 'titleRules', 'linkRules', 'rules']);
      draft = cloneOptions(normalizeStoredOptions(snapshot));
      templateField.value = draft.format;
      renderTitleRules();
      renderLinkRules();
      setStatus('Options loaded.', 'success');
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, 'wikipedia');
      updateLinkSample(DEFAULT_PREVIEW_SAMPLE.link, 'amazon');
    } catch (error) {
      console.error('Failed to load options; fallback to defaults.', error);
      draft = cloneOptions(DEFAULT_OPTIONS);
      templateField.value = draft.format;
      renderTitleRules();
      renderLinkRules();
      setStatus('Failed to load saved options; defaults restored.', 'error');
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, 'wikipedia');
      updateLinkSample(DEFAULT_PREVIEW_SAMPLE.link, 'amazon');
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

  function updateLinkSample(nextLink: string, preset?: string): void {
    previewSample.link = nextLink;
    sampleUrlInput.value = previewSample.link;
    if (preset) {
      linkSamplePresetSelect.value = preset;
    }
    updatePreview();
  }

  titleSamplePresetSelect.addEventListener(
    'change',
    () => {
      const selected = titleSamplePresetSelect.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === 'custom') {
        updateTitleSample(sampleTitleInput.value, 'custom');
        return;
      }

      const nextTitle = selected.dataset.title ?? DEFAULT_PREVIEW_SAMPLE.title;
      updateTitleSample(nextTitle, selected.value);
    },
    { signal },
  );

  sampleTitleInput.addEventListener(
    'input',
    () => {
      updateTitleSample(sampleTitleInput.value, 'custom');
    },
    { signal },
  );

  linkSamplePresetSelect.addEventListener(
    'change',
    () => {
      const selected = linkSamplePresetSelect.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === 'custom') {
        updateLinkSample(sampleUrlInput.value.trim(), 'custom');
        return;
      }

      const nextLink = selected.dataset.url ?? DEFAULT_PREVIEW_SAMPLE.link;
      updateLinkSample(nextLink, selected.value);
    },
    { signal },
  );

  sampleUrlInput.addEventListener(
    'input',
    () => {
      updateLinkSample(sampleUrlInput.value.trim(), 'custom');
    },
    { signal },
  );

  titleRulesBody.addEventListener(
    'input',
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        applyTitleInputChange(event.target);
      }
    },
    { signal },
  );

  linkRulesBody.addEventListener(
    'input',
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        applyLinkInputChange(event.target);
      }
    },
    { signal },
  );

  titleRulesBody.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (target.dataset.action === 'remove-title') {
        const index = Number.parseInt(target.dataset.index ?? '', 10);
        if (!Number.isNaN(index)) {
          draft.titleRules.splice(index, 1);
          renderTitleRules();
          setStatus('Title rule removed.');
        }
      }
    },
    { signal },
  );

  linkRulesBody.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (target.dataset.action === 'remove-link') {
        const index = Number.parseInt(target.dataset.index ?? '', 10);
        if (!Number.isNaN(index)) {
          draft.linkRules.splice(index, 1);
          renderLinkRules();
          setStatus('Link rule removed.');
        }
      }
    },
    { signal },
  );

  addTitleRuleButton.addEventListener('click', addTitleRule, { signal });
  addLinkRuleButton.addEventListener('click', addLinkRule, { signal });

  clearTitleRulesButton.addEventListener(
    'click',
    () => {
      showTitleClearStatus('');
      if (titleClearTimeout) {
        clearTimeout(titleClearTimeout);
        titleClearTimeout = undefined;
      }

      clearTitleRulesButton.hidden = true;
      confirmClearTitleRulesButton.hidden = false;
      confirmClearTitleRulesButton.focus();

      titleClearTimeout = setTimeout(() => {
        resetTitleClearConfirmation();
      }, 5000);
    },
    { signal },
  );

  confirmClearTitleRulesButton.addEventListener(
    'click',
    () => {
      resetTitleClearConfirmation();
      draft.titleRules = [];
      renderTitleRules();
      showTitleClearStatus('All title rules cleared.');
      setStatus('All title rules cleared.');
    },
    { signal },
  );

  clearLinkRulesButton.addEventListener(
    'click',
    () => {
      showLinkClearStatus('');
      if (linkClearTimeout) {
        clearTimeout(linkClearTimeout);
        linkClearTimeout = undefined;
      }

      clearLinkRulesButton.hidden = true;
      confirmClearLinkRulesButton.hidden = false;
      confirmClearLinkRulesButton.focus();

      linkClearTimeout = setTimeout(() => {
        resetLinkClearConfirmation();
      }, 5000);
    },
    { signal },
  );

  confirmClearLinkRulesButton.addEventListener(
    'click',
    () => {
      resetLinkClearConfirmation();
      draft.linkRules = [];
      renderLinkRules();
      showLinkClearStatus('All link rules cleared.');
      setStatus('All link rules cleared.');
    },
    { signal },
  );

  templateField.addEventListener(
    'input',
    () => {
      draft.format = templateField.value;
      updatePreview();
    },
    { signal },
  );

  restoreTemplateButton.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      templateField.value = DEFAULT_TEMPLATE;
      draft.format = DEFAULT_TEMPLATE;
      updatePreview();
      setStatus('Template restored to default.');
    },
    { signal },
  );

  form.addEventListener(
    'submit',
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
    if (titleClearTimeout) {
      clearTimeout(titleClearTimeout);
    }
    if (linkClearTimeout) {
      clearTimeout(linkClearTimeout);
    }
    draft = cloneOptions(DEFAULT_OPTIONS);
  };
}
