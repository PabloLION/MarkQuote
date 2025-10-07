import { expect, test } from "@playwright/test";
import {
  findTabByUrl,
  getBackgroundErrors,
  primeSelectionStub,
  readLastFormatted,
  triggerHotkeyCommand,
} from "./helpers/background-bridge.js";
import { getExtensionId, launchExtensionContext, openExtensionPage } from "./helpers/extension.js";

const SAMPLE_MARKDOWN = "Body text";
const SAMPLE_TITLE = "Example Article";
const SAMPLE_URL = "https://example.com/article";
const EXPECTED_PREVIEW = `> ${SAMPLE_MARKDOWN}\n> Source: [${SAMPLE_TITLE}](${SAMPLE_URL})`;

let activeCleanup: (() => Promise<void>) | undefined;

test.afterEach(async () => {
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = undefined;
    await cleanup();
  }
});

test("hotkey fallback copies selection when action is unpinned", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  await context.route(SAMPLE_URL, async (route) => {
    const html = `<!DOCTYPE html>
      <html lang="en">
        <head><meta charset="utf-8" /><title>${SAMPLE_TITLE}</title></head>
        <body><p id="quote">${SAMPLE_MARKDOWN}</p></body>
      </html>`;
    await route.fulfill({ contentType: "text/html", body: html });
  });

  const extensionId = await getExtensionId(context);
  const articlePage = await context.newPage();
  await articlePage.goto(SAMPLE_URL, { waitUntil: "domcontentloaded" });
  await articlePage.bringToFront();

  const bridgePage = await openExtensionPage(context, extensionId, "options.html");

  const articleTab = await findTabByUrl(bridgePage, `${new URL(SAMPLE_URL).origin}/*`);
  expect(articleTab.id).not.toBeNull();

  await primeSelectionStub(bridgePage, {
    markdown: SAMPLE_MARKDOWN,
    title: SAMPLE_TITLE,
    url: SAMPLE_URL,
  });

  await triggerHotkeyCommand(bridgePage, {
    tabId: articleTab.id ?? undefined,
    forcePinned: false,
  });

  await expect
    .poll(async () => (await readLastFormatted(bridgePage)).formatted, {
      timeout: 10_000,
      message: "Waiting for hotkey fallback copy to finish.",
    })
    .toBe(EXPECTED_PREVIEW);

  const errors = await getBackgroundErrors(bridgePage);
  expect(errors[0]?.context).toBe("hotkey-open-popup");

  await bridgePage.close();
  await articlePage.close();
});
