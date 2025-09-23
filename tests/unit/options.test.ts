import fs from 'node:fs';
import path from 'node:path';
import sinonChrome from 'sinon-chrome/extensions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Load the options.html content to simulate the DOM
const html = fs.readFileSync(path.resolve(__dirname, '../../public/options.html'), 'utf8');

describe('Options Page', () => {
  let disposeOptions: (() => void) | undefined;

  beforeEach(async () => {
    // Set up the DOM
    document.body.innerHTML = html;

    // Mock the script execution since it's loaded via <script> tag
    // We need to re-import it in each test to ensure it runs against the fresh DOM
    vi.resetModules();
    const { initializeOptions } = await import('../../src/options');
    disposeOptions = initializeOptions();

    // Clear storage before each test
    // @ts-expect-error
    await chrome.storage.sync.clear();
    vi.clearAllMocks(); // Clear any previous mock calls

    await Promise.resolve();
  });

  afterEach(() => {
    disposeOptions?.();
  });

  it('should save a new title transformation rule to chrome.storage.sync', async () => {
    // Get DOM elements
    const urlInput = document.getElementById('url-match-pattern') as HTMLInputElement;
    const titleInput = document.getElementById('title-match-pattern') as HTMLInputElement;
    const replacementInput = document.getElementById('title-replacement') as HTMLInputElement;
    const addButton = document.getElementById('add-rule') as HTMLButtonElement;

    // Simulate user input
    urlInput.value = 'example.com';
    titleInput.value = 'Old Title';
    replacementInput.value = 'New Title';

    // Simulate click
    addButton.click();

    // Assert that chrome.storage.sync.set was called
    expect(sinonChrome.storage.sync.set.calledOnce).toBe(true);

    const [payload] = sinonChrome.storage.sync.set.firstCall.args;
    expect(payload).toEqual({
      titleRules: [
        {
          urlMatch: 'example.com',
          titleMatch: 'Old Title',
          titleReplace: 'New Title',
        },
      ],
    });
  });
});
