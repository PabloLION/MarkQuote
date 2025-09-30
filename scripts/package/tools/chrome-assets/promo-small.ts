import path from "node:path";
import { fileURLToPath } from "node:url";
import { capturePopupScreenshot } from "./helper/capture-popup.js";
import { capturePromoSmall } from "./helper/capture-promo-small.js";
import { assetsDir, repoRoot } from "./helper/paths.js";
import {
  buildExtension,
  ensureAssetsDir,
  getDefaultHotkey,
  loadIconBuffer,
  withExtensionContext,
} from "./helper/runner.js";
import { getLaunchOptionsForCapture } from "./helper/sizing.js";

const confirm = process.argv.includes("--confirm");

async function main(): Promise<void> {
  await buildExtension();
  await ensureAssetsDir();

  const iconBuffer = await loadIconBuffer();
  const hotkey = await getDefaultHotkey();

  await withExtensionContext(async ({ context, extensionId }) => {
    const popupBuffer = await capturePopupScreenshot(context, extensionId);
    const outputPath = path.join(assetsDir, "promo-small-440x280.png");
    await capturePromoSmall(context, popupBuffer, iconBuffer, hotkey, outputPath, confirm);
    console.log(`Saved ${path.relative(repoRoot, outputPath)}`);
  }, getLaunchOptionsForCapture("promoSmall"));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  main().catch((error) => {
    console.error("Failed to capture small promo tile:", error);
    process.exitCode = 1;
  });
}
