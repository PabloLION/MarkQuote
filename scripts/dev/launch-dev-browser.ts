import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type BrowserContext, chromium } from "playwright";

type ExtensionPage = {
  name: string;
  url: string;
};

const extensionDir = path.resolve(process.cwd(), "dist");
const devModeToggleSelector = "cr-toggle#devMode";
const extensionItemSelector = "extensions-item-list extensions-item";

function createUserDataDir(): string {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright_extension_"));
  console.log(`Using temporary user data directory: ${userDataDir}`);
  return userDataDir;
}

async function launchBrowserWithExtension(userDataDir: string): Promise<BrowserContext> {
  console.log(`Loading extension from: ${extensionDir}`);
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: "chromium",
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
}

async function getExtensionId(browserContext: BrowserContext): Promise<string | null> {
  const page = await browserContext.newPage();
  try {
    await page.goto("chrome://extensions");
    console.log("Navigated to chrome://extensions to get ID.");

    const devModeToggle = page.locator(devModeToggleSelector);
    await devModeToggle.waitFor({ state: "visible", timeout: 5_000 });

    if ((await devModeToggle.getAttribute("aria-pressed")) === "false") {
      await devModeToggle.click();
      console.log("Developer mode enabled.");
      await page.waitForTimeout(1_000);
    } else {
      console.log("Developer mode already enabled.");
    }

    const extensionCard = page.locator(extensionItemSelector);
    await extensionCard.waitFor({ state: "visible", timeout: 10_000 });
    const extensionId = await extensionCard.getAttribute("id");
    console.log(`Extracted extension ID: ${extensionId}`);
    return extensionId;
  } catch (error) {
    console.error("Error getting extension ID from chrome://extensions:", error);
    return null;
  } finally {
    await page.close();
  }
}

async function openExtensionPagesAndTrack(params: {
  browserContext: BrowserContext;
  extensionId: string;
  userDataDir: string;
}): Promise<void> {
  const { browserContext, extensionId, userDataDir } = params;
  let openPagesCount = 0;

  const pagesToOpen: ExtensionPage[] = [
    { name: "Options", url: `chrome-extension://${extensionId}/options.html` },
    { name: "Popup", url: `chrome-extension://${extensionId}/popup.html` },
  ];

  const handlePageClose = async (): Promise<void> => {
    openPagesCount -= 1;
    console.log(`A page was closed. Remaining open pages: ${openPagesCount}`);
    if (openPagesCount <= 0) {
      console.log("All extension pages closed. Shutting down...");
      await browserContext.close();
      setTimeout(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary user data directory: ${userDataDir}`);
      }, 500);
    }
  };

  for (const pageInfo of pagesToOpen) {
    const newPage = await browserContext.newPage();
    await newPage.goto(pageInfo.url);
    console.log(`Launched ${pageInfo.name} page.`);
    openPagesCount += 1;
    newPage.on("close", handlePageClose);
  }

  console.log(`Successfully launched ${pagesToOpen.length} extension pages.`);
}

async function main(): Promise<void> {
  const userDataDir = createUserDataDir();
  const browserContext = await launchBrowserWithExtension(userDataDir);
  const extensionId = await getExtensionId(browserContext);

  if (!extensionId) {
    console.error("Failed to determine extension ID. Aborting.");
    await browserContext.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
    return;
  }

  await openExtensionPagesAndTrack({ browserContext, extensionId, userDataDir });
}

void main().catch((error) => {
  console.error("An unexpected error occurred:", error);
  process.exit(1);
});
