import { expect, test } from "@playwright/test";
import { readLastFormatted } from "./helpers/background-bridge.js";
import {
  getExtensionId,
  type LaunchExtensionResult,
  launchExtensionContext,
  openPopupPage,
} from "./helpers/extension.js";
import { selectElementText } from "./helpers/selection.js";

/**
 * Generates text content that exceeds the 500-character truncation limit.
 * Creates ~650 characters of realistic content as a single paragraph.
 */
function generateLongContent(): string {
  return "This is a comprehensive guide to understanding modern software development practices. It covers various topics including version control, continuous integration, and deployment. Teams that adopt these practices see significant improvements in code quality and velocity. The key is to start small and gradually expand the scope of automation over time. Documentation is equally important as it helps new team members get up to speed quickly. Code reviews serve multiple purposes: catching bugs, sharing knowledge, and maintaining standards. Testing at multiple levels provides confidence.";
}

const SAMPLE_URL = "https://example.com/long-article";
const SAMPLE_TITLE = "Long Article";

async function stubLongArticlePage(context: LaunchExtensionResult["context"], content: string) {
  await context.route(SAMPLE_URL, async (route) => {
    const html = `<!DOCTYPE html>
      <html lang="en">
        <head><meta charset="utf-8" /><title>${SAMPLE_TITLE}</title></head>
        <body><p id="quote">${content}</p></body>
      </html>`;
    await route.fulfill({ contentType: "text/html", body: html });
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

test("[PREVIEW_LONG_CONTENT] background pipeline formats long content correctly", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const longContent = generateLongContent();
  expect(longContent.length).toBeGreaterThan(500);

  await context.grantPermissions(["clipboard-write"], {
    origin: new URL(SAMPLE_URL).origin,
  });

  await stubLongArticlePage(context, longContent);

  const articlePage = await context.newPage();
  await articlePage.goto(SAMPLE_URL, { waitUntil: "domcontentloaded" });
  await selectElementText(articlePage, "#quote", { expectedText: longContent });
  await articlePage.bringToFront();

  const extensionId = await getExtensionId(context);
  const popupPage = await openPopupPage(context, extensionId);

  // Wait for preview to be formatted with the long content
  // The formatted content includes blockquote syntax (> ) and source line
  const _formattedContent = await expect
    .poll(async () => (await readLastFormatted(popupPage)).formatted, {
      message: "Waiting for formatted preview.",
    })
    .toContain(longContent.slice(0, 50));

  // Verify the full formatted content is in the background
  // (truncation happens at UI layer, tested in unit tests)
  const { formatted } = await readLastFormatted(popupPage);
  expect(formatted).toContain(longContent);
  expect(formatted.startsWith(">")).toBe(true); // Blockquote format
  expect(formatted).toContain("Source:"); // Source line

  await popupPage.close();
  await articlePage.close();
});

test("[PREVIEW_SHORT_CONTENT] background pipeline formats short content correctly", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  // Use simple single-line content
  const content = "This is a simple test sentence for verifying the copy pipeline.";

  await context.grantPermissions(["clipboard-write"], {
    origin: new URL(SAMPLE_URL).origin,
  });

  await stubLongArticlePage(context, content);

  const articlePage = await context.newPage();
  await articlePage.goto(SAMPLE_URL, { waitUntil: "domcontentloaded" });
  await selectElementText(articlePage, "#quote", { expectedText: content });
  await articlePage.bringToFront();

  const extensionId = await getExtensionId(context);
  const popupPage = await openPopupPage(context, extensionId);

  // Wait for preview to be formatted
  await expect
    .poll(async () => (await readLastFormatted(popupPage)).formatted, {
      message: "Waiting for formatted preview.",
    })
    .toContain("simple test");

  // Verify the formatted content structure
  const { formatted } = await readLastFormatted(popupPage);
  expect(formatted).toContain(content);
  expect(formatted.startsWith(">")).toBe(true); // Blockquote format
  expect(formatted).toContain("Source:"); // Source line
  expect(formatted).toContain(SAMPLE_TITLE); // Title in source

  await popupPage.close();
  await articlePage.close();
});
