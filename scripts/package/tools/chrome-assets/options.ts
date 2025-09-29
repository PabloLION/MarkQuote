import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureOptionsScreenshot } from "./capture-options.js";
import { assetsDir, repoRoot } from "./paths.js";
import { buildExtension, ensureAssetsDir, withExtensionContext } from "./runner.js";
import { getLaunchOptionsForCapture } from "./sizing.js";

const confirm = process.argv.includes("--confirm");

async function main(): Promise<void> {
  await buildExtension();
  await ensureAssetsDir();

  await withExtensionContext(async ({ context, extensionId }) => {
    const outputPath = path.join(assetsDir, "screenshot-options-1280x800.png");
    await captureOptionsScreenshot(context, extensionId, outputPath, confirm);
    console.log(`Saved ${path.relative(repoRoot, outputPath)}`);
  }, getLaunchOptionsForCapture("options"));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  main().catch((error) => {
    console.error("Failed to capture options screenshot:", error);
    process.exitCode = 1;
  });
}
