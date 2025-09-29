import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
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

  const defaultProfileDir = path.join(userDataDir, "Default");
  await mkdir(defaultProfileDir, { recursive: true });
  const preferencesPath = path.join(defaultProfileDir, "Preferences");
  const devtoolsPreferences = {
    devtools: {
      preferences: JSON.stringify({
        currentDockState: "undocked",
        previousDockState: "undocked",
        lastDockState: "undocked",
        uiTheme: "dark",
      }),
    },
  };
  await writeFile(preferencesPath, JSON.stringify(devtoolsPreferences));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !headed,
    colorScheme: options.colorScheme ?? "dark",
    viewport: null,
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      `--window-size=${windowSize.width},${windowSize.height}`,
      "--disable-infobars",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
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

  const manager = page.locator("extensions-manager");
  const extensionCard = manager.locator("extensions-item").first();
  await extensionCard.waitFor({ state: "visible" });
  const extensionId = await extensionCard.getAttribute("id");
  await page.close();

  if (!extensionId) {
    throw new Error("Unable to determine extension id from chrome://extensions");
  }

  return extensionId;
}

export async function pinExtensionToToolbar(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  const page = await context.newPage();

  try {
    await page.goto(`chrome://extensions/?id=${extensionId}`, { waitUntil: "load" });

    const manager = page.locator("extensions-manager");
    const toggle = manager
      .locator("extensions-detail-view")
      .locator("extensions-toggle-row#pin-to-toolbar")
      .locator("cr-toggle");

    await toggle.waitFor({ state: "visible", timeout: 5_000 });
    const state = await toggle.getAttribute("aria-pressed");
    if (state !== "true") {
      await toggle.click();
      await page.waitForTimeout(200);
    }
  } catch (error) {
    console.warn(`Unable to pin extension ${extensionId} to toolbar`, error);
  } finally {
    await page.close();
  }
}

export async function openExtensionPage(
  context: BrowserContext,
  extensionId: string,
  relativePath: string,
) {
  for (const page of context.pages()) {
    if (page.url() === "about:blank") {
      await page.close().catch(() => {
        /* ignore */
      });
    }
  }
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${relativePath}`, {
    waitUntil: "domcontentloaded",
  });
  await page.bringToFront();
  await undockDevtools(page);
  return page;
}

async function undockDevtools(page: Page): Promise<void> {
  try {
    const shortcut = process.platform === "darwin" ? "Meta+Alt+I" : "Control+Shift+I";
    await page.waitForTimeout(400);
    await page.keyboard.press(shortcut);
    await page.waitForTimeout(200);
  } catch (error) {
    console.warn("Unable to toggle DevTools window", error);
  }
}
