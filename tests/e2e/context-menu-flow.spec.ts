import { expect, test } from "@playwright/test";
import {
  findTabByUrl,
  getBackgroundErrors,
  readLastFormatted,
  triggerContextCopy,
} from "./helpers/background-bridge.js";
import { getExtensionId, launchExtensionContext, openExtensionPage } from "./helpers/extension.js";
import { selectElementText } from "./helpers/selection.js";

const TARGET_URL = "https://example.com/context-menu";
const SAMPLE_SELECTION = "Context menu sample";
const SAMPLE_TITLE = "Context Menu Target";
const EXPECTED_PREVIEW = `> ${SAMPLE_SELECTION}\n> Source: [${SAMPLE_TITLE}](${TARGET_URL})`;

let activeCleanup: (() => Promise<void>) | undefined;

test.afterEach(async () => {
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = undefined;
    await cleanup();
  }
});

test("[smoke] context menu copy requests background pipeline", async () => {
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
  await selectElementText(articlePage, "#quote", { expectedText: SAMPLE_SELECTION });
  await articlePage.bringToFront();

  const bridgePage = await openExtensionPage(context, extensionId, "options.html");
  const tabInfo = await findTabByUrl(bridgePage, `${new URL(TARGET_URL).origin}/*`);
  expect(tabInfo.id).not.toBeNull();

  await triggerContextCopy(bridgePage, {
    tabId: tabInfo.id ?? undefined,
    source: "context-menu",
  });

  await expect
    .poll(async () => (await readLastFormatted(bridgePage)).formatted, {
      timeout: 10_000,
      message: "Waiting for context menu copy to finish.",
    })
    .toBe(EXPECTED_PREVIEW);

  const errors = await getBackgroundErrors(bridgePage);
  expect(errors.length).toBe(0);

  await bridgePage.close();
  await articlePage.close();
});
