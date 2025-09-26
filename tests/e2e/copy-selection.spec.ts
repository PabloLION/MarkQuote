import { expect, test } from '@playwright/test';
import { getExtensionId, launchExtensionContext, openPopupPage, type LaunchExtensionResult } from './helpers/extension.js';
import {
  readLastFormatted,
  sendSelectionMessage,
  primeSelectionStub,
} from './helpers/e2e.js';

const FEEDBACK_URL = 'https://github.com/PabloLION/MarkQuote';
const WIKIPEDIA_URL =
  'https://en.wikipedia.org/wiki/Markdown?utm_source=chatgpt.com&utm_medium=email';
const SAMPLE_SELECTION = 'Markdown keeps formatting simple.';

async function stubWikipediaPage(context: LaunchExtensionResult['context']) {
  await context.route('https://en.wikipedia.org/**', async (route) => {
    const requestedUrl = route.request().url();

    if (!requestedUrl.startsWith('https://en.wikipedia.org/wiki/Markdown')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    const html = `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Markdown - Wikipedia</title>
        </head>
        <body>
          <main>
            <article>
              <p id="quote">${SAMPLE_SELECTION}</p>
            </article>
          </main>
        </body>
      </html>`;

    await route.fulfill({
      contentType: 'text/html',
      body: html,
    });
  });
}
let activeCleanup: (() => Promise<void>) | undefined;

test.afterEach(async () => {
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
});

test('popup request pipeline formats the active tab selection', async () => {
  const { context, cleanup } = await launchExtensionContext({ colorScheme: 'dark' });
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  await stubWikipediaPage(context);

  const articlePage = await context.newPage();
  await articlePage.goto(WIKIPEDIA_URL, { waitUntil: 'domcontentloaded' });

  await articlePage.evaluate((selectionText) => {
    const target = document.getElementById('quote');
    if (!target) {
      throw new Error('Expected quote element to exist.');
    }

    const range = document.createRange();
    range.selectNodeContents(target);

    const selection = window.getSelection();
    if (!selection) {
      throw new Error('Selection API unavailable.');
    }

    selection.removeAllRanges();
    selection.addRange(range);

    const selected = selection.toString();
    if (selected.trim() !== selectionText) {
      throw new Error(`Unexpected selection text: ${selected}`);
    }
  }, SAMPLE_SELECTION);

  const controlPage = await openPopupPage(context, extensionId);
  await primeSelectionStub(controlPage, {
    markdown: SAMPLE_SELECTION,
    title: 'Markdown - Wikipedia',
    url: WIKIPEDIA_URL,
  });
  await controlPage.close();

  await articlePage.bringToFront();

  const popupPage = await openPopupPage(context, extensionId);

  const expectedPreview = `> ${SAMPLE_SELECTION}\n> Source: [Wiki:Markdown](https://en.wikipedia.org/wiki/Markdown?utm_medium=email)`;

  await expect
    .poll(async () => (await readLastFormatted(popupPage)).formatted, {
      message: 'Waiting for background selection pipeline to finish.',
    })
    .toBe(expectedPreview);

  const finalStatus = await readLastFormatted(popupPage);
  expect(finalStatus.error).toBeUndefined();

  await expect(popupPage.locator('#preview')).toHaveText(expectedPreview);
  await expect(popupPage.locator('#message')).toHaveText('Copied!');

  await popupPage.close();
  await articlePage.close();
});

const COLOR_SCHEMES: Array<'dark' | 'light'> = ['dark', 'light'];

for (const colorScheme of COLOR_SCHEMES) {
  test(`renders formatted markdown for a Wikipedia selection (${colorScheme})`, async () => {
    const { context, cleanup } = await launchExtensionContext({ colorScheme });
    activeCleanup = cleanup;

    await stubWikipediaPage(context);

    const articlePage = await context.newPage();
    await articlePage.goto(WIKIPEDIA_URL, { waitUntil: 'domcontentloaded' });

    await articlePage.evaluate((selectionText) => {
      const target = document.getElementById('quote');
      if (!target) {
        throw new Error('Expected quote element to exist.');
      }

      const range = document.createRange();
      range.selectNodeContents(target);

      const selection = window.getSelection();
      if (!selection) {
        throw new Error('Selection API unavailable.');
      }

      selection.removeAllRanges();
      selection.addRange(range);

      const selected = selection.toString();
      if (selected.trim() !== selectionText) {
        throw new Error(`Unexpected selection text: ${selected}`);
      }
    }, SAMPLE_SELECTION);

    await articlePage.bringToFront();

    const extensionId = await getExtensionId(context);
    await articlePage.bringToFront();
    const popupPage = await openPopupPage(context, extensionId);

    await sendSelectionMessage(popupPage, {
      markdown: SAMPLE_SELECTION,
      title: 'Markdown - Wikipedia',
      url: WIKIPEDIA_URL,
    });

    const expectedPreview = `> ${SAMPLE_SELECTION}\n> Source: [Wiki:Markdown](https://en.wikipedia.org/wiki/Markdown?utm_medium=email)`;
    const previewText = await popupPage.locator('#preview').textContent();
    await expect(popupPage.locator('#preview')).toHaveText(expectedPreview);
    await expect(popupPage.locator('#message')).toHaveText('Copied!');

    const previewStatus = await readLastFormatted(popupPage);
    await expect(previewStatus).toEqual({ formatted: expectedPreview, error: undefined });

    await popupPage.close();
    await articlePage.close();
  });
}
