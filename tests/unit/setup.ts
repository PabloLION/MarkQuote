import { beforeEach } from 'vitest';
import { ensureChromeMock } from '../../src/dev/chrome-dev-mock';

beforeEach(async () => {
  ensureChromeMock({ persistence: 'memory' });
  await chrome.storage.sync.clear();
  await chrome.storage.local.clear();
});
