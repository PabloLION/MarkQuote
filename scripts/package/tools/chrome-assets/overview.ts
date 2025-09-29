import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureOverviewScreenshot } from "./capture-overview.js";
import { waitForConfirmation } from "./helpers.js";
import { assetsDir, repoRoot } from "./paths.js";
import {
  buildExtension,
  ensureAssetsDir,
  getDefaultHotkey,
  withExtensionContext,
} from "./runner.js";
import { getLaunchOptionsForCapture } from "./sizing.js";

const confirm = process.argv.includes("--confirm");

async function main(): Promise<void> {
  await buildExtension();
  await ensureAssetsDir();

  const hotkey = await getDefaultHotkey();

  await withExtensionContext(async ({ context }) => {
    const outputPath = path.join(assetsDir, "screenshot-overview-1280x800.png");
    const relativeOutput = path.relative(repoRoot, outputPath);
    const page = await captureOverviewScreenshot(context, hotkey);

    if (confirm) {
      await waitForConfirmation(
        "Press Enter when the overview window looks correct for capture.",
        true,
      );
    }

    console.log("\nManual capture required:");
    console.log(`  • Capture the browser window and save it as ${relativeOutput}`);
    console.log("  • Close the Playwright window to finish.\n");

    await page.waitForEvent("close");
    console.log("Overview window closed. Exiting capture helper.");
  }, getLaunchOptionsForCapture("overview"));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  main().catch((error) => {
    console.error("Failed to capture overview screenshot:", error);
    process.exitCode = 1;
  });
}
