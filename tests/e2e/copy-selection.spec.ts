import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.resolve(currentDir, '../..');
const extensionPath = path.resolve(repoRoot, 'dist');

const FEEDBACK_URL = 'https://github.com/PabloLION/MarkQuote';

async function launchExtensionContext(): Promise<{
  context: BrowserContext;
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

  return { context, cleanup };
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

test('feedback button opens repository in new tab', async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const popupPage = await openPopupPage(context, extensionId);

  const newPagePromise = context.waitForEvent('page');
  await popupPage.locator('#feedback-button').click();

  const feedbackPage = await newPagePromise;
  await feedbackPage.waitForLoadState('domcontentloaded');

  expect(feedbackPage.url()).toBe(FEEDBACK_URL);

  await feedbackPage.close();
  await popupPage.close();
  await cleanup();
  activeCleanup = undefined;
});
