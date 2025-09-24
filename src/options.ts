import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_OPTIONS,
  DEFAULT_TEMPLATE,
  normalizeStoredOptions,
  type OptionsPayload,
  type TransformRule,
} from './options-schema.js';
import { applyTransformRules, formatWithOptions } from './formatting.js';

const DEFAULT_PREVIEW_SAMPLE = {
  text: 'This domain is established to be used for illustrative examples in documents.',
  title: 'Example Domain',
  link: 'https://example.com/',
};

const STATUS_TIMEOUT_MS = 3000;

type RuleField = keyof TransformRule;

type ValidationResult = {
  valid: boolean;
  message?: string;
};

function cloneRule(rule: TransformRule): TransformRule {
  return { ...rule };
}

function cloneOptions(options: OptionsPayload): OptionsPayload {
  return {
    version: CURRENT_OPTIONS_VERSION,
    format: options.format,
    rules: options.rules.map((rule) => cloneRule(rule)),
  };
}

function sanitizeRule(rule: TransformRule): TransformRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    titleSearch: rule.titleSearch.trim(),
    titleReplace: rule.titleReplace,
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
  const addRuleButton = document.getElementById('add-rule');
  const clearRulesButton = document.getElementById('clear-rules');
  const confirmClearButton = document.getElementById('confirm-clear-rules');
  const rulesBody = document.getElementById('rules-body');
  const previewElement = document.getElementById('format-preview');
  const statusElement = document.getElementById('status');
  const samplePresetSelect = document.getElementById('sample-preset');
  const sampleTitleInput = document.getElementById('sample-title');
  const sampleUrlInput = document.getElementById('sample-url');
  const sampleOutputTitle = document.getElementById('sample-output-title');
  const sampleOutputUrl = document.getElementById('sample-output-url');

  if (
    !(form instanceof HTMLFormElement) ||
    !(templateField instanceof HTMLTextAreaElement) ||
    !(restoreTemplateButton instanceof HTMLButtonElement) ||
    !(addRuleButton instanceof HTMLButtonElement) ||
    !(clearRulesButton instanceof HTMLButtonElement) ||
    !(confirmClearButton instanceof HTMLButtonElement) ||
    !(rulesBody instanceof HTMLTableSectionElement) ||
    !(previewElement instanceof HTMLElement) ||
    !(statusElement instanceof HTMLElement) ||
    !(samplePresetSelect instanceof HTMLSelectElement) ||
    !(sampleTitleInput instanceof HTMLInputElement) ||
    !(sampleUrlInput instanceof HTMLInputElement) ||
    !(sampleOutputTitle instanceof HTMLElement) ||
    !(sampleOutputUrl instanceof HTMLElement)
  ) {
    console.warn('Options UI is missing expected elements; aborting initialization.');
    return () => {};
  }

  const storageArea = globalThis.chrome?.storage?.sync;

  const abortController = new AbortController();
  const { signal } = abortController;

  let statusTimeout: ReturnType<typeof setTimeout> | undefined;
  let draft: OptionsPayload = cloneOptions(DEFAULT_OPTIONS);
  const previewSample = {
    title: DEFAULT_PREVIEW_SAMPLE.title,
    link: DEFAULT_PREVIEW_SAMPLE.link,
  };
  let clearConfirmationTimeout: ReturnType<typeof setTimeout> | undefined;

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

  function resetClearConfirmation(): void {
    if (clearConfirmationTimeout) {
      clearTimeout(clearConfirmationTimeout);
      clearConfirmationTimeout = undefined;
    }

    confirmClearButton.hidden = true;
    clearRulesButton.hidden = false;
  }

  function updateSample(partial: { title?: string; link?: string }, preset?: string): void {
    if (partial.title !== undefined) {
      previewSample.title = partial.title;
    }

    if (partial.link !== undefined) {
      previewSample.link = partial.link;
    }

    sampleTitleInput.value = previewSample.title;
    sampleUrlInput.value = previewSample.link;

    if (preset) {
      samplePresetSelect.value = preset;
    }

    updatePreview();
  }

  function updatePreview(): void {
    const sanitizedRules = draft.rules.map((rule) => sanitizeRule(rule));
    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: templateField.value,
      rules: sanitizedRules,
    };
    previewElement.textContent = formatWithOptions(options, {
      text: DEFAULT_PREVIEW_SAMPLE.text,
      title: previewSample.title,
      link: previewSample.link,
    });

    const transformed = applyTransformRules(sanitizedRules, previewSample.title, previewSample.link);
    sampleOutputTitle.textContent = transformed.title || '—';
    sampleOutputUrl.textContent = transformed.link || '—';
  }

  function createInputCell(field: RuleField, index: number, value: string, label: string): HTMLTableCellElement {
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

  function createRemoveCell(index: number): HTMLTableCellElement {
    const cell = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Remove';
    button.dataset.action = 'remove';
    button.dataset.index = String(index);
    cell.append(button);
    return cell;
  }

  function renderRules(): void {
    rulesBody.innerHTML = '';

    draft.rules.forEach((rule, index) => {
      const row = document.createElement('tr');
      row.dataset.index = String(index);

      row.append(
        createInputCell('urlPattern', index, rule.urlPattern, 'URL pattern'),
        createInputCell('titleSearch', index, rule.titleSearch, 'Title search'),
        createInputCell('titleReplace', index, rule.titleReplace, 'Title replace'),
        createInputCell('linkSearch', index, rule.linkSearch, 'Link search'),
        createInputCell('linkReplace', index, rule.linkReplace, 'Link replace'),
        createRemoveCell(index),
      );

      rulesBody.append(row);
    });

    updatePreview();
    resetClearConfirmation();
  }

  function applyInputChange(target: HTMLInputElement): void {
    const index = Number.parseInt(target.dataset.index ?? '', 10);
    const field = target.dataset.field as RuleField | undefined;

    if (Number.isNaN(index) || field === undefined) {
      return;
    }

    const rule = draft.rules[index];
    if (!rule) {
      return;
    }

    rule[field] = target.value;
    target.removeAttribute('aria-invalid');
    updatePreview();
  }

  function validateTemplate(): ValidationResult {
    if (!templateField.value.trim()) {
      templateField.setAttribute('aria-invalid', 'true');
      return {
        valid: false,
        message: 'Template cannot be empty.',
      };
    }

    templateField.removeAttribute('aria-invalid');
    return { valid: true };
  }

  function validateRules(): ValidationResult {
    let valid = true;
    let message: string | undefined;

    draft.rules.forEach((rule, index) => {
      const row = rulesBody.querySelector(`tr[data-index="${index}"]`);
      if (!row) {
        return;
      }

      const urlInput = row.querySelector<HTMLInputElement>('input[data-field="urlPattern"]');
      const titleSearchInput = row.querySelector<HTMLInputElement>('input[data-field="titleSearch"]');
      const titleReplaceInput = row.querySelector<HTMLInputElement>('input[data-field="titleReplace"]');
      const linkSearchInput = row.querySelector<HTMLInputElement>('input[data-field="linkSearch"]');
      const linkReplaceInput = row.querySelector<HTMLInputElement>('input[data-field="linkReplace"]');

      const sanitized = sanitizeRule(rule);
      draft.rules[index] = sanitized;

      const requireRule = Boolean(sanitized.urlPattern || sanitized.titleSearch || sanitized.linkSearch);
      if (!requireRule) {
        return;
      }

      if (!sanitized.urlPattern) {
        valid = false;
        message = message ?? 'URL pattern is required when defining a rule.';
        urlInput?.setAttribute('aria-invalid', 'true');
      } else if (!validateRegex(sanitized.urlPattern)) {
        valid = false;
        message = message ?? 'One or more URL patterns are invalid regex expressions.';
        urlInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.titleReplace && !sanitized.titleSearch) {
        valid = false;
        message = message ?? 'Provide a title search pattern before specifying a title replacement.';
        titleSearchInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.linkReplace && !sanitized.linkSearch) {
        valid = false;
        message = message ?? 'Provide a link search pattern before specifying a link replacement.';
        linkSearchInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.titleSearch && !validateRegex(sanitized.titleSearch)) {
        valid = false;
        message = message ?? 'One or more title search patterns are invalid regex expressions.';
        titleSearchInput?.setAttribute('aria-invalid', 'true');
      }

      if (sanitized.linkSearch && !validateRegex(sanitized.linkSearch)) {
        valid = false;
        message = message ?? 'One or more link search patterns are invalid regex expressions.';
        linkSearchInput?.setAttribute('aria-invalid', 'true');
      }

      titleReplaceInput?.removeAttribute('aria-invalid');
      linkReplaceInput?.removeAttribute('aria-invalid');
    });

    return {
      valid,
      message,
    };
  }

  function collectPayload(): OptionsPayload {
    return {
      version: CURRENT_OPTIONS_VERSION,
      format: templateField.value,
      rules: draft.rules
        .map((rule) => sanitizeRule(rule))
        .filter((rule) => rule.urlPattern || rule.titleSearch || rule.linkSearch),
    };
  }

  async function saveOptions(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    clearValidationState(rulesBody);
    templateField.removeAttribute('aria-invalid');

    const templateValidation = validateTemplate();
    if (!templateValidation.valid) {
      setStatus(templateValidation.message ?? 'Template validation failed.', 'error');
      return;
    }

    const ruleValidation = validateRules();
    if (!ruleValidation.valid) {
      setStatus(ruleValidation.message ?? 'Rule validation failed.', 'error');
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
        titleRules: payload.rules.map((rule) => ({
          urlMatch: rule.urlPattern,
          titleMatch: rule.titleSearch,
          titleReplace: rule.titleReplace,
        })),
      });
      setStatus('Options saved successfully.');
      draft = cloneOptions(payload);
      renderRules();
    } catch (error) {
      console.error('Failed to save options.', error);
      setStatus('Failed to save options.', 'error');
    }
  }

  function addRule(): void {
    draft.rules.push({
      urlPattern: '',
      titleSearch: '',
      titleReplace: '',
      linkSearch: '',
      linkReplace: '',
    });
    renderRules();

    const lastRowInput = rulesBody.querySelector<HTMLInputElement>('tr:last-child input[data-field="urlPattern"]');
    lastRowInput?.focus();
  }

  async function loadOptions(): Promise<void> {
    if (!storageArea) {
      setStatus('Chrome storage is unavailable; using defaults.', 'error');
      draft = cloneOptions(DEFAULT_OPTIONS);
      templateField.value = draft.format;
      renderRules();
      updateSample({ title: DEFAULT_PREVIEW_SAMPLE.title, link: DEFAULT_PREVIEW_SAMPLE.link }, 'example');
      return;
    }

    try {
      const snapshot = await storageArea.get(['options', 'format', 'titleRules']);
      draft = cloneOptions(normalizeStoredOptions(snapshot));
      templateField.value = draft.format;
      renderRules();
      setStatus('Options loaded.', 'success');
      updateSample({ title: DEFAULT_PREVIEW_SAMPLE.title, link: DEFAULT_PREVIEW_SAMPLE.link }, 'example');
      resetClearConfirmation();
    } catch (error) {
      console.error('Failed to load options; fallback to defaults.', error);
      draft = cloneOptions(DEFAULT_OPTIONS);
      templateField.value = draft.format;
      renderRules();
      setStatus('Failed to load saved options; defaults restored.', 'error');
      updateSample({ title: DEFAULT_PREVIEW_SAMPLE.title, link: DEFAULT_PREVIEW_SAMPLE.link }, 'example');
      resetClearConfirmation();
    }
  }

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

  addRuleButton.addEventListener('click', addRule, { signal });

  clearRulesButton.addEventListener(
    'click',
    () => {
      if (draft.rules.length === 0) {
        setStatus('No rules to clear.', 'error');
        return;
      }

      if (clearConfirmationTimeout) {
        clearTimeout(clearConfirmationTimeout);
        clearConfirmationTimeout = undefined;
      }

      clearRulesButton.hidden = true;
      confirmClearButton.hidden = false;
      confirmClearButton.focus();

      clearConfirmationTimeout = setTimeout(() => {
        resetClearConfirmation();
      }, 5000);
    },
    { signal },
  );

  confirmClearButton.addEventListener(
    'click',
    () => {
      if (draft.rules.length === 0) {
        resetClearConfirmation();
        setStatus('No rules to clear.', 'error');
        return;
      }

      resetClearConfirmation();
      draft.rules = [];
      renderRules();
      setStatus('All rules cleared.');
    },
    { signal },
  );

  samplePresetSelect.addEventListener(
    'change',
    () => {
      const selected = samplePresetSelect.selectedOptions[0];
      if (!selected) {
        return;
      }

      if (selected.value === 'custom') {
        updateSample({}, 'custom');
        return;
      }

      const nextTitle = selected.dataset.title ?? DEFAULT_PREVIEW_SAMPLE.title;
      const nextLink = selected.dataset.url ?? DEFAULT_PREVIEW_SAMPLE.link;
      updateSample({ title: nextTitle, link: nextLink }, selected.value);
    },
    { signal },
  );

  sampleTitleInput.addEventListener(
    'input',
    () => {
      updateSample({ title: sampleTitleInput.value }, 'custom');
    },
    { signal },
  );

  sampleUrlInput.addEventListener(
    'input',
    () => {
      updateSample({ link: sampleUrlInput.value.trim() }, 'custom');
    },
    { signal },
  );

  rulesBody.addEventListener(
    'input',
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        applyInputChange(event.target);
      }
    },
    { signal },
  );

  rulesBody.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (target.dataset.action === 'remove') {
        const index = Number.parseInt(target.dataset.index ?? '', 10);
        if (!Number.isNaN(index)) {
          draft.rules.splice(index, 1);
          renderRules();
          setStatus('Rule removed.');
        }
      }
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
    draft = cloneOptions(DEFAULT_OPTIONS);
  };
}
