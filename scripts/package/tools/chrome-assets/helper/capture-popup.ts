import type { BrowserContext } from "playwright";
import { openExtensionPage } from "./extension.js";
import { getViewportSize } from "./sizing.js";

export async function capturePopupScreenshot(
  context: BrowserContext,
  extensionId: string,
): Promise<Buffer> {
  const viewport = getViewportSize("popup");
  const page = await openExtensionPage(context, extensionId, "popup.html");
  await page.setViewportSize(viewport);
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const preview = document.getElementById("preview");
    const message = document.getElementById("message");
    if (preview) {
      preview.textContent =
        "[Markdown – Wikipedia](https://en.wikipedia.org/wiki/Markdown)\n\n> Markdown is a lightweight markup language for creating formatted text.";
    }
    if (message) {
      message.textContent = "Copied!";
    }
  });
  await page.waitForTimeout(120);
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  return buffer;
}
