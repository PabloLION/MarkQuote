import type { Page } from '@playwright/test';
import type { OptionsPayload } from '../../src/options-schema';

export async function sendSelectionMessage(
  page: Page,
  payload: { markdown: string; title: string; url: string },
): Promise<void> {
  await page.evaluate((message) => {
    chrome.runtime.sendMessage({ type: 'e2e:selection', ...message });
  }, payload);
}

export async function setOptionsPayload(page: Page, options: OptionsPayload): Promise<void> {
  const result = await page.evaluate((candidate) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: 'e2e:set-options', options: candidate }, (response) => {
        resolve(response ?? { ok: false, error: 'No response received' });
      });
    });
  }, options);

  if (!result?.ok) {
    throw new Error(
      `Failed to set options via runtime message: ${result?.error ?? 'unknown error'}`,
    );
  }
}

export async function readLastFormatted(
  page: Page,
): Promise<{ formatted: string; error?: string }> {
  return page.evaluate(() => {
    return new Promise<{ formatted: string; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: 'e2e:get-last-formatted' }, (response) => {
        resolve(response ?? { formatted: '', error: 'No response received' });
      });
    });
  });
}

export async function primeSelectionStub(
  page: Page,
  payload: { markdown: string; title: string; url: string },
): Promise<void> {
  const result = await page.evaluate((message) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: 'e2e:prime-selection', ...message }, (response) => {
        resolve(response ?? { ok: false, error: 'No response received' });
      });
    });
  }, payload);

  if (!result?.ok) {
    throw new Error(`Failed to prime selection stub: ${result?.error ?? 'unknown error'}`);
  }
}
