import path from "node:path";
import { captureOptionsScreenshot } from "./tools/chrome-web-store-capture/captureOptions.js";
import { captureOverviewScreenshot } from "./tools/chrome-web-store-capture/captureOverview.js";
import { capturePopupScreenshot } from "./tools/chrome-web-store-capture/capturePopup.js";
import { capturePromoMarquee } from "./tools/chrome-web-store-capture/capturePromoMarquee.js";
import { capturePromoSmall } from "./tools/chrome-web-store-capture/capturePromoSmall.js";
import { waitForConfirmation } from "./tools/chrome-web-store-capture/helpers.js";
import {
  assetsDir,
  buildExtension,
  ensureAssetsDir,
  getDefaultHotkey,
  loadIconBuffer,
  repoRoot,
  withExtensionContext,
} from "./tools/chrome-web-store-capture/runner.js";
import { getLaunchOptionsForCapture } from "./tools/chrome-web-store-capture/sizing.js";

const confirmScreenshots = process.argv.includes("--confirm");

async function captureAssets(): Promise<void> {
  await buildExtension();
  await ensureAssetsDir();

  const hotkey = await getDefaultHotkey();
  const iconBuffer = await loadIconBuffer();

  await withExtensionContext(async ({ context, extensionId }) => {
    const optionsPath = path.join(assetsDir, "screenshot-options-1280x800.png");
    await captureOptionsScreenshot(context, extensionId, optionsPath, confirmScreenshots);
    console.log(`Saved ${path.relative(repoRoot, optionsPath)}`);
  }, getLaunchOptionsForCapture("options"));

  await withExtensionContext(async ({ context }) => {
    const overviewPath = path.join(assetsDir, "screenshot-overview-1280x800.png");
    const relativeOverviewPath = path.relative(repoRoot, overviewPath);
    const page = await captureOverviewScreenshot(context, hotkey);

    if (confirmScreenshots) {
      await waitForConfirmation(
        "Press Enter when the overview window looks correct for capture.",
        true,
      );
    }

    console.log("\nManual capture required:");
    console.log(`  • Capture the browser window and save it as ${relativeOverviewPath}`);
    console.log("  • Close the Playwright window to proceed.\n");

    await page.waitForEvent("close");
    console.log("Overview window closed. Continuing asset capture.");
  }, getLaunchOptionsForCapture("overview"));

  await withExtensionContext(async ({ context, extensionId }) => {
    const popupBuffer = await capturePopupScreenshot(context, extensionId);
    const promoSmallPath = path.join(assetsDir, "promo-small-440x280.png");
    await capturePromoSmall(
      context,
      popupBuffer,
      iconBuffer,
      hotkey,
      promoSmallPath,
      confirmScreenshots,
    );
    console.log(`Saved ${path.relative(repoRoot, promoSmallPath)}`);
  }, getLaunchOptionsForCapture("promoSmall"));

  await withExtensionContext(async ({ context, extensionId }) => {
    const popupBuffer = await capturePopupScreenshot(context, extensionId);
    const promoMarqueePath = path.join(assetsDir, "promo-marquee-1400x560.png");
    await capturePromoMarquee(
      context,
      popupBuffer,
      iconBuffer,
      hotkey,
      promoMarqueePath,
      confirmScreenshots,
    );
    console.log(`Saved ${path.relative(repoRoot, promoMarqueePath)}`);
  }, getLaunchOptionsForCapture("promoMarquee"));
}

captureAssets().catch((error) => {
  console.error("Failed to capture Chrome Web Store assets:", error);
  process.exitCode = 1;
});
