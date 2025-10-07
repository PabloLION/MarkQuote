import { expect, test } from "@playwright/test";
import {
  getBackgroundErrors,
  primeSelectionStub,
  readLastFormatted,
  resetExtensionState,
} from "./helpers/background-bridge.js";
import {
  getExtensionId,
  launchExtensionContext,
  openExtensionPage,
  openPopupPage,
} from "./helpers/extension.js";

const SAMPLE_TITLE = "Onboarding Target";
const SAMPLE_SELECTION = "First run selection";
const SAMPLE_URL = "https://example.com/onboarding";
const EXPECTED_PREVIEW = `> ${SAMPLE_SELECTION}\n> Source: [${SAMPLE_TITLE}](${SAMPLE_URL})`;

let activeCleanup: (() => Promise<void>) | undefined;

test.afterEach(async () => {
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = undefined;
    await cleanup();
  }
});

test("first run copy uses default template", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const bridgePage = await openExtensionPage(context, extensionId, "options.html");

  await resetExtensionState(bridgePage);
  await primeSelectionStub(bridgePage, {
    markdown: SAMPLE_SELECTION,
    title: SAMPLE_TITLE,
    url: SAMPLE_URL,
  });

  const popupPage = await openPopupPage(context, extensionId);

  await expect
    .poll(async () => (await readLastFormatted(bridgePage)).formatted, {
      timeout: 10_000,
      message: "Waiting for default template preview.",
    })
    .toBe(EXPECTED_PREVIEW);

  const backgroundErrors = await getBackgroundErrors(bridgePage);
  expect(backgroundErrors).toHaveLength(0);

  await popupPage.close();
  await bridgePage.close();
});
