import { expect, test } from "@playwright/test";
import { getExtensionId, launchExtensionContext, openPopupPage } from "./helpers/extension.js";

const FEEDBACK_URL = "https://github.com/PabloLION/MarkQuote/issues";

let activeCleanup: (() => Promise<void>) | undefined;

test.afterEach(async () => {
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = undefined;
    await cleanup();
  }
});

test("feedback button opens repository in new tab", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const popupPage = await openPopupPage(context, extensionId);

  const newPagePromise = context.waitForEvent("page");
  await popupPage.locator("#feedback-button").click();

  const feedbackPage = await newPagePromise;
  await feedbackPage.waitForLoadState("domcontentloaded");

  expect(feedbackPage.url()).toBe(FEEDBACK_URL);

  await feedbackPage.close();
  await popupPage.close();
});
