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

async function launchPlaywright(): Promise<{ cleanup: () => Promise<void> }> {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "markquote-smoke-"));
  const readmePath = path.join(rootDir, "README.md");

  console.log("Launching Playwright with extension loaded...");
  console.log(`  Extension: ${distDir}`);
  console.log(`  Profile: ${userDataDir}\n`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    colorScheme: "dark",
    args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
    viewport: { width: 1280, height: 800 },
  });

  // Get extension ID (keeps chrome://extensions open)
  const extensionsPage = await context.newPage();
  await extensionsPage.goto("chrome://extensions");
  const devModeToggle = extensionsPage.locator("cr-toggle#devMode");
  await devModeToggle.waitFor({ state: "visible" });
  if ((await devModeToggle.getAttribute("aria-pressed")) === "false") {
    await devModeToggle.click();
    await extensionsPage.waitForTimeout(500);
  }
  const extensionCard = extensionsPage.locator("extensions-item");
  await extensionCard.first().waitFor({ state: "visible" });
  const extensionId = await extensionCard.first().getAttribute("id");
  if (!extensionId) throw new Error("Unable to determine extension ID");

  console.log(`  Extension ID: ${extensionId}\n`);

  // Open all test pages
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);

  const filePage = await context.newPage();
  await filePage.goto(`file://${readmePath}`);

  const wikiPage = await context.newPage();
  await wikiPage.goto("https://en.wikipedia.org/wiki/Pablo_Picasso");

  console.log("✓ Playwright launched - browser will stay open for manual testing");
  console.log("  Tabs: chrome://extensions, Popup, Options, file://, Wikipedia\n");
  console.log("  Press Ctrl+C to close when done.\n");

  const cleanup = async () => {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  };

  return { cleanup };
}

function printChecklist(version: string): void {
  const checklist = `
╔═══════════════════════════════════════════════════════════════════╗
║     MarkQuote Smoke Test v${version.padEnd(8)}                              ║
╚═══════════════════════════════════════════════════════════════════╝

Manual-only tests (cannot be automated with Playwright):

  [ ] 1. Pin extension → click icon → popup opens with preview
  [ ] 2. Pin extension → select text → Alt+C → popup opens
  [ ] 3. Go to chrome://extensions tab → click icon → protected page message
  [ ] 4. Go to file:// tab → click icon → protected page message
  [ ] 5. Options: enable confirmation toggle → Alt+C on Wikipedia → popup auto-opens

Tabs opened: chrome://extensions, Popup, Options, file://, Wikipedia
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
