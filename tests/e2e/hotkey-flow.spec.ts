import { expect, test } from "@playwright/test";
import {
  clearClipboardTelemetry,
  findTabByUrl,
  getBackgroundErrors,
  getHotkeyDiagnostics,
  readLastFormatted,
  resetHotkeyDiagnostics,
  resetPreviewState,
  setClipboardTelemetryTag,
  setHotkeyPinnedState,
  triggerHotkeyCommand,
  waitForClipboardTelemetry,
} from "./helpers/background-bridge.js";
import {
  assertClipboardContainsNonce,
  mintClipboardNonce,
  readClipboardText,
  snapshotClipboard,
} from "./helpers/clipboard.js";
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

test("[HOTKEY_FALLBACK] hotkey fallback copies selection when action is unpinned", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  await context.grantPermissions(["clipboard-write"], {
    origin: new URL(SAMPLE_URL).origin,
  });

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
  const clipboard = await snapshotClipboard(articlePage);

  const nonce = mintClipboardNonce("hotkey");
  const nonceMarkdown = `${SAMPLE_MARKDOWN} ${nonce}`;
  const nonceTitle = `${SAMPLE_TITLE} ${nonce.slice(0, 6)}`;
  const expectedPreview = `> ${nonceMarkdown}\n> Source: [${nonceTitle}](${SAMPLE_URL})`;

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

  await clearClipboardTelemetry(bridgePage);
  await setClipboardTelemetryTag(bridgePage, "[HOTKEY_FALLBACK]");

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

  await resetHotkeyDiagnostics(bridgePage);
  await resetPreviewState(bridgePage);
  await triggerHotkeyCommand(bridgePage, {
    forcePinned: false,
    tabId: articleTab.id,
  });

  await expect
    .poll(async () => (await readLastFormatted(bridgePage)).formatted, {
      timeout: 10_000,
      message: "Waiting for hotkey fallback to capture selection.",
    })
    .toBe(expectedPreview);

  const telemetryEvent = await waitForClipboardTelemetry(bridgePage, {
    tag: "[HOTKEY_FALLBACK]",
  });
  expect(telemetryEvent.payload).toBe(expectedPreview);
  expect(telemetryEvent.origin).toBe("injection");
  assertClipboardContainsNonce(telemetryEvent.payload, nonce);

  const errors = await getBackgroundErrors(bridgePage);
  const contexts = errors.map((entry) => entry.context);
  expect(contexts).toContain("hotkey-open-popup");
  expect(contexts).not.toContain("popup-clipboard-fallback");

  const diagnostics = await getHotkeyDiagnostics(bridgePage);
  expect(diagnostics.eventTabId).toBe(articleTab.id);
  expect(diagnostics.resolvedTabId).toBe(articleTab.id);
  expect(diagnostics.timestamp).toBeGreaterThan(0);
  expect(diagnostics.stubSelectionUsed).toBe(false);
  expect(diagnostics.injectionAttempted).toBe(true);
  expect(diagnostics.injectionSucceeded).toBe(true);
  expect(diagnostics.injectionError).toBeNull();

  await clearClipboardTelemetry(bridgePage);
  await clipboard.restore();
  await bridgePage.close();
  await articlePage.close();
});
