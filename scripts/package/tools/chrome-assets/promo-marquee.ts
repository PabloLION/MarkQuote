import path from "node:path";
import { fileURLToPath } from "node:url";
import { capturePopupScreenshot } from "./capture-popup.js";
import { capturePromoMarquee } from "./capture-promo-marquee.js";
import { assetsDir, repoRoot } from "./paths.js";
import {
  buildExtension,
  ensureAssetsDir,
  getDefaultHotkey,
  loadIconBuffer,
  withExtensionContext,
} from "./runner.js";
import { getLaunchOptionsForCapture } from "./sizing.js";

const confirm = process.argv.includes("--confirm");

async function main(): Promise<void> {
  await buildExtension();
  await ensureAssetsDir();

  const iconBuffer = await loadIconBuffer();
  const hotkey = await getDefaultHotkey();

  await withExtensionContext(async ({ context, extensionId }) => {
    const popupBuffer = await capturePopupScreenshot(context, extensionId);
    const outputPath = path.join(assetsDir, "promo-marquee-1400x560.png");
    await capturePromoMarquee(context, popupBuffer, iconBuffer, hotkey, outputPath, confirm);
    console.log(`Saved ${path.relative(repoRoot, outputPath)}`);
  }, getLaunchOptionsForCapture("promoMarquee"));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  main().catch((error) => {
    console.error("Failed to capture marquee promo tile:", error);
    process.exitCode = 1;
  });
}
