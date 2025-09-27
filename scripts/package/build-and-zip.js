#!/usr/bin/env node
// Builds the extension (`pnpm build`) and packages the `dist/` directory into a
// versioned ZIP using the cross-platform helper.

const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');

const execFileAsync = promisify(execFile);

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function runBuild() {
  process.stdout.write('Running pnpm build...\n');
  await execFileAsync('pnpm', ['build'], { stdio: 'inherit' });
}

async function createZip(version, destinationDir) {
  const zipName = `markquote-v${version}.zip`;
  const outPath = path.join(destinationDir, zipName);

  process.stdout.write(`Creating archive: ${outPath}\n`);
  await require('./zip-folder').zipDirectory('dist', outPath);
  return outPath;
}

async function ensureManifestVersionMatches(version) {
  const manifestPath = path.join('public', 'manifest.json');
  const manifest = await readJson(manifestPath);
  if (manifest.version !== version) {
    throw new Error(
      `Manifest version (${manifest.version}) does not match package.json version (${version}).`
    );
  }
}

async function main() {
  try {
    const packageJson = await readJson('package.json');
    const version = packageJson.version;
    if (!version) {
      throw new Error('package.json does not contain a version field.');
    }

    await ensureManifestVersionMatches(version);

    const outputDir = path.join('docs', 'releases');
    await fs.mkdir(outputDir, { recursive: true });

    await runBuild();
    const zipPath = await createZip(version, outputDir);

    process.stdout.write(`Done. Package available at: ${zipPath}\n`);
  } catch (error) {
    process.stderr.write(`build-and-zip failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
