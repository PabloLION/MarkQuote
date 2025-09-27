import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { BrowserContext } from "playwright";
import { templatesDir } from "./paths.js";

export function toDataUri(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function waitForConfirmation(message: string, enabled: boolean): Promise<void> {
  if (!enabled) {
    return;
  }

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message} Press Enter to continue…`, () => {
      rl.close();
      resolve();
    });
  });
}

export async function renderTemplate(
  context: BrowserContext,
  templateFile: string,
  replacements: Record<string, string>,
  viewport: { width: number; height: number },
  outputPath: string,
  confirm: boolean,
  confirmMessage: string,
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
  await waitForConfirmation(confirmMessage, confirm);
  await page.screenshot({ path: outputPath });
  await page.close();
}
