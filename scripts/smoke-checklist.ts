/**
 * Smoke test automation script.
 * Builds the extension, launches Playwright with it loaded, and prints checklist.
 * Run with: pnpm smoke
 */
import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

interface PackageJson {
  version?: string;
}

async function getVersion(): Promise<string> {
  const packagePath = path.join(rootDir, "package.json");
  const content = await fs.readFile(packagePath, "utf-8");
  const pkg: PackageJson = JSON.parse(content);
  return pkg.version ?? "unknown";
}

function runBuild(release: boolean): void {
  console.log(`Building extension (${release ? "release" : "smoke"})...\n`);
  const env = release ? { ...process.env, RELEASE_BUILD: "1" } : process.env;
  execSync("pnpm build", { cwd: rootDir, stdio: "inherit", env });
  console.log("\n✓ Build complete\n");
}

async function getExtensionId(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
): Promise<string> {
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

async function launchPlaywright(): Promise<{ cleanup: () => Promise<void> }> {
  const testUrl = "https://en.wikipedia.org/wiki/Pablo_Picasso";
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "markquote-smoke-"));

  console.log("Launching Playwright with extension loaded...");
  console.log(`  Extension: ${distDir}`);
  console.log(`  Test page: ${testUrl}`);
  console.log(`  Profile: ${userDataDir}\n`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    colorScheme: "dark",
    args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
    viewport: { width: 1280, height: 800 },
  });

  // Get extension ID
  const extensionId = await getExtensionId(context);
  console.log(`  Extension ID: ${extensionId}\n`);

  // Open popup page first (to see smoke build timestamp)
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

  // Open options page
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);

  // Open test page (Wikipedia) last
  const testPage = await context.newPage();
  await testPage.goto(testUrl);

  console.log("✓ Playwright launched - browser will stay open for manual testing");
  console.log("  Opened: Popup, Options, Wikipedia pages\n");
  console.log("  Press Ctrl+C to close when done.\n");

  const cleanup = async () => {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  };

  return { cleanup };
}

function printChecklist(version: string): void {
  const smokePlanPath = path.join("docs", "dev", "smoke-test-plan.md");

  const checklist = `
╔═══════════════════════════════════════════════════════════════════╗
║     MarkQuote Smoke Test v${version.padEnd(8)}                              ║
╚═══════════════════════════════════════════════════════════════════╝

─────────────────────────────────────────────────────────────────────
Manual-Only Tests (Playwright cannot automate these):
─────────────────────────────────────────────────────────────────────

  [ ] 1. Toolbar icon click (pinned) → popup opens with preview
  [ ] 2. Keyboard shortcut (Alt+C) with pinned icon → popup opens
  [ ] 3. Protected chrome:// page → shows "Chrome internal pages" message
  [ ] 4. Protected file:// page → shows "Local file pages" message
  [ ] 5. Always-on confirmation toggle → popup auto-opens after copy

─────────────────────────────────────────────────────────────────────
Feature Verification (also covered by E2E, but verify visually):
─────────────────────────────────────────────────────────────────────

  [ ] 6. Context menu "Copy as Markdown Quote" → copies blockquote
  [ ] 7. Keyboard shortcut (unpinned) → copies to clipboard
  [ ] 8. Options page rule editing → changes persist after reload
  [ ] 9. Error badge appears on extension icon after failed copy
  [ ] 10. Error list displays in popup with "Copy details" button
  [ ] 11. "Copy details" generates markdown error report
  [ ] 12. "Dismiss" clears errors and removes badge
  [ ] 13. Long preview shows "Show more" toggle
  [ ] 14. Icon renders correctly at all sizes

─────────────────────────────────────────────────────────────────────
Full documentation: ${smokePlanPath}
─────────────────────────────────────────────────────────────────────
`;

  console.log(checklist);
}

async function main(): Promise<void> {
  const release = process.argv.includes("--release");
  runBuild(release);

  const version = await getVersion();
  printChecklist(version);

  if (release) {
    console.log("  ⚠ RELEASE BUILD - verify NO smoke timestamp in popup\n");
  }

  const { cleanup } = await launchPlaywright();

  // Keep process running until user closes
  process.on("SIGINT", async () => {
    console.log("\n\nCleaning up...");
    await cleanup();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}

main().catch((error) => {
  console.error("Smoke test setup failed:", error);
  process.exit(1);
});
