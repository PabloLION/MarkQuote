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
  await page.waitForTimeout(300);
  await waitForConfirmation("Review options page", confirm);
  await page.screenshot({ path: outputPath });
  await page.close();
}
