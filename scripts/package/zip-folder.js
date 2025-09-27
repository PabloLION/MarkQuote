#!/usr/bin/env node
// Cross-platform zipper that relies on OS-native tooling: `zip` on POSIX and
// PowerShell's `Compress-Archive` on Windows. Avoids third-party dependencies.

const { access } = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function ensureExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`Path not found: ${targetPath}`);
  }
}

function escapeForPowerShell(value) {
  // Wrap in single quotes and escape embedded single quotes by doubling them.
  return `'${value.replace(/'/g, "''")}'`;
}

async function zipWithPowerShell(sourceDir, outFile) {
  const script = [
    `$source = ${escapeForPowerShell(sourceDir)}`,
    `$destination = ${escapeForPowerShell(outFile)}`,
    "if (Test-Path $destination) { Remove-Item $destination }",
    "Compress-Archive -Path (Join-Path $source '*') -DestinationPath $destination -Force"
  ].join('; ');

  await execFileAsync('powershell', ['-NoLogo', '-NoProfile', '-Command', script], {
    windowsHide: true
  });
}

async function zipWithZipCli(sourceDir, outFile) {
  await execFileAsync('zip', ['-r', outFile, '.'], { cwd: sourceDir });
}

async function zipDirectory(sourceDir, outFile) {
  await ensureExists(sourceDir);
  const absSource = path.resolve(sourceDir);
  const absOut = path.resolve(outFile);

  if (process.platform === 'win32') {
    await zipWithPowerShell(absSource, absOut);
    return;
  }

  await zipWithZipCli(absSource, absOut);
}

async function main() {
  const [source = 'dist', destination] = process.argv.slice(2);
  const outFile = destination ?? `${path.resolve('.')}/${path.basename(source)}.zip`;

  try {
    await zipDirectory(source, outFile);
    process.stdout.write(`Created archive: ${path.resolve(outFile)}\n`);
  } catch (error) {
    process.stderr.write(`Failed to create archive: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { zipDirectory };
