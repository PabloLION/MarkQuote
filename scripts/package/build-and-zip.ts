import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { zipDirectory } from "./zip-folder.js";

interface PackageMetadata {
  version?: string;
}

interface Manifest {
  version?: string;
}

function runCommand(command: string, args: readonly string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

async function ensureManifestVersionMatches(version: string): Promise<void> {
  const manifest = await readJson<Manifest>(path.join("public", "manifest.json"));
  if (manifest.version !== version) {
    throw new Error(
      `Manifest version (${manifest.version ?? "undefined"}) does not match package.json version (${version}).`,
    );
  }
}

async function runBuild(): Promise<void> {
  process.stdout.write("Running pnpm build...\n");
  await runCommand("pnpm", ["build"]);
}

async function createZip(version: string, destinationDir: string): Promise<string> {
  const archiveName = `markquote-v${version}.zip`;
  const archivePath = path.join(destinationDir, archiveName);

  process.stdout.write(`Creating archive: ${archivePath}\n`);
  await zipDirectory("dist", archivePath);
  return archivePath;
}

async function main(): Promise<void> {
  try {
    const packageJson = await readJson<PackageMetadata>("package.json");
    const version = packageJson.version;

    if (!version) {
      throw new Error("package.json is missing a version field.");
    }

    await ensureManifestVersionMatches(version);

    const releaseDir = path.join("docs", "releases");
    await fs.mkdir(releaseDir, { recursive: true });

    await runBuild();
    const zipPath = await createZip(version, releaseDir);

    process.stdout.write(`Done. Package available at: ${zipPath}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`build-and-zip failed: ${message}\n`);
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

export { main };
