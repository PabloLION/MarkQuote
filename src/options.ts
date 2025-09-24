import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_AMAZON_SAMPLE_URL,
  DEFAULT_OPTIONS,
  DEFAULT_TEMPLATE,
  normalizeStoredOptions,
  type UrlRule,
  type OptionsPayload,
  type TitleRule,
} from './options-schema.js';
import { applyUrlRules, applyTitleRules, formatWithOptions } from './formatting.js';

const DEFAULT_PREVIEW_SAMPLE = {
  text: 'Markdown is a lightweight markup language for creating formatted text using a plain-text editor.',
  title: 'Markdown - Wikipedia',
  url: DEFAULT_AMAZON_SAMPLE_URL,
};

const STATUS_TIMEOUT_MS = 3000;

interface ValidationResult {
  valid: boolean;
  message?: string;
}

function cloneTitleRule(rule: TitleRule): TitleRule {
  return { ...rule };
}

function cloneUrlRule(rule: UrlRule): UrlRule {
  return { ...rule };
}

function cloneOptions(options: OptionsPayload): OptionsPayload {
  return {
    version: CURRENT_OPTIONS_VERSION,
    format: options.format,
    titleRules: options.titleRules.map((rule) => cloneTitleRule(rule)),
    urlRules: options.urlRules.map((rule) => cloneUrlRule(rule)),
  };
}

function sanitizeTitleRule(rule: TitleRule): TitleRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    titleSearch: rule.titleSearch.trim(),
    titleReplace: rule.titleReplace,
    continueMatching: Boolean(rule.continueMatching),
  };
}

