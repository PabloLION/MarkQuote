import { expect, test } from "@playwright/test";
import {
  clearBackgroundErrors,
  getBackgroundErrors,
  seedBackgroundError,
} from "./helpers/background-bridge.js";
import {
  getExtensionId,
  launchExtensionContext,
  openExtensionPage,
  openPopupPage,
} from "./helpers/extension.js";
import { readSystemClipboard, snapshotSystemClipboard } from "./helpers/system-clipboard.js";

let activeCleanup: (() => Promise<void>) | undefined;

test.afterEach(async () => {
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = undefined;
    await cleanup();
  }
});

test("[ERROR_COPY_DETAILS] copy details button copies markdown error report to clipboard", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);

  // Need a page with clipboard permissions to seed errors
  const bridgePage = await openExtensionPage(context, extensionId, "options.html");

  // Clear any existing errors
  await clearBackgroundErrors(bridgePage);

  // Seed a test error (must use valid ErrorContext value)
  await seedBackgroundError(bridgePage, {
    context: "inject-selection-script",
    message: "Test error message for E2E",
  });

  // Verify error was seeded
  const errors = await getBackgroundErrors(bridgePage);
  expect(errors.length).toBe(1);

  // Extension has clipboardWrite permission from manifest, no need to grant
  const systemClipboard = await snapshotSystemClipboard();

  try {
    // Open popup and verify error container is visible
    const popupPage = await openPopupPage(context, extensionId);

    const errorContainer = popupPage.locator("#error-container");
    await expect(errorContainer).toBeVisible();

    // Click copy details button
    const copyButton = popupPage.locator("#copy-details-button");
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    // Wait for button to show "Copied!" feedback
    await expect(copyButton).toHaveText("Copied!");

    // Verify clipboard contains markdown report
    const clipboardContent = await readSystemClipboard();
    expect(clipboardContent).toContain("## MarkQuote Error Report");
    expect(clipboardContent).toContain("inject-selection-script");
    expect(clipboardContent).toContain("Test error message for E2E");

    await popupPage.close();
  } finally {
    await systemClipboard.restore().catch(() => {});
    await bridgePage.close();
  }
});

test("[ERROR_MARKDOWN_FORMAT] copied error report contains required markdown sections", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const bridgePage = await openExtensionPage(context, extensionId, "options.html");

  await clearBackgroundErrors(bridgePage);

  // Seed multiple errors to test full report format (must use valid ErrorContext values)
  await seedBackgroundError(bridgePage, {
    context: "inject-selection-script",
    message: "Cannot access page content",
  });
  await seedBackgroundError(bridgePage, {
    context: "tab-clipboard-write",
    message: "Clipboard write failed",
  });

  // Extension has clipboardWrite permission from manifest, no need to grant
  const systemClipboard = await snapshotSystemClipboard();

  try {
    const popupPage = await openPopupPage(context, extensionId);

    await popupPage.locator("#copy-details-button").click();
    await expect(popupPage.locator("#copy-details-button")).toHaveText("Copied!");

    const clipboardContent = await readSystemClipboard();

    // Verify required sections exist
    expect(clipboardContent).toContain("## MarkQuote Error Report");
    expect(clipboardContent).toContain("**Errors:**");
    expect(clipboardContent).toContain("**Generated:**");
    expect(clipboardContent).toContain("### Environment");
    expect(clipboardContent).toContain("**Extension Version:**");
    expect(clipboardContent).toContain("**User Agent:**");
    expect(clipboardContent).toContain("### Errors");

    // Verify both errors are included
    expect(clipboardContent).toContain("inject-selection-script");
    expect(clipboardContent).toContain("tab-clipboard-write");

    await popupPage.close();
  } finally {
    await systemClipboard.restore().catch(() => {});
    await bridgePage.close();
  }
});

test("[ERROR_DISMISS_CLEARS] dismiss button clears errors and updates badge", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const bridgePage = await openExtensionPage(context, extensionId, "options.html");

  await clearBackgroundErrors(bridgePage);

  // Seed errors (must use valid ErrorContext values)
  await seedBackgroundError(bridgePage, { context: "inject-selection-script", message: "Error 1" });
  await seedBackgroundError(bridgePage, { context: "request-selection-copy", message: "Error 2" });

  // Verify errors exist
  let errors = await getBackgroundErrors(bridgePage);
  expect(errors.length).toBe(2);

  // Open popup
  const popupPage = await openPopupPage(context, extensionId);

  // Verify error container and badge are visible
  const errorContainer = popupPage.locator("#error-container");
  await expect(errorContainer).toBeVisible();

  const badge = popupPage.locator("#problem-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText("2");

  // Click dismiss button
  const dismissButton = popupPage.locator("#dismiss-errors-button");
  await dismissButton.click();

  // Verify error container is hidden
  await expect(errorContainer).toBeHidden();

  // Verify badge is hidden
  await expect(badge).toBeHidden();

  // Verify errors were cleared from storage
  errors = await getBackgroundErrors(bridgePage);
  expect(errors.length).toBe(0);

  await popupPage.close();
  await bridgePage.close();
});

test("[ERROR_BADGE_SYNC] badge count stays in sync with error count", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const bridgePage = await openExtensionPage(context, extensionId, "options.html");

  await clearBackgroundErrors(bridgePage);

  // Seed 3 errors (must use valid ErrorContext values)
  await seedBackgroundError(bridgePage, { context: "inject-selection-script" });
  await seedBackgroundError(bridgePage, { context: "request-selection-copy" });
  await seedBackgroundError(bridgePage, { context: "query-tabs-for-copy" });

  // Open popup and verify badge shows 3
  let popupPage = await openPopupPage(context, extensionId);
  const badge = popupPage.locator("#problem-badge");
  await expect(badge).toHaveText("3");
  await popupPage.close();

  // Add more errors
  await seedBackgroundError(bridgePage, { context: "tab-clipboard-write" });
  await seedBackgroundError(bridgePage, { context: "hotkey-open-popup" });

  // Re-open popup and verify badge shows 5
  popupPage = await openPopupPage(context, extensionId);
  await expect(popupPage.locator("#problem-badge")).toHaveText("5");

  // Clear errors via bridge (simulating background clear)
  await clearBackgroundErrors(bridgePage);

  // Re-open popup and verify badge is hidden
  await popupPage.close();
  popupPage = await openPopupPage(context, extensionId);

  await expect(popupPage.locator("#error-container")).toBeHidden();
  await expect(popupPage.locator("#problem-badge")).toBeHidden();

  await popupPage.close();
  await bridgePage.close();
});
