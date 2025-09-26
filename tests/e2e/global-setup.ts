import { execSync } from 'node:child_process';
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

}
