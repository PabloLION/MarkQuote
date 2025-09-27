import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function ensureExists(targetPath: string): Promise<void> {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`Path not found: ${targetPath}`);
  }
}

function escapeForPowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function zipWithPowerShell(sourceDir: string, outFile: string): Promise<void> {
  const commands = [
    `$source = ${escapeForPowerShell(sourceDir)}`,
    `$destination = ${escapeForPowerShell(outFile)}`,
    "if (Test-Path $destination) { Remove-Item $destination }",
    "Compress-Archive -Path (Join-Path $source '*') -DestinationPath $destination -Force",
  ];

  await execFileAsync("powershell", ["-NoLogo", "-NoProfile", "-Command", commands.join("; ")], {
    windowsHide: true,
  });
}

async function zipWithZipCli(sourceDir: string, outFile: string): Promise<void> {
  await execFileAsync("zip", ["-r", outFile, "."], { cwd: sourceDir });
}

export async function zipDirectory(sourceDir: string, outFile: string): Promise<void> {
  await ensureExists(sourceDir);
  const absoluteSource = path.resolve(sourceDir);
  const absoluteOut = path.resolve(outFile);

  if (process.platform === "win32") {
    await zipWithPowerShell(absoluteSource, absoluteOut);
    return;
  }

  await zipWithZipCli(absoluteSource, absoluteOut);
}

async function main(): Promise<void> {
  const [source = "dist", destination] = process.argv.slice(2);
  const outFile = destination ?? path.join(process.cwd(), `${path.basename(source)}.zip`);

  try {
    await zipDirectory(source, outFile);
    process.stdout.write(`Created archive: ${path.resolve(outFile)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Failed to create archive: ${message}\n`);
    process.exitCode = 1;
  }
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return pathToFileURL(path.resolve(entry)).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  void main();
}
