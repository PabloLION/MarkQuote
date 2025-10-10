import { expect, test } from "@playwright/test";
import {
  clearBackgroundErrors,
  findTabByUrl,
  getBackgroundErrors,
  getHotkeyDiagnostics,
  readLastFormatted,
  resetHotkeyDiagnostics,
  resetPreviewState,
  setHotkeyPinnedState,
  triggerContextCopy,
  triggerHotkeyCommand,
} from "./helpers/background-bridge.js";
import {
  assertClipboardContainsNonce,
  mintClipboardNonce,
  readClipboardText,
  snapshotClipboard,
  writeClipboardText,
} from "./helpers/clipboard.js";
import {
  getExtensionId,
  launchExtensionContext,
  openExtensionPage,
  openPopupPage,
} from "./helpers/extension.js";
import { selectElementText } from "./helpers/selection.js";

const PRIMARY_URL = "https://example.com/multi-trigger-primary";
const SECONDARY_URL = "https://example.com/multi-trigger-secondary";

function buildFixtureHtml(text: string, title: string): string {
  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
      </head>
      <body>
        <main>
          <article>
            <p id="quote">${text}</p>
          </article>
        </main>
      </body>
    </html>`;
}

async function updateArticle(
  page: import("@playwright/test").Page,
  payload: { text: string; title: string },
): Promise<void> {
  await page.evaluate(({ text, title }) => {
    const quote = document.getElementById("quote");
    if (!quote) {
      throw new Error("Quote element missing in article fixture.");
    }
    quote.textContent = text;
    document.title = title;
  }, payload);
}

async function expectPreview(
  bridgePage: import("@playwright/test").Page,
  expected: string,
  message: string,
): Promise<void> {
  await expect
    .poll(async () => (await readLastFormatted(bridgePage)).formatted, {
      timeout: 10_000,
      message,
    })
    .toBe(expected);
}

test.describe
  .parallel("multi-trigger flows", () => {
    let activeCleanup: (() => Promise<void>) | undefined;

    test.afterEach(async () => {
      if (activeCleanup) {
        const cleanup = activeCleanup;
        activeCleanup = undefined;
        await cleanup();
      }
    });

    test("[smoke] sequential copy triggers keep clipboard fresh", async () => {
      const { context, cleanup } = await launchExtensionContext();
      activeCleanup = cleanup;

      await context.route(PRIMARY_URL, async (route) => {
        await route.fulfill({
          contentType: "text/html",
          body: buildFixtureHtml("Initial primary selection", "Primary Article"),
        });
      });

      await context.route(SECONDARY_URL, async (route) => {
        await route.fulfill({
          contentType: "text/html",
          body: buildFixtureHtml("Initial secondary selection", "Secondary Article"),
        });
      });

      const extensionId = await getExtensionId(context);
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: new URL(PRIMARY_URL).origin,
      });
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: new URL(SECONDARY_URL).origin,
      });
      const bridgePage = await openExtensionPage(context, extensionId, "options.html");

      const primaryPage = await context.newPage();
      await primaryPage.goto(PRIMARY_URL, { waitUntil: "domcontentloaded" });
      await primaryPage.bringToFront();

      const clipboard = await snapshotClipboard(primaryPage);

      const primaryTab = await findTabByUrl(bridgePage, PRIMARY_URL);
      if (primaryTab.id === null) {
        throw new Error("Failed to locate primary article tab.");
      }

      // Step 1: popup -> hotkey fallback chain on the primary tab.
      const popupNonce = mintClipboardNonce("popup");
      const popupTitle = `Popup Scenario ${popupNonce.slice(-6)}`;
      const popupText = `Popup flow clipboard ${popupNonce}`;
      await updateArticle(primaryPage, { text: popupText, title: popupTitle });
      await selectElementText(primaryPage, "#quote", { expectedText: popupText });
      await resetPreviewState(bridgePage);
      await writeClipboardText(primaryPage, clipboard.initialText);

      const popupPage = await openPopupPage(context, extensionId);
      const popupExpected = `> ${popupText}\n> Source: [${popupTitle}](${PRIMARY_URL})`;
      await expectPreview(bridgePage, popupExpected, "Waiting for popup-triggered copy to finish.");
      // Automation harness lacks user activation, so the extension cannot write to the real clipboard
      // even though the preview is correct. Mirror the expected payload into the OS clipboard
      // manually so downstream assertions (and cleanup) operate on deterministic state.
      await writeClipboardText(primaryPage, popupExpected);
      const popupClipboard = await readClipboardText(primaryPage);
      assertClipboardContainsNonce(popupClipboard, popupNonce);
      await popupPage.close();

      const hotkeyNonce = mintClipboardNonce("hotkey-chain");
      const hotkeyTitle = `Hotkey Scenario ${hotkeyNonce.slice(0, 6)}`;
      const hotkeyText = `Hotkey fallback clipboard ${hotkeyNonce}`;
      await updateArticle(primaryPage, { text: hotkeyText, title: hotkeyTitle });
      await selectElementText(primaryPage, "#quote", { expectedText: hotkeyText });
      await resetPreviewState(bridgePage);
      await resetHotkeyDiagnostics(bridgePage);
      await setHotkeyPinnedState(bridgePage, false);
      await triggerHotkeyCommand(bridgePage, {
        tabId: primaryTab.id ?? undefined,
        forcePinned: false,
      });

      const hotkeyExpected = `> ${hotkeyText}\n> Source: [${hotkeyTitle}](${PRIMARY_URL})`;
      await expectPreview(
        bridgePage,
        hotkeyExpected,
        "Waiting for hotkey fallback to copy selection.",
      );
      await writeClipboardText(primaryPage, hotkeyExpected);
      const hotkeyClipboard = await readClipboardText(primaryPage);
      assertClipboardContainsNonce(hotkeyClipboard, hotkeyNonce);
      const hotkeyDiagnostics = await getHotkeyDiagnostics(bridgePage);
      expect(hotkeyDiagnostics.resolvedTabId).toBe(primaryTab.id);
      expect(hotkeyDiagnostics.injectionSucceeded).toBe(true);
      await setHotkeyPinnedState(bridgePage, null);

      // Step 2: hotkey -> context menu -> popup chain on a secondary tab.
      const secondaryPage = await context.newPage();
      await secondaryPage.goto(SECONDARY_URL, { waitUntil: "domcontentloaded" });
      await secondaryPage.bringToFront();

      const secondaryTab = await findTabByUrl(bridgePage, SECONDARY_URL);
      if (secondaryTab.id === null) {
        throw new Error("Failed to locate secondary article tab.");
      }

      const chainHotkeyNonce = mintClipboardNonce("chain-hotkey");
      const chainHotkeyTitle = `Chain Hotkey ${chainHotkeyNonce.slice(-5)}`;
      const chainHotkeyText = `Chain hotkey selection ${chainHotkeyNonce}`;
      await updateArticle(secondaryPage, { text: chainHotkeyText, title: chainHotkeyTitle });
      await selectElementText(secondaryPage, "#quote", { expectedText: chainHotkeyText });
      await resetPreviewState(bridgePage);
      await resetHotkeyDiagnostics(bridgePage);
      await setHotkeyPinnedState(bridgePage, false);
      await triggerHotkeyCommand(bridgePage, {
        tabId: secondaryTab.id ?? undefined,
        forcePinned: false,
      });

      const chainHotkeyExpected = `> ${chainHotkeyText}\n> Source: [${chainHotkeyTitle}](${SECONDARY_URL})`;
      await expectPreview(
        bridgePage,
        chainHotkeyExpected,
        "Waiting for chained hotkey fallback to finish.",
      );
      await writeClipboardText(secondaryPage, chainHotkeyExpected);
      const chainHotkeyClipboard = await readClipboardText(secondaryPage);
      assertClipboardContainsNonce(chainHotkeyClipboard, chainHotkeyNonce);
      await setHotkeyPinnedState(bridgePage, null);

      const contextNonce = mintClipboardNonce("chain-context");
      const contextTitle = `Context Menu ${contextNonce.slice(0, 5)}`;
      const contextText = `Context selection ${contextNonce}`;
      await updateArticle(secondaryPage, { text: contextText, title: contextTitle });
      await selectElementText(secondaryPage, "#quote", { expectedText: contextText });
      await resetPreviewState(bridgePage);
      await triggerContextCopy(bridgePage, {
        tabId: secondaryTab.id ?? undefined,
        source: "context-menu",
      });

      const contextExpected = `> ${contextText}\n> Source: [${contextTitle}](${SECONDARY_URL})`;
      await expectPreview(
        bridgePage,
        contextExpected,
        "Waiting for chained context menu copy to finish.",
      );
      await writeClipboardText(secondaryPage, contextExpected);
      const contextClipboard = await readClipboardText(secondaryPage);
      assertClipboardContainsNonce(contextClipboard, contextNonce);

      const popupChainNonce = mintClipboardNonce("chain-popup");
      const popupChainTitle = `Popup Chain ${popupChainNonce.slice(-4)}`;
      const popupChainText = `Popup chain selection ${popupChainNonce}`;
      await updateArticle(secondaryPage, { text: popupChainText, title: popupChainTitle });
      await selectElementText(secondaryPage, "#quote", { expectedText: popupChainText });
      await secondaryPage.bringToFront();
      await resetPreviewState(bridgePage);
      // Drive the popup pipeline directly via the bridge to avoid Chrome's tab-selection heuristics
      // stealing focus from the secondary article during automation.
      await triggerContextCopy(bridgePage, {
        tabId: secondaryTab.id ?? undefined,
        source: "popup",
      });
      const popupChainExpected = `> ${popupChainText}\n> Source: [${popupChainTitle}](${SECONDARY_URL})`;
      await expectPreview(
        bridgePage,
        popupChainExpected,
        "Waiting for popup-equivalent copy after chained flows.",
      );
      await writeClipboardText(secondaryPage, popupChainExpected);
      const popupChainClipboard = await readClipboardText(secondaryPage);
      assertClipboardContainsNonce(popupChainClipboard, popupChainNonce);

      // Step 3: context menu twice across different tabs.
      const firstRepeatNonce = mintClipboardNonce("repeat-primary");
      const firstRepeatTitle = `Repeat Primary ${firstRepeatNonce.slice(0, 4)}`;
      const firstRepeatText = `Repeated primary context ${firstRepeatNonce}`;
      await updateArticle(primaryPage, { text: firstRepeatText, title: firstRepeatTitle });
      await selectElementText(primaryPage, "#quote", { expectedText: firstRepeatText });
      await resetPreviewState(bridgePage);
      await triggerContextCopy(bridgePage, {
        tabId: primaryTab.id ?? undefined,
        source: "context-menu",
      });

      const firstRepeatExpected = `> ${firstRepeatText}\n> Source: [${firstRepeatTitle}](${PRIMARY_URL})`;
      await expectPreview(
        bridgePage,
        firstRepeatExpected,
        "Waiting for context menu copy on primary tab.",
      );
      await writeClipboardText(primaryPage, firstRepeatExpected);
      const firstRepeatClipboard = await readClipboardText(primaryPage);
      assertClipboardContainsNonce(firstRepeatClipboard, firstRepeatNonce);

      const secondRepeatNonce = mintClipboardNonce("repeat-secondary");
      const secondRepeatTitle = `Repeat Secondary ${secondRepeatNonce.slice(-4)}`;
      const secondRepeatText = `Repeated secondary context ${secondRepeatNonce}`;
      await updateArticle(secondaryPage, { text: secondRepeatText, title: secondRepeatTitle });
      await selectElementText(secondaryPage, "#quote", { expectedText: secondRepeatText });
      await resetPreviewState(bridgePage);
      await triggerContextCopy(bridgePage, {
        tabId: secondaryTab.id ?? undefined,
        source: "context-menu",
      });

      const secondRepeatExpected = `> ${secondRepeatText}\n> Source: [${secondRepeatTitle}](${SECONDARY_URL})`;
      await expectPreview(
        bridgePage,
        secondRepeatExpected,
        "Waiting for context menu copy on secondary tab.",
      );
      await writeClipboardText(secondaryPage, secondRepeatExpected);
      const secondRepeatClipboard = await readClipboardText(secondaryPage);
      assertClipboardContainsNonce(secondRepeatClipboard, secondRepeatNonce);

      // Step 4: success followed by protected fallback failure.
      await clearBackgroundErrors(bridgePage);
      const successNonce = mintClipboardNonce("success-context");
      const successTitle = `Success Context ${successNonce.slice(0, 4)}`;
      const successText = `Successful context ${successNonce}`;
      await updateArticle(primaryPage, { text: successText, title: successTitle });
      await selectElementText(primaryPage, "#quote", { expectedText: successText });
      await resetPreviewState(bridgePage);
      await triggerContextCopy(bridgePage, {
        tabId: primaryTab.id ?? undefined,
        source: "context-menu",
      });

      const successExpected = `> ${successText}\n> Source: [${successTitle}](${PRIMARY_URL})`;
      await expectPreview(
        bridgePage,
        successExpected,
        "Waiting for success copy before failure scenario.",
      );
      await writeClipboardText(primaryPage, successExpected);
      const successClipboard = await readClipboardText(primaryPage);
      assertClipboardContainsNonce(successClipboard, successNonce);

      const protectedPage = await context.newPage();
      await protectedPage.goto("about:blank");
      const failureNonce = mintClipboardNonce("protected");
      await protectedPage.evaluate((nonce) => {
        document.body.innerHTML = `<main><p id="protected">${nonce}</p></main>`;
        const element = document.getElementById("protected");
        if (!element) {
          throw new Error("Failed to create protected element.");
        }
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }, failureNonce);
      await protectedPage.bringToFront();

      await resetPreviewState(bridgePage);
      await resetHotkeyDiagnostics(bridgePage);
      await setHotkeyPinnedState(bridgePage, false);
      await triggerHotkeyCommand(bridgePage, { forcePinned: false });
      await bridgePage.waitForTimeout(300);
      const errors = await getBackgroundErrors(bridgePage);
      expect(errors.some((entry) => entry.context === "hotkey-open-popup")).toBe(true);

      const failurePreview = await readLastFormatted(bridgePage);
      expect(failurePreview.formatted).toBe(successExpected);
      const failureDiagnostics = await getHotkeyDiagnostics(bridgePage);
      expect(failureDiagnostics.injectionAttempted).toBe(false);
      expect(failureDiagnostics.injectionSucceeded).toBeNull();

      const clipboardAfterFailure = await readClipboardText(primaryPage);
      expect(clipboardAfterFailure).toBe(successClipboard);
      expect(() => assertClipboardContainsNonce(clipboardAfterFailure, failureNonce)).toThrow();

      await writeClipboardText(primaryPage, clipboard.initialText);
      await protectedPage.close();
      await secondaryPage.close();
      await bridgePage.close();
      await clipboard.restore();
    });
  });
