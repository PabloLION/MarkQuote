import fs from 'node:fs';
import path from 'node:path';
import sinonChrome from 'sinon-chrome/extensions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html = fs.readFileSync(path.resolve(__dirname, '../../public/options.html'), 'utf8');

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
        rules: [],
      },
    });
    sinonChrome.storage.sync.set.resolves();

    const { initializeOptions } = await import('../../src/options');
    disposeOptions = initializeOptions();

    await Promise.resolve();
    await Promise.resolve();
  });

  afterEach(() => {
    disposeOptions?.();
    sinonChrome.reset();
  });

  it('loads the saved template and renders a preview', () => {
    const templateField = document.getElementById('format-template') as HTMLTextAreaElement | null;
    const previewElement = document.getElementById('format-preview');
    const sampleUrlInput = document.getElementById('sample-url') as HTMLInputElement | null;
    const sampleTitleInput = document.getElementById('sample-title') as HTMLInputElement | null;
    const sampleOutputTitle = document.getElementById('sample-output-title');
    const sampleOutputUrl = document.getElementById('sample-output-url');

    expect(templateField?.value).toContain('{{TITLE}}');
    expect(previewElement?.textContent).toContain('Example Domain');
    expect(previewElement?.textContent).toContain('https://example.com/');
    expect(sampleUrlInput?.value).toBe('https://example.com/');
    expect(sampleTitleInput?.value).toBe('Example Domain');
    expect(sampleOutputTitle?.textContent).toBe('Example Domain');
    expect(sampleOutputUrl?.textContent).toBe('https://example.com/');
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

  it('persists options with versioned payload and sanitized rules', async () => {
    const addRuleButton = document.getElementById('add-rule') as HTMLButtonElement;
    addRuleButton.click();

    const urlInput = document.querySelector<HTMLInputElement>('input[data-field="urlPattern"]');
    const titleSearchInput = document.querySelector<HTMLInputElement>('input[data-field="titleSearch"]');
    const titleReplaceInput = document.querySelector<HTMLInputElement>('input[data-field="titleReplace"]');
    const linkSearchInput = document.querySelector<HTMLInputElement>('input[data-field="linkSearch"]');
    const linkReplaceInput = document.querySelector<HTMLInputElement>('input[data-field="linkReplace"]');
    const form = document.getElementById('options-form') as HTMLFormElement;

    expect(urlInput).not.toBeNull();
    expect(titleSearchInput).not.toBeNull();
    expect(form).not.toBeNull();

    if (!urlInput || !titleSearchInput || !titleReplaceInput || !linkSearchInput || !linkReplaceInput || !form) {
      throw new Error('Expected inputs were not present.');
    }

    urlInput.value = 'example.com';
    titleSearchInput.value = 'Example';
    titleReplaceInput.value = 'Sample';
    linkSearchInput.value = 'http';
    linkReplaceInput.value = 'https';

    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleReplaceInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkReplaceInput.dispatchEvent(new Event('input', { bubbles: true }));

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(sinonChrome.storage.sync.set.calledOnce).toBe(true);

    const [payload] = sinonChrome.storage.sync.set.firstCall.args as [{
      options: {
        version: number;
        format: string;
        rules: Array<Record<string, string>>;
      };
      format: string;
      titleRules: Array<Record<string, string>>;
    }];

    expect(payload.options.version).toBe(1);
    expect(payload.options.rules).toEqual([
      {
        urlPattern: 'example.com',
        titleSearch: 'Example',
        titleReplace: 'Sample',
        linkSearch: 'http',
        linkReplace: 'https',
      },
    ]);
    expect(payload.titleRules[0]).toEqual({
      urlMatch: 'example.com',
      titleMatch: 'Example',
      titleReplace: 'Sample',
    });
  });

  it('shows transformed sample outputs when rules match', () => {
    const addRuleButton = document.getElementById('add-rule') as HTMLButtonElement;
    addRuleButton.click();

    const urlInput = document.querySelector<HTMLInputElement>('input[data-field="urlPattern"]');
    const titleSearchInput = document.querySelector<HTMLInputElement>('input[data-field="titleSearch"]');
    const titleReplaceInput = document.querySelector<HTMLInputElement>('input[data-field="titleReplace"]');
    const sampleOutputTitle = document.getElementById('sample-output-title');
    const sampleOutputUrl = document.getElementById('sample-output-url');

    if (!urlInput || !titleSearchInput || !titleReplaceInput || !sampleOutputTitle || !sampleOutputUrl) {
      throw new Error('Expected rule inputs or outputs not found.');
    }

    urlInput.value = 'example';
    titleSearchInput.value = 'Example';
    titleReplaceInput.value = 'Sample';

    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleReplaceInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(sampleOutputTitle.textContent).toBe('Sample Domain');
    expect(sampleOutputUrl.textContent).toBe('https://example.com/');
  });

  it('rejects invalid regex patterns and keeps existing state', async () => {
    const addRuleButton = document.getElementById('add-rule') as HTMLButtonElement;
    addRuleButton.click();

    const urlInput = document.querySelector<HTMLInputElement>('input[data-field="urlPattern"]');
    const titleSearchInput = document.querySelector<HTMLInputElement>('input[data-field="titleSearch"]');
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
    await Promise.resolve();
    await Promise.resolve();

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

    expect(templateField.value).toBe('> {{TEXT}}\n> Source: [{{TITLE}}]({{LINK}})');
  });
});
