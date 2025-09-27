import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserContext } from "playwright";
import { chromium } from "playwright";
import { distDir } from "./paths.js";

export interface LaunchOptions {
  headed?: boolean;
  colorScheme?: "light" | "dark";
  windowSize?: { width: number; height: number };
}

export interface ExtensionContextHandle {
  context: BrowserContext;
  cleanup: () => Promise<void>;
}

export async function launchExtensionContext(
  options: LaunchOptions = {},
): Promise<ExtensionContextHandle> {
  const headed = options.headed ?? true;
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "markquote-storefront-"));

  const windowSize = options.windowSize ?? { width: 1600, height: 1000 };

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !headed,
    colorScheme: options.colorScheme ?? "dark",
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      `--window-size=${windowSize.width},${windowSize.height}`,
    ],
  });

  const cleanup = async () => {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  };

  return { context, cleanup };
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  await page.goto("chrome://extensions", { waitUntil: "load" });

  const devModeToggle = page.locator("cr-toggle#devMode");
  await devModeToggle.waitFor({ state: "visible" });
  const pressed = await devModeToggle.getAttribute("aria-pressed");
  if (pressed === "false") {
    await devModeToggle.click();
    await page.waitForTimeout(500);
  }

  const extensionCard = page.locator("extensions-item").first();
  await extensionCard.waitFor({ state: "visible" });
  const extensionId = await extensionCard.getAttribute("id");
  await page.close();

  if (!extensionId) {
    throw new Error("Unable to determine extension id from chrome://extensions");
  }

  return extensionId;
}

export async function openExtensionPage(
  context: BrowserContext,
  extensionId: string,
  relativePath: string,
) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${relativePath}`, {
    waitUntil: "domcontentloaded",
  });
  return page;
}
