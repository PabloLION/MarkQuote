import { expect, test } from "@playwright/test";
import { readLastFormatted } from "./helpers/background-bridge.js";
import { assertClipboardContainsNonce, mintClipboardNonce } from "./helpers/clipboard.js";
import {
  getExtensionId,
  type LaunchExtensionResult,
  launchExtensionContext,
  openPopupPage,
} from "./helpers/extension.js";
import { selectElementText } from "./helpers/selection.js";
import {
  readSystemClipboard,
  snapshotSystemClipboard,
  waitForSystemClipboard,
} from "./helpers/system-clipboard.js";

const WIKIPEDIA_URL =
  "https://en.wikipedia.org/wiki/Markdown?utm_source=chatgpt.com&utm_medium=email";
const SAMPLE_SELECTION = "Markdown keeps formatting simple.";

async function stubWikipediaPage(context: LaunchExtensionResult["context"]) {
  await context.route("https://en.wikipedia.org/**", async (route) => {
    const requestedUrl = route.request().url();

    if (!requestedUrl.startsWith("https://en.wikipedia.org/wiki/Markdown")) {
      await route.fulfill({ status: 204, body: "" });
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
      contentType: "text/html",
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

test("[POPUP_COPY] popup request pipeline formats the active tab selection", async () => {
  const { context, cleanup } = await launchExtensionContext({ colorScheme: "dark" });
  activeCleanup = cleanup;

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(WIKIPEDIA_URL).origin,
  });

  const extensionId = await getExtensionId(context);
  await stubWikipediaPage(context);

  const articlePage = await context.newPage();
  await articlePage.goto(WIKIPEDIA_URL, { waitUntil: "domcontentloaded" });
  await articlePage.bringToFront();

  const systemClipboard = await snapshotSystemClipboard();
  const popupPage = await openPopupPage(context, extensionId);

  try {
    const nonce = mintClipboardNonce("popup");
    const selectionText = `${SAMPLE_SELECTION} ${nonce}`;
    await articlePage.evaluate(
      ({ text }) => {
        const quote = document.getElementById("quote");
        if (!quote) {
          throw new Error("Unable to locate quote element for popup spec.");
        }
        quote.textContent = text;
      },
      { text: selectionText },
    );

    await selectElementText(articlePage, "#quote", { expectedText: selectionText });
    const expectedPreview = `> ${selectionText}\n> Source: [Wiki:Markdown](https://en.wikipedia.org/wiki/Markdown?utm_medium=email)`;

    await popupPage.evaluate(() => {
      // Re-request the selection after Playwright updates the page content to avoid racing the
      // popup's initial startup message.
      return chrome.runtime.sendMessage({ type: "request-selection-copy" });
    });

    await expect
      .poll(async () => (await readLastFormatted(popupPage)).formatted, {
        message: "Waiting for background selection pipeline to finish.",
      })
      .toBe(expectedPreview);

    const finalStatus = await readLastFormatted(popupPage);
    expect(finalStatus).toEqual({ formatted: expectedPreview, error: undefined });

    await waitForSystemClipboard(
      expectedPreview,
      "Popup clipboard did not match expected Markdown.",
    );
    const clipboardText = await readSystemClipboard();
    assertClipboardContainsNonce(clipboardText, nonce);
  } finally {
    await popupPage.close().catch(() => {});
    await systemClipboard.restore().catch(() => {});
    await articlePage.close();
  }
});

const COLOR_SCHEMES: Array<"dark" | "light"> = ["dark", "light"];

for (const colorScheme of COLOR_SCHEMES) {
  const tag = colorScheme === "dark" ? "[POPUP_DARK]" : "[POPUP_LIGHT]";
  test(`${tag} renders formatted markdown for a Wikipedia selection (${colorScheme})`, async () => {
    const { context, cleanup } = await launchExtensionContext({ colorScheme });
    activeCleanup = cleanup;

    await context.grantPermissions(["clipboard-write"], {
      origin: new URL(WIKIPEDIA_URL).origin,
    });

    await stubWikipediaPage(context);

    const articlePage = await context.newPage();
    await articlePage.goto(WIKIPEDIA_URL, { waitUntil: "domcontentloaded" });

    await selectElementText(articlePage, "#quote", { expectedText: SAMPLE_SELECTION });
    await articlePage.bringToFront();

    const extensionId = await getExtensionId(context);
    const popupPage = await openPopupPage(context, extensionId);

    const expectedPreview = `> ${SAMPLE_SELECTION}\n> Source: [Wiki:Markdown](https://en.wikipedia.org/wiki/Markdown?utm_medium=email)`;

    await expect
      .poll(async () => (await readLastFormatted(popupPage)).formatted, {
        message: "Waiting for popup preview to update with real selection.",
      })
      .toBe(expectedPreview);

    await popupPage.close();
    await articlePage.close();
  });
}
