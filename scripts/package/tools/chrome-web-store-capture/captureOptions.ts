import type { BrowserContext } from "playwright";
import { openExtensionPage } from "./extension.js";
import { waitForConfirmation } from "./helpers.js";
import { getViewportSize } from "./sizing.js";

export async function captureOptionsScreenshot(
  context: BrowserContext,
  extensionId: string,
  outputPath: string,
  confirm: boolean,
): Promise<void> {
  const viewport = getViewportSize("options");
  const page = await openExtensionPage(context, extensionId, "options.html");
  await page.setViewportSize(viewport);
  await page.waitForLoadState("networkidle").catch(() => {});

  const contentBounds = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      width: Math.ceil(Math.max(doc.scrollWidth, doc.clientWidth)),
      height: Math.ceil(Math.max(doc.scrollHeight, doc.clientHeight)),
    };
  });

  const viewportWidth = Math.min(Math.max(contentBounds.width, viewport.width), 1600);
  const viewportHeight = Math.min(
    Math.max(viewport.height, Math.min(contentBounds.height, 1600)),
    2400,
  );

  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));

  await waitForConfirmation("Review options page", confirm);
  await page.screenshot({ path: outputPath, fullPage: true });
  await page.close();
}
