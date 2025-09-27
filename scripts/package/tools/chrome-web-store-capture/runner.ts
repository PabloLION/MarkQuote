import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BrowserContext } from "playwright";
import type { LaunchOptions } from "./extension.js";
import { getExtensionId, launchExtensionContext } from "./extension.js";
import { assetsDir, iconsDir, repoRoot } from "./paths.js";

export async function runCommand(command: string, args: string[]): Promise<void> {
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

export async function buildExtension(): Promise<void> {
  console.log("Building extension...\n");
  await runCommand("pnpm", ["build"]);
}

export async function ensureAssetsDir(): Promise<void> {
  await fs.mkdir(assetsDir, { recursive: true });
}

export async function loadIconBuffer(): Promise<Buffer> {
  return fs.readFile(path.join(iconsDir, "icon-48.png"));
}

export async function getDefaultHotkey(): Promise<string> {
  return readManifestHotkey();
}

export interface ExtensionHandle {
  context: BrowserContext;
  extensionId: string;
  cleanup: () => Promise<void>;
}

export async function withExtensionContext<T>(
  fn: (handle: ExtensionHandle) => Promise<T>,
  options: LaunchOptions = {},
): Promise<T> {
  const { context, cleanup } = await launchExtensionContext(options);

  try {
    const extensionId = await getExtensionId(context);
    return await fn({ context, extensionId, cleanup });
  } finally {
    await cleanup();
  }
}

async function readManifestHotkey(): Promise<string> {
  try {
    const manifestPath = path.join(repoRoot, "public", "manifest.json");
    const raw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    return manifest?.commands?.["copy-as-markdown-quote"]?.suggested_key?.default ?? "Alt+C";
  } catch (error) {
    console.warn("Unable to parse manifest.json for hotkey", error);
    return "Alt+C";
  }
}

export { assetsDir, repoRoot };
