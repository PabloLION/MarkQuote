import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Load the options.html content to simulate the DOM
const html = fs.readFileSync(path.resolve(__dirname, '../../public/options.html'), 'utf8');

describe('Options Page', () => {
  beforeEach(async () => {
    // Set up the DOM
    document.body.innerHTML = html;

    // Mock the script execution since it's loaded via <script> tag
    // We need to re-import it in each test to ensure it runs against the fresh DOM
    vi.resetModules();
    const { initializeOptions } = await import('../../src/options');
    initializeOptions();

    // Clear storage before each test
    // @ts-ignore
    chrome.storage.sync.clear();
    vi.clearAllMocks(); // Clear any previous mock calls
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

    // Spy on chrome.storage.sync.set
    const storageSpy = vi.spyOn(chrome.storage.sync, 'set');

    // Simulate click
    addButton.click();

    // Assert that chrome.storage.sync.set was called
    expect(storageSpy).toHaveBeenCalledTimes(1);

    // Assert that it was called with the correct rule structure and a callback function
    expect(storageSpy).toHaveBeenCalledWith(
      {
        titleRules: [
          {
            urlMatch: 'example.com',
            titleMatch: 'Old Title',
            titleReplace: 'New Title',
          },
        ],
      },
      expect.any(Function) // Expect a function as the second argument
    );
  });
});
