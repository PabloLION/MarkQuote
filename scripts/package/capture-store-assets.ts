import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type BrowserContext, chromium } from "playwright";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const distDir = path.join(repoRoot, "dist");
const outputDir = path.join(repoRoot, "docs", "storefront", "chrome-web-store", "assets");
const templatesDir = path.join(repoRoot, "docs", "storefront", "chrome-web-store", "templates");

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

function toDataUri(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

const CHROME_STUB_SCRIPT = (initial: Record<string, unknown>) => `(() => {
  const memory = ${JSON.stringify(initial)};
  const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));

  const get = async (keys) => {
    if (!keys) return clone(memory);
    if (Array.isArray(keys)) {
      const result = {};
      for (const key of keys) {
        if (key in memory) result[key] = clone(memory[key]);
      }
      return result;
    }
    if (typeof keys === 'string') {
      return { [keys]: clone(memory[keys]) };
    }
    if (typeof keys === 'object') {
      const result = {};
      for (const key of Object.keys(keys)) {
        result[key] = clone(memory[key] ?? keys[key]);
      }
      return result;
    }
    return clone(memory);
  };

  const set = async (values) => {
    Object.assign(memory, values);
  };

  const storage = { sync: { get, set, remove: async () => {}, clear: async () => {} } };

  const runtimeListeners = new Set();
  const runtime = {
    sendMessage: () => Promise.resolve(),
    onMessage: {
      addListener: (fn) => runtimeListeners.add(fn),
      removeListener: (fn) => runtimeListeners.delete(fn),
    },
    openOptionsPage: () => {},
  };

  const commands = { openShortcutSettings: () => {} };

  globalThis.navigator ??= {};
  globalThis.navigator.clipboard ??= { writeText: async () => {} };

  globalThis.chrome = {
    runtime,
    storage,
    commands,
  };
})();`;

async function captureOptionsScreenshot(
  context: BrowserContext,
  outputPath: string,
): Promise<void> {
  const page = await context.newPage();
  await page.addInitScript({ content: CHROME_STUB_SCRIPT({}) });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(pathToFileURL(path.join(distDir, "options.html")).toString(), {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: outputPath });
  await page.close();
}

async function capturePopupScreenshot(context: BrowserContext): Promise<Buffer> {
  const page = await context.newPage();
  await page.addInitScript({ content: CHROME_STUB_SCRIPT({}) });
  await page.setViewportSize({ width: 380, height: 540 });
  await page.goto(pathToFileURL(path.join(distDir, "popup.html")).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const preview = document.getElementById("preview");
    const message = document.getElementById("message");
    if (preview) {
      preview.textContent =
        "[Markdown – Wikipedia](https://en.wikipedia.org/wiki/Markdown)\n\n> Markdown is a lightweight markup language for creating formatted text.";
    }
    if (message) {
      message.textContent = "Copied!";
    }
  });
  await page.waitForTimeout(150);
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  return buffer;
}

async function renderTemplate(
  context: BrowserContext,
  templateFile: string,
  replacements: Record<string, string>,
  viewport: { width: number; height: number },
  outputPath: string,
): Promise<void> {
  const templatePath = path.join(templatesDir, templateFile);
  let html = await fs.readFile(templatePath, "utf8");
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  await page.screenshot({ path: outputPath });
  await page.close();
}

async function readManifestHotkey(): Promise<string> {
  const manifestPath = path.join(repoRoot, "public", "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  try {
    const manifest = JSON.parse(raw);
    return manifest?.commands?.["copy-as-markdown-quote"]?.suggested_key?.default ?? "Alt+C";
  } catch (error) {
    console.warn("Unable to parse manifest.json for hotkey", error);
    return "Alt+C";
  }
}

async function captureAssets(): Promise<void> {
  console.log("Building extension...\n");
  await run("pnpm", ["build"]);

  await ensureDir(outputDir);

  const hotkey = await readManifestHotkey();
  const iconBuffer = await fs.readFile(path.join(repoRoot, "public", "icons", "icon-48.png"));

  const browser = await chromium.launch({ headless: true });
  const browserContext = await browser.newContext();

  try {
    const popupBuffer = await capturePopupScreenshot(browserContext);

    const optionsPath = path.join(outputDir, "screenshot-options-1280x800.png");
    await captureOptionsScreenshot(browserContext, optionsPath);
    console.log(`Saved ${path.relative(repoRoot, optionsPath)}`);

    const overviewPath = path.join(outputDir, "screenshot-overview-1280x800.png");
    await renderTemplate(
      browserContext,
      "overview.html",
      {
        POPUP_IMAGE: toDataUri(popupBuffer),
        ICON: toDataUri(iconBuffer),
        HOTKEY: hotkey,
      },
      { width: 1280, height: 800 },
      overviewPath,
    );
    console.log(`Saved ${path.relative(repoRoot, overviewPath)}`);

    const promoSmallPath = path.join(outputDir, "promo-small-440x280.png");
    await renderTemplate(
      browserContext,
      "promo-small.html",
      {
        POPUP_IMAGE: toDataUri(popupBuffer),
        ICON: toDataUri(iconBuffer),
        HOTKEY: hotkey,
      },
      { width: 440, height: 280 },
      promoSmallPath,
    );
    console.log(`Saved ${path.relative(repoRoot, promoSmallPath)}`);

    const promoMarqueePath = path.join(outputDir, "promo-marquee-1400x560.png");
    await renderTemplate(
      browserContext,
      "promo-marquee.html",
      {
        POPUP_IMAGE: toDataUri(popupBuffer),
        ICON: toDataUri(iconBuffer),
        HOTKEY: hotkey,
      },
      { width: 1400, height: 560 },
      promoMarqueePath,
    );
    console.log(`Saved ${path.relative(repoRoot, promoMarqueePath)}`);
  } finally {
    await browserContext.close();
    await browser.close();
  }
}

captureAssets().catch((error) => {
  console.error("Failed to capture Chrome Web Store assets:", error);
  process.exitCode = 1;
});
