import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  findTabByUrl,
  getBackgroundErrors,
  getHotkeyDiagnostics,
  readLastFormatted,
  setHotkeyPinnedState,
  triggerHotkeyCommand,
} from "./helpers/background-bridge.js";
import { getExtensionId, launchExtensionContext, openExtensionPage } from "./helpers/extension.js";
import { selectElementText } from "./helpers/selection.js";

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

test("[smoke] hotkey fallback copies selection when action is unpinned", async () => {
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
  const escapedNonceMarkdown = nonceMarkdown.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  const expectedPreview = `> ${escapedNonceMarkdown}\n> Source: [${nonceTitle}](${SAMPLE_URL})`;

  await articlePage.evaluate(
    ({ text, title }) => {
      const quote = document.getElementById("quote");
      if (!quote) {
        throw new Error("Unable to locate quote element for hotkey test.");
      }
      quote.textContent = text;
      document.title = title;
    },
    { text: nonceMarkdown, title: nonceTitle },
  );
  await selectElementText(articlePage, "#quote", { expectedText: nonceMarkdown });

  const bridgePage = await openExtensionPage(context, extensionId, "options.html");

  await setHotkeyPinnedState(bridgePage, false);
  const articleTab = await findTabByUrl(bridgePage, SAMPLE_URL);
  if (articleTab.id === null) {
    throw new Error("Unable to locate article tab for hotkey test.");
  }

  await selectElementText(articlePage, "#quote", { expectedText: nonceMarkdown });
  await articlePage.keyboard.press("Alt+C");

  const hardwareAttempt = await getHotkeyDiagnostics(bridgePage);
  expect(hardwareAttempt.eventTabId).toBeNull();
  expect(hardwareAttempt.resolvedTabId).toBeNull();
  expect(hardwareAttempt.timestamp).toBe(0);

  await triggerHotkeyCommand(bridgePage, {
    forcePinned: false,
    tabId: articleTab.id,
  });

  let formattedPreview = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const snapshot = await readLastFormatted(bridgePage);
    formattedPreview = snapshot.formatted;
    if (formattedPreview) {
      break;
    }
    await bridgePage.waitForTimeout(250);
  }

  if (!formattedPreview) {
    const diagnostics = await getHotkeyDiagnostics(bridgePage);
    const errors = await getBackgroundErrors(bridgePage);
    throw new Error(
      `Hotkey fallback did not capture selection. Diagnostics: ${JSON.stringify(
        diagnostics,
      )} Errors: ${JSON.stringify(errors)}`,
    );
  }

  expect(formattedPreview).toBe(expectedPreview);

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

  const diagnostics = await getHotkeyDiagnostics(bridgePage);
  expect(diagnostics.eventTabId).toBe(articleTab.id);
  expect(diagnostics.resolvedTabId).toBe(articleTab.id);
  expect(diagnostics.timestamp).toBeGreaterThan(0);
  expect(diagnostics.stubSelectionUsed).toBe(false);
  expect(diagnostics.injectionAttempted).toBe(true);
  expect(diagnostics.injectionSucceeded).toBe(true);
  expect(diagnostics.injectionError).toBeNull();

  await bridgePage.close();
  await articlePage.close();
});
