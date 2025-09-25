import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.resolve(currentDir, '../..');

export default async function globalSetup(_config: FullConfig): Promise<void> {
  execSync('pnpm build', {
    stdio: 'inherit',
    cwd: repoRoot,
    env: { ...process.env, VITE_E2E: 'true' },
  });

  const manifestPath = path.join(repoRoot, 'dist', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    host_permissions?: string[];
  };

  const hostPermissions = new Set(manifest.host_permissions ?? []);
  const requiredHosts = ['https://example.com/*', 'https://en.wikipedia.org/*'];
  for (const host of requiredHosts) {
    hostPermissions.add(host);
  }

  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        ...manifest,
        host_permissions: Array.from(hostPermissions),
      },
      null,
      2,
    ),
  );
}
