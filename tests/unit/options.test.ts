import fs from 'node:fs';
import path from 'node:path';
import sinonChrome from 'sinon-chrome/extensions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TEMPLATE,
  DEFAULT_WIKI_TITLE_REPLACE,
  DEFAULT_WIKI_TITLE_SEARCH,
  DEFAULT_WIKI_URL_PATTERN,
} from '../../src/options-schema';

const html = fs.readFileSync(path.resolve(__dirname, '../../public/options.html'), 'utf8');

function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}

describe('Options Page', () => {
  let disposeOptions: (() => void) | undefined;

  beforeEach(async () => {
    document.body.innerHTML = html;
    vi.resetModules();
    sinonChrome.reset();

    // @ts-expect-error - assign sinon chrome implementation for the module under test
    globalThis.chrome = sinonChrome;

    sinonChrome.storage.sync.get.resolves({
      options: {
        version: 1,
        format: '> {{TEXT}}\n> Source: [{{TITLE}}]({{LINK}})',
        titleRules: [],
        linkRules: [],
      },
    });
    sinonChrome.storage.sync.set.resolves();

    const { initializeOptions } = await import('../../src/options');
    disposeOptions = initializeOptions();

    await flushMicrotasks();
    await flushMicrotasks();
  });

  afterEach(() => {
    disposeOptions?.();
    sinonChrome.reset();
  });

  it('initializes default wikipedia sample and title rule when storage is empty', async () => {
    disposeOptions?.();
    sinonChrome.reset();
    vi.resetModules();

    sinonChrome.storage.sync.get.resolves({});

    const { initializeOptions } = await import('../../src/options');
    disposeOptions = initializeOptions();

    await flushMicrotasks();
    await flushMicrotasks();

    const sampleTitleInput = document.getElementById('sample-title') as HTMLInputElement | null;
    const sampleUrlInput = document.getElementById('sample-url') as HTMLInputElement | null;
    const sampleOutputTitle = document.getElementById('sample-output-title');
    const sampleOutputUrl = document.getElementById('sample-output-url');

    expect(sampleTitleInput?.value).toBe('Markdown - Wikipedia');
    expect(sampleUrlInput?.value).toBe('https://en.wikipedia.org/wiki/Markdown');
    expect(sampleOutputTitle?.textContent).toBe(DEFAULT_WIKI_TITLE_REPLACE.replace('$1', 'Markdown'));
    expect(sampleOutputUrl?.textContent).toBe('https://en.wikipedia.org/wiki/Markdown');

    const titleRuleInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('#title-rules-body input'),
    ).map((input) => input.value);

    expect(titleRuleInputs).toEqual([
      DEFAULT_WIKI_URL_PATTERN,
      DEFAULT_WIKI_TITLE_SEARCH,
      DEFAULT_WIKI_TITLE_REPLACE,
    ]);

    const linkRuleInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('#link-rules-body input'),
    );
    expect(linkRuleInputs.length).toBe(0);
  });

  it('loads the saved template and renders a preview', () => {
    const templateField = document.getElementById('format-template') as HTMLTextAreaElement | null;
    const previewElement = document.getElementById('format-preview');
    const samplePresetSelect = document.getElementById('sample-preset') as HTMLSelectElement | null;
    const sampleUrlInput = document.getElementById('sample-url') as HTMLInputElement | null;
    const sampleTitleInput = document.getElementById('sample-title') as HTMLInputElement | null;
    const sampleOutputTitle = document.getElementById('sample-output-title');
    const sampleOutputUrl = document.getElementById('sample-output-url');
    const titleClearStatus = document.getElementById('title-clear-status');

    expect(templateField?.value).toContain('{{TITLE}}');
    expect(previewElement?.textContent).toContain('Wiki:Markdown');
    expect(previewElement?.textContent).toContain('https://en.wikipedia.org/wiki/Markdown');
    expect(samplePresetSelect?.value).toBe('wikipedia');
    expect(sampleUrlInput?.value).toBe('https://en.wikipedia.org/wiki/Markdown');
    expect(sampleTitleInput?.value).toBe('Markdown - Wikipedia');
    expect(sampleOutputTitle?.textContent).toBe(DEFAULT_WIKI_TITLE_REPLACE.replace('$1', 'Markdown'));
    expect(sampleOutputUrl?.textContent).toBe('https://en.wikipedia.org/wiki/Markdown');
    expect(titleClearStatus?.hidden).toBe(true);
  });

  it('updates the preview when the sample inputs change', () => {
    const previewElement = document.getElementById('format-preview');
    const sampleUrlInput = document.getElementById('sample-url') as HTMLInputElement;
    const sampleTitleInput = document.getElementById('sample-title') as HTMLInputElement;
    const samplePresetSelect = document.getElementById('sample-preset') as HTMLSelectElement;
    const sampleOutputTitle = document.getElementById('sample-output-title');
    const sampleOutputUrl = document.getElementById('sample-output-url');

    sampleUrlInput.value = 'https://dev.to/example';
    sampleUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
    sampleTitleInput.value = 'Dev Example Post';
    sampleTitleInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(samplePresetSelect.value).toBe('custom');
    expect(previewElement?.textContent).toContain('https://dev.to/example');
    expect(sampleOutputUrl?.textContent).toBe('https://dev.to/example');

    const targetOption = samplePresetSelect.querySelector('option[value="mdn"]');
    if (!targetOption) {
      throw new Error('Expected MDN preset to exist.');
    }

    samplePresetSelect.value = 'mdn';
    samplePresetSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(sampleUrlInput.value).toBe(targetOption.dataset.url);
    expect(sampleTitleInput.value).toBe(targetOption.dataset.title);
    expect(previewElement?.textContent).toContain(targetOption.dataset.url ?? '');
    expect(previewElement?.textContent).toContain(targetOption.dataset.title ?? '');
    expect(sampleOutputUrl?.textContent).toBe(targetOption.dataset.url ?? '');
    expect(sampleOutputTitle?.textContent).toBe(targetOption.dataset.title ?? '');
  });

  it('persists title and link rules with versioned payload', async () => {
    const addTitleRuleButton = document.getElementById('add-title-rule') as HTMLButtonElement;
    const addLinkRuleButton = document.getElementById('add-link-rule') as HTMLButtonElement;
    addTitleRuleButton.click();
    addLinkRuleButton.click();

    const titleUrlInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="urlPattern"]',
    );
    const titleSearchInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="titleSearch"]',
    );
    const titleReplaceInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="titleReplace"]',
    );

    const linkUrlInput = document.querySelector<HTMLInputElement>(
      '#link-rules-body input[data-field="urlPattern"]',
    );
    const linkSearchInput = document.querySelector<HTMLInputElement>(
      '#link-rules-body input[data-field="linkSearch"]',
    );
    const linkReplaceInput = document.querySelector<HTMLInputElement>(
      '#link-rules-body input[data-field="linkReplace"]',
    );

    const form = document.getElementById('options-form') as HTMLFormElement;

    if (
      !titleUrlInput ||
      !titleSearchInput ||
      !titleReplaceInput ||
      !linkUrlInput ||
      !linkSearchInput ||
      !linkReplaceInput ||
      !form
    ) {
      throw new Error('Expected inputs were not present.');
    }

    titleUrlInput.value = 'example.com';
    titleSearchInput.value = 'Example';
    titleReplaceInput.value = 'Sample';
    linkUrlInput.value = 'example.com';
    linkSearchInput.value = 'http';
    linkReplaceInput.value = 'https';

    titleUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleReplaceInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkReplaceInput.dispatchEvent(new Event('input', { bubbles: true }));

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(sinonChrome.storage.sync.set.calledOnce).toBe(true);

    const [payload] = sinonChrome.storage.sync.set.firstCall.args as [{
      options: {
        version: number;
        format: string;
        titleRules: Array<Record<string, string>>;
        linkRules: Array<Record<string, string>>;
      };
      format: string;
      titleRules: Array<Record<string, string>>;
      linkRules: Array<Record<string, string>>;
    }];

    expect(payload.options.version).toBe(1);
    expect(payload.options.titleRules).toEqual([
      {
        urlPattern: 'example.com',
        titleSearch: 'Example',
        titleReplace: 'Sample',
      },
    ]);
    expect(payload.options.linkRules).toEqual([
      {
        urlPattern: 'example.com',
        linkSearch: 'http',
        linkReplace: 'https',
      },
    ]);
    expect(payload.titleRules).toEqual(payload.options.titleRules);
    expect(payload.linkRules).toEqual(payload.options.linkRules);
  });

  it('requires confirmation before clearing title rules', () => {
    const addTitleRuleButton = document.getElementById('add-title-rule') as HTMLButtonElement;
    const clearButton = document.getElementById('clear-title-rules') as HTMLButtonElement;
    const confirmButton = document.getElementById('confirm-clear-title-rules') as HTMLButtonElement;
    const clearStatus = document.getElementById('title-clear-status') as HTMLParagraphElement;

    addTitleRuleButton.click();
    const urlInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="urlPattern"]',
    );

    if (!urlInput) {
      throw new Error('Expected rule input to exist after adding rule.');
    }

    urlInput.value = 'example';
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(clearButton.hidden).toBe(false);
    expect(confirmButton.hidden).toBe(true);
    expect(clearStatus.hidden).toBe(true);

    clearButton.click();
    expect(clearButton.hidden).toBe(true);
    expect(confirmButton.hidden).toBe(false);
    expect(document.querySelectorAll('#title-rules-body tr').length).toBe(2);
    expect(clearStatus.hidden).toBe(true);

    confirmButton.click();
    expect(clearButton.hidden).toBe(false);
    expect(confirmButton.hidden).toBe(true);
    expect(document.querySelectorAll('#title-rules-body tr').length).toBe(0);
    expect(clearStatus.hidden).toBe(false);
    expect(clearStatus.textContent).toBe('All title rules cleared.');
  });

  it('requires confirmation before clearing link rules', () => {
    const addLinkRuleButton = document.getElementById('add-link-rule') as HTMLButtonElement;
    const clearButton = document.getElementById('clear-link-rules') as HTMLButtonElement;
    const confirmButton = document.getElementById('confirm-clear-link-rules') as HTMLButtonElement;
    const clearStatus = document.getElementById('link-clear-status') as HTMLParagraphElement;

    addLinkRuleButton.click();
    const urlInput = document.querySelector<HTMLInputElement>(
      '#link-rules-body input[data-field="urlPattern"]',
    );

    if (!urlInput) {
      throw new Error('Expected link rule input to exist after adding rule.');
    }

    urlInput.value = 'example';
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(clearButton.hidden).toBe(false);
    expect(confirmButton.hidden).toBe(true);
    expect(clearStatus.hidden).toBe(true);

    clearButton.click();
    expect(clearButton.hidden).toBe(true);
    expect(confirmButton.hidden).toBe(false);
    expect(document.querySelectorAll('#link-rules-body tr').length).toBe(1);
    expect(clearStatus.hidden).toBe(true);

    confirmButton.click();
    expect(clearButton.hidden).toBe(false);
    expect(confirmButton.hidden).toBe(true);
    expect(document.querySelectorAll('#link-rules-body tr').length).toBe(0);
    expect(clearStatus.hidden).toBe(false);
    expect(clearStatus.textContent).toBe('All link rules cleared.');
  });

  it('shows transformed sample outputs when title rules match', () => {
    const addTitleRuleButton = document.getElementById('add-title-rule') as HTMLButtonElement;
    addTitleRuleButton.click();

    const titleUrlInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="urlPattern"]',
    );
    const titleSearchInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="titleSearch"]',
    );
    const titleReplaceInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="titleReplace"]',
    );
    const sampleOutputTitle = document.getElementById('sample-output-title');

    if (!titleUrlInput || !titleSearchInput || !titleReplaceInput || !sampleOutputTitle) {
      throw new Error('Expected title rule inputs not found.');
    }

    titleUrlInput.value = 'example';
    titleSearchInput.value = 'Example';
    titleReplaceInput.value = 'Sample';

    titleUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleReplaceInput.dispatchEvent(new Event('input', { bubbles: true }));

    const sampleTitleInput = document.getElementById('sample-title') as HTMLInputElement;
    const sampleUrlInput = document.getElementById('sample-url') as HTMLInputElement;

    sampleTitleInput.value = 'Example Domain';
    sampleTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
    sampleUrlInput.value = 'https://example.com/';
    sampleUrlInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(sampleOutputTitle.textContent).toBe('Sample Domain');
  });

  it('shows transformed sample link when link rules match', () => {
    const addLinkRuleButton = document.getElementById('add-link-rule') as HTMLButtonElement;
    addLinkRuleButton.click();

    const linkUrlInput = document.querySelector<HTMLInputElement>(
      '#link-rules-body input[data-field="urlPattern"]',
    );
    const linkSearchInput = document.querySelector<HTMLInputElement>(
      '#link-rules-body input[data-field="linkSearch"]',
    );
    const linkReplaceInput = document.querySelector<HTMLInputElement>(
      '#link-rules-body input[data-field="linkReplace"]',
    );
    const sampleOutputUrl = document.getElementById('sample-output-url');

    if (!linkUrlInput || !linkSearchInput || !linkReplaceInput || !sampleOutputUrl) {
      throw new Error('Expected link rule inputs not found.');
    }

    linkUrlInput.value = 'example';
    linkSearchInput.value = '^http://';
    linkReplaceInput.value = 'https://';

    linkUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkReplaceInput.dispatchEvent(new Event('input', { bubbles: true }));

    const sampleUrlInput = document.getElementById('sample-url') as HTMLInputElement;
    sampleUrlInput.value = 'http://example.com/';
    sampleUrlInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(sampleOutputUrl.textContent).toBe('https://example.com/');
  });

  it('rejects invalid regex patterns and keeps existing state', async () => {
    const addTitleRuleButton = document.getElementById('add-title-rule') as HTMLButtonElement;
    addTitleRuleButton.click();

    const urlInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="urlPattern"]',
    );
    const titleSearchInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="titleSearch"]',
    );
    const form = document.getElementById('options-form') as HTMLFormElement;
    const status = document.getElementById('status');

    if (!urlInput || !titleSearchInput || !form || !status) {
      throw new Error('Expected inputs were not present.');
    }

    urlInput.value = '[[['; // invalid regex
    titleSearchInput.value = 'Title';
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleSearchInput.dispatchEvent(new Event('input', { bubbles: true }));

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(sinonChrome.storage.sync.set.called).toBe(false);
    expect(urlInput.getAttribute('aria-invalid')).toBe('true');
    expect(status.getAttribute('data-variant')).toBe('error');
    expect(status.textContent).toMatch(/invalid regex/i);
  });

  it('restores the default template when requested', () => {
    const templateField = document.getElementById('format-template') as HTMLTextAreaElement;
    const restoreButton = document.getElementById('restore-template') as HTMLButtonElement;

    templateField.value = 'Custom template';
    templateField.dispatchEvent(new Event('input', { bubbles: true }));

    restoreButton.click();

    expect(templateField.value).toBe(DEFAULT_TEMPLATE);
  });
});
