import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BrowserContext,
  chromium,
  expect,
  type Page,
  test,
  type Worker,
} from '@playwright/test';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.resolve(currentDir, '../..');
const extensionPath = path.resolve(repoRoot, 'dist');

async function launchExtensionContext(): Promise<{
  context: BrowserContext;
  background: Worker;
  cleanup: () => Promise<void>;
}> {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'markquote-e2e-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    colorScheme: 'dark',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  const cleanup = async () => {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  };

  const existing = context.serviceWorkers();
  const background = existing.length
    ? existing[0]
    : await context.waitForEvent('serviceworker', { timeout: 10_000 });

  return { context, background, cleanup };
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  await page.goto('chrome://extensions');

  const devModeToggle = page.locator('cr-toggle#devMode');
  await devModeToggle.waitFor({ state: 'visible' });
  if ((await devModeToggle.getAttribute('aria-pressed')) === 'false') {
    await devModeToggle.click();
    await page.waitForTimeout(500);
  }

  const extensionCard = page.locator('extensions-item');
  await extensionCard.first().waitFor({ state: 'visible' });
  const extensionId = await extensionCard.first().getAttribute('id');
  await page.close();

  if (!extensionId) {
    throw new Error('Unable to determine extension id from chrome://extensions');
  }

  return extensionId;
}

async function openPopupPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForLoadState('domcontentloaded');
  return popup;
}

let activeCleanup: (() => Promise<void>) | undefined;

test.afterAll(async () => {
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = undefined;
    await cleanup();
  }
});

test('copies highlighted text into the popup preview', async () => {
  const { context, background, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const popupPage = await openPopupPage(context, extensionId);

  const messageLocator = popupPage.locator('#message');
  const previewLocator = popupPage.locator('#preview');

  const fixtureUrl = 'https://example.com/fixture';
  const selectionText = 'MarkQuote grabs this selection.';

  await context.route('https://example.com/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!DOCTYPE html><html><head><title>Fixture Page</title></head><body><p id="quote">${selectionText}</p></body></html>`,
    });
  });

  const userPage = await context.newPage();
  await userPage.goto(fixtureUrl);
  await userPage.waitForLoadState('domcontentloaded');

  await userPage.evaluate(() => {
    const quote = document.getElementById('quote');
    if (!quote) {
      throw new Error('Quote element not found');
    }
    const selection = window.getSelection();
    if (!selection) {
      throw new Error('window.getSelection() returned null');
    }
    const range = document.createRange();
    range.selectNodeContents(quote);
    selection.removeAllRanges();
    selection.addRange(range);
  });

  await userPage.bringToFront();

  const tabId = await background.evaluate(() => {
    return new Promise<number>((resolve, reject) => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const [tab] = tabs;
        if (!tab?.id) {
          reject(new Error('No active tab found for injection'));
        } else {
          resolve(tab.id);
        }
      });
    });
  });

  await background.evaluate(
    ({ tabId }) => {
      return new Promise<void>((resolve, reject) => {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            files: ['selection.js'],
          },
          () => {
            const error = chrome.runtime.lastError;
            if (error) {
              reject(new Error(error.message));
            } else {
              resolve();
            }
          },
        );
      });
    },
    { tabId },
  );

  await expect(messageLocator).toHaveText('Copied!');

  const expectedPreview = `> ${selectionText}\n> Source: [Fixture Page](${fixtureUrl})`;
  await expect(previewLocator).toHaveText(expectedPreview);

  await popupPage.close();
  await userPage.close();
});
