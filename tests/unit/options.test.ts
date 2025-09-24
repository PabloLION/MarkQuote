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

    expect(templateField?.value).toContain('{{TITLE}}');
    expect(previewElement?.textContent).toContain('Albert Einstein on Curiosity');
    expect(previewElement?.textContent).toContain('https://example.com/curiosity');
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
