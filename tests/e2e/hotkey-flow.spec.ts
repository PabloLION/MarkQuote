import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  getBackgroundErrors,
  primeSelectionStub,
  readLastFormatted,
  triggerHotkeyCommand,
} from "./helpers/background-bridge.js";
import { getExtensionId, launchExtensionContext, openExtensionPage } from "./helpers/extension.js";

const SAMPLE_MARKDOWN = "Body text";
const SAMPLE_TITLE = "Example Article";
const SAMPLE_URL = "https://example.com/article";

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

  const origin = new URL(SAMPLE_URL).origin;
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await articlePage.goto(SAMPLE_URL, { waitUntil: "domcontentloaded" });
  await articlePage.bringToFront();

  const initialClipboard = await articlePage.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      throw new Error(
        `Clipboard read failed before hotkey test: ${(error as Error).message ?? "unknown error"}`,
      );
    }
  });

  const nonce = randomUUID();
  const nonceMarkdown = `${SAMPLE_MARKDOWN} [${nonce}]`;
  const nonceTitle = `${SAMPLE_TITLE} (${nonce.slice(0, 8)})`;
  const expectedPreview = `> ${nonceMarkdown}\n> Source: [${nonceTitle}](${SAMPLE_URL})`;

  const bridgePage = await openExtensionPage(context, extensionId, "options.html");

  await articlePage.bringToFront();

  await primeSelectionStub(bridgePage, {
    markdown: nonceMarkdown,
    title: nonceTitle,
    url: SAMPLE_URL,
  });

  await triggerHotkeyCommand(bridgePage, {
    forcePinned: false,
  });

  await expect
    .poll(async () => (await readLastFormatted(bridgePage)).formatted, {
      timeout: 10_000,
      message: "Waiting for hotkey fallback copy to finish.",
    })
    .toBe(expectedPreview);

  const clipboardText = await articlePage.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      throw new Error(
        `Clipboard read failed after hotkey test: ${(error as Error).message ?? "unknown error"}`,
      );
    }
  });

  await articlePage.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
  }, initialClipboard);

  const errors = await getBackgroundErrors(bridgePage);
  const contexts = errors.map((entry) => entry.context);
  expect(contexts).toContain("hotkey-open-popup");
  expect(contexts).not.toContain("popup-clipboard-fallback");
  expect(clipboardText).toBe(initialClipboard);

  await bridgePage.close();
  await articlePage.close();
});
