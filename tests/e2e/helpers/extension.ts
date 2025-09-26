import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, chromium, type Page } from "@playwright/test";

const moduleDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../..");
const extensionPath = path.resolve(repoRoot, "dist");

export interface LaunchExtensionOptions {
  colorScheme?: "light" | "dark";
}

export interface LaunchExtensionResult {
  context: BrowserContext;
  cleanup: () => Promise<void>;
}

export async function launchExtensionContext(
  options: LaunchExtensionOptions = {},
): Promise<LaunchExtensionResult> {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "markquote-e2e-"));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    colorScheme: options.colorScheme ?? "dark",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--window-position=50000,0",
      "--window-size=320,320",
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
  await page.goto("chrome://extensions");

  const devModeToggle = page.locator("cr-toggle#devMode");
  await devModeToggle.waitFor({ state: "visible" });

  if ((await devModeToggle.getAttribute("aria-pressed")) === "false") {
    await devModeToggle.click();
    await page.waitForTimeout(500);
  }

  const extensionCard = page.locator("extensions-item");
  await extensionCard.first().waitFor({ state: "visible" });
  const extensionId = await extensionCard.first().getAttribute("id");
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
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${relativePath}`);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

export async function openPopupPage(context: BrowserContext, extensionId: string): Promise<Page> {
  return openExtensionPage(context, extensionId, "popup.html");
}