function sanitizeUrlRule(rule: UrlRule): UrlRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    urlSearch: rule.urlSearch.trim(),
    urlReplace: rule.urlReplace,
    continueMatching: Boolean(rule.continueMatching),
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
  const form = document.getElementById('options-form') as HTMLFormElement | null;
  const templateField = document.getElementById('format-template') as HTMLTextAreaElement | null;
  const restoreTemplateButton = document.getElementById('restore-template') as HTMLButtonElement | null;
  const previewElement = document.getElementById('format-preview') as HTMLElement | null;
  const statusElement = document.getElementById('status') as HTMLElement | null;

  const titleSamplePresetSelect = document.getElementById('title-sample-preset') as HTMLSelectElement | null;
  const urlSamplePresetSelect = document.getElementById('url-sample-preset') as HTMLSelectElement | null;
  const sampleTitleInput = document.getElementById('sample-title') as HTMLInputElement | null;
  const sampleUrlInput = document.getElementById('sample-url') as HTMLInputElement | null;
  const sampleOutputTitle = document.getElementById('sample-output-title') as HTMLElement | null;
  const sampleOutputUrl = document.getElementById('sample-output-url') as HTMLElement | null;

  const titleRulesBody = document.getElementById('title-rules-body') as HTMLTableSectionElement | null;
  const addTitleRuleButton = document.getElementById('add-title-rule') as HTMLButtonElement | null;
  const clearTitleRulesButton = document.getElementById('clear-title-rules') as HTMLButtonElement | null;
  const confirmClearTitleRulesButton = document.getElementById('confirm-clear-title-rules') as HTMLButtonElement | null;
  const titleClearStatusElement = document.getElementById('title-clear-status') as HTMLElement | null;

  const urlRulesBody = document.getElementById('url-rules-body') as HTMLTableSectionElement | null;
  const addUrlRuleButton = document.getElementById('add-url-rule') as HTMLButtonElement | null;
  const clearUrlRulesButton = document.getElementById('clear-url-rules') as HTMLButtonElement | null;
  const confirmClearUrlRulesButton = document.getElementById('confirm-clear-url-rules') as HTMLButtonElement | null;
  const urlClearStatusElement = document.getElementById('url-clear-status') as HTMLElement | null;

  if (
    !(form instanceof HTMLFormElement) ||
    !(templateField instanceof HTMLTextAreaElement) ||
    !(restoreTemplateButton instanceof HTMLButtonElement) ||
    !(previewElement instanceof HTMLElement) ||
    !(statusElement instanceof HTMLElement) ||
    !(titleSamplePresetSelect instanceof HTMLSelectElement) ||
    !(urlSamplePresetSelect instanceof HTMLSelectElement) ||
    !(sampleTitleInput instanceof HTMLInputElement) ||
    !(sampleUrlInput instanceof HTMLInputElement) ||
    !(sampleOutputTitle instanceof HTMLElement) ||
    !(sampleOutputUrl instanceof HTMLElement) ||
    !(titleRulesBody instanceof HTMLTableSectionElement) ||
    !(addTitleRuleButton instanceof HTMLButtonElement) ||
    !(clearTitleRulesButton instanceof HTMLButtonElement) ||
    !(confirmClearTitleRulesButton instanceof HTMLButtonElement) ||
    !(titleClearStatusElement instanceof HTMLElement) ||
    !(urlRulesBody instanceof HTMLTableSectionElement) ||
    !(addUrlRuleButton instanceof HTMLButtonElement) ||
    !(clearUrlRulesButton instanceof HTMLButtonElement) ||
    !(confirmClearUrlRulesButton instanceof HTMLButtonElement) ||
    !(urlClearStatusElement instanceof HTMLElement)
  ) {
    console.warn('Options UI is missing expected elements; aborting initialization.');
    return () => {};
  }

  const storageArea = globalThis.chrome?.storage?.sync;

  const abortController = new AbortController();
  const { signal } = abortController;

  let statusTimeout: ReturnType<typeof setTimeout> | undefined;
  let titleClearTimeout: ReturnType<typeof setTimeout> | undefined;
  let urlClearTimeout: ReturnType<typeof setTimeout> | undefined;

  let draft: OptionsPayload = cloneOptions(DEFAULT_OPTIONS);
  const previewSample = {
    title: DEFAULT_PREVIEW_SAMPLE.title,
    url: DEFAULT_PREVIEW_SAMPLE.url,
  };

  function scheduleStatusClear(): void {
    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }

    if (!statusElement!.textContent) {
      return;
    }

    statusTimeout = setTimeout(() => {
      statusElement!.textContent = '';
      statusElement!.removeAttribute('data-variant');
    }, STATUS_TIMEOUT_MS);
  }

  function setStatus(message: string, variant: 'success' | 'error' = 'success'): void {
    statusElement!.textContent = message;
    statusElement!.setAttribute('data-variant', variant);
    scheduleStatusClear();
  }

  function showTitleClearStatus(message: string): void {
    if (!message) {
      titleClearStatusElement!.textContent = '';
      titleClearStatusElement!.hidden = true;
      return;
    }

    titleClearStatusElement!.textContent = message;
    titleClearStatusElement!.hidden = false;
  }

  function showUrlClearStatus(message: string): void {
    if (!message) {
      urlClearStatusElement!.textContent = '';
      urlClearStatusElement!.hidden = true;
      return;
    }

    urlClearStatusElement!.textContent = message;
    urlClearStatusElement!.hidden = false;
  }

  function resetTitleClearConfirmation(): void {
    if (titleClearTimeout) {
      clearTimeout(titleClearTimeout);
      titleClearTimeout = undefined;
    }

    clearTitleRulesButton!.hidden = false;
    confirmClearTitleRulesButton!.hidden = true;
  }

  function resetUrlClearConfirmation(): void {
    if (urlClearTimeout) {
      clearTimeout(urlClearTimeout);
      urlClearTimeout = undefined;
    }

    clearUrlRulesButton!.hidden = false;
    confirmClearUrlRulesButton!.hidden = true;
  }

  function filteredTitleRules(): TitleRule[] {
    return draft.titleRules
      .map((rule) => sanitizeTitleRule(rule))
      .filter((rule) => rule.urlPattern || rule.titleSearch || rule.titleReplace);
  }

  function filteredUrlRules(): UrlRule[] {
    return draft.urlRules
      .map((rule) => sanitizeUrlRule(rule))
      .filter((rule) => rule.urlPattern || rule.urlSearch || rule.urlReplace);
  }

  function updatePreview(): void {
    const titleRules = filteredTitleRules();
    const urlRules = filteredUrlRules();

    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: templateField!.value,
      titleRules,
      urlRules,
    };

    previewElement!.textContent = formatWithOptions(options, {
      text: DEFAULT_PREVIEW_SAMPLE.text,
      title: previewSample.title,
      url: previewSample.url,
    });

    const transformedTitle = applyTitleRules(titleRules, previewSample.title, previewSample.url);
    const transformedUrl = applyUrlRules(urlRules, previewSample.url);

    sampleOutputTitle!.textContent = transformedTitle || '—';
    sampleOutputUrl!.textContent = transformedUrl || '—';
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

  function createToggleCell(field: string, index: number, checked: boolean): HTMLTableCellElement {
    const cell = document.createElement('td');
    cell.classList.add('toggle-cell');

    const input = document.createElement('input');

    input.type = 'checkbox';
    input.dataset.index = String(index);
    input.dataset.field = field;
    input.checked = checked;

    cell.append(input);

    return cell;
  }

  function createRemoveCell(index: number, scope: 'title' | 'url'): HTMLTableCellElement {
    const cell = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Remove';
    button.dataset.action = scope === 'title' ? 'remove-title' : 'remove-url';
    button.dataset.index = String(index);
    cell.append(button);
    return cell;
  }

  function renderTitleRules(): void {
    titleRulesBody!.innerHTML = '';

    draft.titleRules.forEach((rule, index) => {
      const row = document.createElement('tr');
      row.dataset.index = String(index);

      row.append(
        createInputCell('urlPattern', index, rule.urlPattern, 'URL pattern'),
        createInputCell('titleSearch', index, rule.titleSearch, 'Title search'),
        createInputCell('titleReplace', index, rule.titleReplace, 'Title replace'),
        createToggleCell(
          'continueMatching',
          index,
          Boolean(rule.continueMatching),
        ),
        createRemoveCell(index, 'title'),
      );

      titleRulesBody!.append(row);
    });

    resetTitleClearConfirmation();
    showTitleClearStatus('');
    updatePreview();
  }

  function renderUrlRules(): void {
    urlRulesBody!.innerHTML = '';

    draft.urlRules.forEach((rule, index) => {
      const row = document.createElement('tr');
      row.dataset.index = String(index);

      row.append(
        createInputCell('urlPattern', index, rule.urlPattern, 'URL pattern'),
        createInputCell('urlSearch', index, rule.urlSearch, 'URL search'),
        createInputCell('urlReplace', index, rule.urlReplace, 'URL replace'),
        createToggleCell(
          'continueMatching',
          index,
          Boolean(rule.continueMatching),
        ),
        createRemoveCell(index, 'url'),
      );

      urlRulesBody!.append(row);
    });

    resetUrlClearConfirmation();
    showUrlClearStatus('');
    updatePreview();
  }

  function addTitleRule(): void {
    draft.titleRules.push({
      urlPattern: '',
      titleSearch: '',
      titleReplace: '',
      continueMatching: false,
    });
    renderTitleRules();

    const lastRowInput = titleRulesBody!.querySelector<HTMLInputElement>('tr:last-child input[data-field="urlPattern"]');
    lastRowInput?.focus();
  }

  function addUrlRule(): void {
    draft.urlRules.push({
      urlPattern: '',
      urlSearch: '',
      urlReplace: '',
      continueMatching: false,
    });
    renderUrlRules();

    const lastRowInput = urlRulesBody!.querySelector<HTMLInputElement>('tr:last-child input[data-field="urlPattern"]');
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

    if (field === 'continueMatching') {
      rule[field] = target.checked;
    } else if (field === 'titleReplace') {
      rule[field] = target.value;
    } else {
      rule[field] = target.value.trimStart();
    }
    target.removeAttribute('aria-invalid');
    updatePreview();
  }

  function applyUrlInputChange(target: HTMLInputElement): void {
    const index = Number.parseInt(target.dataset.index ?? '', 10);
    const field = target.dataset.field as keyof UrlRule | undefined;

    if (Number.isNaN(index) || field === undefined) {
      return;
    }

    const rule = draft.urlRules[index];
    if (!rule) {
      return;
    }

    if (field === 'continueMatching') {
      rule[field] = target.checked;
    } else if (field === 'urlReplace') {
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
      const row = titleRulesBody!.querySelector(`tr[data-index="${index}"]`);
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

  function validateUrlRules(): ValidationResult {
    let valid = true;
    let message: string | undefined;

    draft.urlRules.forEach((rule, index) => {
      const row = urlRulesBody!.querySelector(`tr[data-index="${index}"]`);
      if (!row) {
        return;
      }

      const urlInput = row.querySelector<HTMLInputElement>('input[data-field="urlPattern"]');
      const urlSearchInput = row.querySelector<HTMLInputElement>('input[data-field="urlSearch"]');
      const urlReplaceInput = row.querySelector<HTMLInputElement>('input[data-field="urlReplace"]');

      const sanitized = sanitizeUrlRule(rule);
      draft.urlRules[index] = sanitized;

      const hasRule = Boolean(sanitized.urlPattern || sanitized.urlSearch || sanitized.urlReplace);
      if (!hasRule) {
        return;
      }

      if (!sanitized.urlPattern) {
        valid = false;
        message = message ?? 'URL pattern is required when defining a URL rule.';
        urlInput?.setAttribute('aria-invalid', 'true');
      } else if (!validateRegex(sanitized.urlPattern)) {
        valid = false;
        message = message ?? 'One or more URL rule URL patterns are invalid regex expressions.';
        urlInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.urlReplace && !sanitized.urlSearch) {
        valid = false;
        message = message ?? 'Provide a URL search pattern before specifying a URL replacement.';
        urlSearchInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.urlSearch && !validateRegex(sanitized.urlSearch)) {
        valid = false;
        message = message ?? 'One or more URL search patterns are invalid regex expressions.';
        urlSearchInput?.setAttribute('aria-invalid', 'true');
      }

      urlReplaceInput?.removeAttribute('aria-invalid');
    });

    return { valid, message };
  }

  function collectPayload(): OptionsPayload {
    const titleRules = filteredTitleRules();
    const urlRules = filteredUrlRules();

    return {
      version: CURRENT_OPTIONS_VERSION,
      format: templateField!.value,
      titleRules,
      urlRules,
    };
  }

  async function saveOptions(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    clearValidationState(titleRulesBody!);
    clearValidationState(urlRulesBody!);
    templateField!.removeAttribute('aria-invalid');

    const templateValidation = (() => {
      if (!templateField!.value.trim()) {
        templateField!.setAttribute('aria-invalid', 'true');
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

    const urlValidation = validateUrlRules();
    if (!urlValidation.valid) {
      setStatus(urlValidation.message ?? 'URL rule validation failed.', 'error');
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
        urlRules: payload.urlRules,
      });
      setStatus('Options saved successfully.');
      draft = cloneOptions(payload);
      renderTitleRules();
      renderUrlRules();
    } catch (error) {
      console.error('Failed to save options.', error);
      setStatus('Failed to save options.', 'error');
    }
  }

  async function loadOptions(): Promise<void> {
    if (!storageArea) {
      setStatus('Chrome storage is unavailable; using defaults.', 'error');
      draft = cloneOptions(DEFAULT_OPTIONS);
      templateField!.value = draft.format;
      renderTitleRules();
      renderUrlRules();
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, 'wikipedia');
      updateUrlSample(DEFAULT_PREVIEW_SAMPLE.url, 'amazon');
      return;
    }

    try {
      const snapshot = await storageArea.get([
        'options',
        'format',
        'titleRules',
        'urlRules',
        'linkRules',
        'rules',
      ]);
      draft = cloneOptions(normalizeStoredOptions(snapshot));
      templateField!.value = draft.format;
      renderTitleRules();
      renderUrlRules();
      setStatus('Options loaded.', 'success');
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, 'wikipedia');
      updateUrlSample(DEFAULT_PREVIEW_SAMPLE.url, 'amazon');
    } catch (error) {
      console.error('Failed to load options; fallback to defaults.', error);
      draft = cloneOptions(DEFAULT_OPTIONS);
      templateField!.value = draft.format;
      renderTitleRules();
      renderUrlRules();
      setStatus('Failed to load saved options; defaults restored.', 'error');
      updateTitleSample(DEFAULT_PREVIEW_SAMPLE.title, 'wikipedia');
      updateUrlSample(DEFAULT_PREVIEW_SAMPLE.url, 'amazon');
    }
  }

  function updateTitleSample(nextTitle: string, preset?: string): void {
    previewSample.title = nextTitle;
    sampleTitleInput!.value = previewSample.title;
    if (preset) {
      titleSamplePresetSelect!.value = preset;
    }
    updatePreview();
  }

  function updateUrlSample(nextUrl: string, preset?: string): void {
    previewSample.url = nextUrl;
    sampleUrlInput!.value = previewSample.url;
    if (preset) {
      urlSamplePresetSelect!.value = preset;
    }
    updatePreview();
  }

  titleSamplePresetSelect!.addEventListener(
    'change',
    () => {
      const selected = titleSamplePresetSelect!.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === 'custom') {
        updateTitleSample(sampleTitleInput!.value, 'custom');
        return;
      }

      const nextTitle = selected.dataset.title ?? DEFAULT_PREVIEW_SAMPLE.title;
      updateTitleSample(nextTitle, selected.value);
    },
    { signal },
  );

  sampleTitleInput!.addEventListener(
    'input',
    () => {
      updateTitleSample(sampleTitleInput!.value, 'custom');
    },
    { signal },
  );

  urlSamplePresetSelect!.addEventListener(
    'change',
    () => {
      const selected = urlSamplePresetSelect!.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === 'custom') {
        updateUrlSample(sampleUrlInput!.value.trim(), 'custom');
        return;
      }

      const nextUrl = selected.dataset.url ?? DEFAULT_PREVIEW_SAMPLE.url;
      updateUrlSample(nextUrl, selected.value);
    },
    { signal },
  );

  sampleUrlInput!.addEventListener(
    'input',
    () => {
      updateUrlSample(sampleUrlInput!.value.trim(), 'custom');
    },
    { signal },
  );

  titleRulesBody!.addEventListener(
    'input',
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        applyTitleInputChange(event.target);
      }
    },
    { signal },
  );

  titleRulesBody!.addEventListener(
    'change',
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        applyTitleInputChange(event.target);
      }
    },
    { signal },
  );

  urlRulesBody!.addEventListener(
    'input',
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        applyUrlInputChange(event.target);
      }
    },
    { signal },
  );

  urlRulesBody!.addEventListener(
    'change',
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        applyUrlInputChange(event.target);
      }
    },
    { signal },
  );

  titleRulesBody!.addEventListener(
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

  urlRulesBody!.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (target.dataset.action === 'remove-url') {
        const index = Number.parseInt(target.dataset.index ?? '', 10);
        if (!Number.isNaN(index)) {
          draft.urlRules.splice(index, 1);
          renderUrlRules();
          setStatus('URL rule removed.');
        }
      }
    },
    { signal },
  );

  addTitleRuleButton.addEventListener('click', addTitleRule, { signal });
  addUrlRuleButton.addEventListener('click', addUrlRule, { signal });

  clearTitleRulesButton!.addEventListener(
    'click',
    () => {
      showTitleClearStatus('');
      if (titleClearTimeout) {
        clearTimeout(titleClearTimeout);
        titleClearTimeout = undefined;
      }

      clearTitleRulesButton!.hidden = true;
      confirmClearTitleRulesButton!.hidden = false;
      confirmClearTitleRulesButton!.focus();

      titleClearTimeout = setTimeout(() => {
        resetTitleClearConfirmation();
      }, 5000);
    },
    { signal },
  );

  confirmClearTitleRulesButton!.addEventListener(
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

  clearUrlRulesButton!.addEventListener(
    'click',
    () => {
      showUrlClearStatus('');
      if (urlClearTimeout) {
        clearTimeout(urlClearTimeout);
        urlClearTimeout = undefined;
      }

      clearUrlRulesButton!.hidden = true;
      confirmClearUrlRulesButton!.hidden = false;
      confirmClearUrlRulesButton!.focus();

      urlClearTimeout = setTimeout(() => {
        resetUrlClearConfirmation();
      }, 5000);
    },
    { signal },
  );

  confirmClearUrlRulesButton!.addEventListener(
    'click',
    () => {
      resetUrlClearConfirmation();
      draft.urlRules = [];
      renderUrlRules();
      showUrlClearStatus('All URL rules cleared.');
      setStatus('All URL rules cleared.');
    },
    { signal },
  );

  templateField!.addEventListener(
    'input',
    () => {
      draft.format = templateField!.value;
      updatePreview();
    },
    { signal },
  );

  restoreTemplateButton.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      templateField!.value = DEFAULT_TEMPLATE;
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
    if (urlClearTimeout) {
      clearTimeout(urlClearTimeout);
    }
    draft = cloneOptions(DEFAULT_OPTIONS);
  };
}
