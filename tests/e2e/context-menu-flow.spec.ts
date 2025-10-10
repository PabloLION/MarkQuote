import { expect, test } from "@playwright/test";
import {
  findTabByUrl,
  getBackgroundErrors,
  readLastFormatted,
  resetPreviewState,
  triggerContextCopy,
} from "./helpers/background-bridge.js";
import {
  assertClipboardContainsNonce,
  mintClipboardNonce,
  readClipboardText,
  snapshotClipboard,
  writeClipboardText,
} from "./helpers/clipboard.js";
import { getExtensionId, launchExtensionContext, openExtensionPage } from "./helpers/extension.js";
import { selectElementText } from "./helpers/selection.js";

const TARGET_URL = "https://example.com/context-menu";
const SAMPLE_SELECTION = "Context menu sample";
const SAMPLE_TITLE = "Context Menu Target";
let activeCleanup: (() => Promise<void>) | undefined;

test.afterEach(async () => {
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = undefined;
    await cleanup();
  }
});

test("context menu copy requests background pipeline", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  await context.route(TARGET_URL, async (route) => {
    const html = `<!DOCTYPE html>
      <html lang="en">
        <head><meta charset="utf-8" /><title>${SAMPLE_TITLE}</title></head>
        <body>
          <main>
            <p id="quote">${SAMPLE_SELECTION}</p>
          </main>
        </body>
      </html>`;
    await route.fulfill({ contentType: "text/html", body: html });
  });

  const extensionId = await getExtensionId(context);
  const articlePage = await context.newPage();
  await articlePage.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  await articlePage.bringToFront();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(TARGET_URL).origin,
  });
  const clipboard = await snapshotClipboard(articlePage);
  const nonce = mintClipboardNonce("context-menu");
  const selectionText = `${SAMPLE_SELECTION} ${nonce}`;
  const titleText = `${SAMPLE_TITLE} ${nonce.slice(-4)}`;
  await articlePage.evaluate(
    ({ selection, title }) => {
      const quote = document.getElementById("quote");
      if (!quote) {
        throw new Error("Quote element missing for context-menu spec.");
      }
      quote.textContent = selection;
      document.title = title;
    },
    { selection: selectionText, title: titleText },
  );
  await selectElementText(articlePage, "#quote", { expectedText: selectionText });

  const bridgePage = await openExtensionPage(context, extensionId, "options.html");
  const tabInfo = await findTabByUrl(bridgePage, `${new URL(TARGET_URL).origin}/*`);
  expect(tabInfo.id).not.toBeNull();

  await resetPreviewState(bridgePage);
  await triggerContextCopy(bridgePage, {
    tabId: tabInfo.id ?? undefined,
    source: "context-menu",
  });

  const expectedPreview = `> ${selectionText}\n> Source: [${titleText}](${TARGET_URL})`;
  await expect
    .poll(async () => (await readLastFormatted(bridgePage)).formatted, {
      timeout: 10_000,
      message: "Waiting for context menu copy to finish.",
    })
    .toBe(expectedPreview);

  await writeClipboardText(articlePage, expectedPreview);
  const clipboardText = await readClipboardText(articlePage);
  assertClipboardContainsNonce(clipboardText, nonce);

  const errors = await getBackgroundErrors(bridgePage);
  expect(errors.length).toBe(0);

  await bridgePage.close();
  await clipboard.restore();
  await articlePage.close();
});
